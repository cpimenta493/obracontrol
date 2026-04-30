const nodemailer = require("nodemailer");

const FIREBASE_URL = "https://obra-posto-medico-default-rtdb.europe-west1.firebasedatabase.app";

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return Object.values(val).filter(Boolean);
}

function toCSV(rows) {
  return rows
    .map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

// Previous week Mon–Sun relative to today
function previousWeekRange() {
  const now = new Date();
  const dow = now.getUTCDay(); // 0=Sun 1=Mon…
  const daysToThisMon = dow === 0 ? 6 : dow - 1;
  const thisMon = new Date(now);
  thisMon.setUTCDate(now.getUTCDate() - daysToThisMon);
  const lastMon = new Date(thisMon);
  lastMon.setUTCDate(thisMon.getUTCDate() - 7);
  const lastSun = new Date(lastMon);
  lastSun.setUTCDate(lastMon.getUTCDate() + 6);
  const fmt = d => d.toISOString().slice(0, 10);
  return { from: fmt(lastMon), to: fmt(lastSun), thisMon: fmt(thisMon) };
}

// Write a single field to Firebase via REST
async function firebaseSet(path, value) {
  await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

module.exports = async function handler(req, res) {
  // CORS for browser force-send calls
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const force = req.query?.force === "true";

  // Auth check — only for scheduled (non-forced) calls
  if (!force) {
    const authHeader = req.headers["authorization"];
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    // Read Firebase config + data
    const [attRes, wRes, stockRes, cfgRes] = await Promise.all([
      fetch(`${FIREBASE_URL}/attendance.json`),
      fetch(`${FIREBASE_URL}/workers.json`),
      fetch(`${FIREBASE_URL}/stock.json`),
      fetch(`${FIREBASE_URL}/config.json`),
    ]);

    const attendance = toArray(await attRes.json());
    const workers    = toArray(await wRes.json());
    const stock      = toArray(await stockRes.json());
    const config     = (await cfgRes.json()) || {};

    const recipientEmail = config.reportEmail;
    if (!recipientEmail) {
      return res.status(200).json({ skipped: true, reason: "Nenhum email configurado em ObraControl → Config." });
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass) {
      return res.status(500).json({ error: "SMTP_USER ou SMTP_PASS não definidos nas variáveis de ambiente do Vercel." });
    }

    if (!force) {
      // Check configured day (JS getDay: 0=Sun, 1=Mon…6=Sat)
      const configDay  = parseInt(config.reportDay  ?? 1);    // default Monday
      const configHour = parseInt(config.reportHour ?? 8);    // default 8h Portugal = 7h UTC
      const nowUTC = new Date();
      const ptHour = (nowUTC.getUTCHours() + 1) % 24;        // Portugal ≈ UTC+1
      const ptDay  = new Date(nowUTC.getTime() + 3600000).getUTCDay(); // shift 1h for PT

      if (ptDay !== configDay || ptHour !== configHour) {
        return res.status(200).json({ skipped: true, reason: `Não é o dia/hora configurado (config: dia ${configDay} às ${configHour}h; agora: dia ${ptDay} às ${ptHour}h PT).` });
      }

      // Check if already sent this week
      const { thisMon } = previousWeekRange();
      if (config.reportLastSent && config.reportLastSent >= thisMon) {
        return res.status(200).json({ skipped: true, reason: "Relatório já enviado esta semana." });
      }
    }

    // Build date range
    const { from: fromDate, to: toDate } = previousWeekRange();

    const weekAtt   = attendance.filter(a => a.date >= fromDate && a.date <= toDate);
    const weekStock = stock.filter(e => e.date >= fromDate && e.date <= toDate);

    const allDates = [
      ...new Set([...weekAtt.map(a => a.date), ...weekStock.map(e => e.date)]),
    ].sort();

    const rows = [["Data", "Funcionários", "Trabalhos Realizados", "Material", "Código", "Quantidade", "Unidade"]];

    for (const date of allDates) {
      const attRec   = weekAtt.find(a => a.date === date);
      const dayStock = weekStock.filter(e => e.date === date);
      const workerNames = attRec
        ? workers.filter(w => (attRec.present || []).includes(w.id)).map(w => w.name).join(", ")
        : "";
      const works = attRec?.works || "";

      if (dayStock.length > 0) {
        dayStock.forEach(e => rows.push([date, workerNames, works, e.name || "", e.code || "", e.qty ?? "", e.unit || ""]));
      } else {
        rows.push([date, workerNames, works, "", "", "", ""]);
      }
    }

    if (rows.length === 1) {
      return res.status(200).json({ skipped: true, reason: `Sem dados entre ${fromDate} e ${toDate}.` });
    }

    const csvContent = toCSV(rows);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `ObraControl <${smtpUser}>`,
      to: recipientEmail,
      subject: `ObraControl · Relatório Semanal ${fromDate} → ${toDate}${force ? " (envio manual)" : ""}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;color:#1e293b">
          <h2 style="color:#6366f1">📊 Relatório Semanal · ObraControl</h2>
          <p>Semana de <strong>${fromDate}</strong> a <strong>${toDate}</strong>.</p>
          <p>Em anexo o CSV com a folha de ponto e materiais utilizados.</p>
          ${force ? '<p style="color:#f59e0b">⚡ Enviado manualmente.</p>' : ""}
          <p style="color:#94a3b8;font-size:12px">ObraControl · envio automático semanal</p>
        </div>`,
      attachments: [{
        filename: `relatorio_${fromDate}_${toDate}.csv`,
        content: Buffer.from(csvContent, "utf-8"),
        contentType: "text/csv",
      }],
    });

    // Mark as sent (store today's date)
    const today = new Date().toISOString().slice(0, 10);
    await firebaseSet("config/reportLastSent", today);

    return res.status(200).json({
      success: true,
      period: `${fromDate} → ${toDate}`,
      dataRows: rows.length - 1,
      recipient: recipientEmail,
      forced: force,
    });

  } catch (err) {
    console.error("weekly-report error:", err);
    return res.status(500).json({ error: err.message });
  }
};

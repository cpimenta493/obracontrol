const nodemailer = require("nodemailer");

const FIREBASE_URL = "https://obra-posto-medico-default-rtdb.europe-west1.firebasedatabase.app";

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return Object.values(val).filter(Boolean);
}

function toCSV(rows) {
  // sep=; tells Excel to use semicolon as delimiter (European locale)
  // BOM (﻿) ensures correct encoding in Excel
  const body = rows
    .map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  return "﻿sep=;\n" + body;
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

// Calculate total hours from workerHours object
function calcTotalHours(wh) {
  if (!wh || !wh.in || !wh.out) return "";
  const [ih, im] = wh.in.split(":").map(Number);
  const [oh, om] = wh.out.split(":").map(Number);
  let totalMins = (oh * 60 + om) - (ih * 60 + im);
  if (wh.break) totalMins -= parseInt(wh.break) || 0;
  if (totalMins <= 0) return "";
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h${m > 0 ? String(m).padStart(2, "0") + "m" : ""}`;
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
      // Portugal timezone: UTC+1 winter / UTC+2 summer (DST roughly Mar–Oct)
      const nowUTC = new Date();
      const month = nowUTC.getUTCMonth() + 1; // 1–12
      const ptOffset = (month >= 3 && month <= 10) ? 2 : 1;
      const ptTime = new Date(nowUTC.getTime() + ptOffset * 3600000);
      const ptDay  = ptTime.getUTCDay(); // 0=Sun, 1=Mon…

      const configDay = parseInt(config.reportDay ?? 1); // default Monday

      // Only check the day (not the hour) — cron handles timing, reportLastSent prevents duplicates
      if (ptDay !== configDay) {
        return res.status(200).json({ skipped: true, reason: `Não é o dia configurado (config: dia ${configDay}; hoje: dia ${ptDay} PT).` });
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

    const attDates   = [...new Set(weekAtt.filter(a => (a.present || []).length > 0).map(a => a.date))].sort();
    const stockDates = [...new Set(weekStock.map(e => e.date))].sort();

    // ── Tabela 1: Funcionários ──────────────────────────────────
    // Estrutura igual ao xlsx: Data e Trabalhos só na 1ª linha de cada dia (simula células mescladas)
    const t1 = [["Data", "Hora Entrada", "Intervalo (min)", "Hora Saída", "Total Horas", "Funcionários", "Trabalhos Realizados"]];
    for (const date of attDates) {
      const attRec = weekAtt.find(a => a.date === date);
      if (!attRec) continue;
      const presentIds     = attRec.present || [];
      const workerNamesMap = attRec.workerNames || {};
      const works          = attRec.works || "";
      presentIds.forEach((id, idx) => {
        const live = workers.find(w => w.id === id);
        const name = live?.name || workerNamesMap[id] || id;
        const wh   = (attRec.workerHours || {})[id] || {};
        // Data e Trabalhos apenas na 1ª linha do dia (como célula mesclada)
        t1.push([
          idx === 0 ? date : "",
          wh.in || "",
          wh.break || "",
          wh.out || "",
          calcTotalHours(wh),
          name,
          idx === 0 ? works : "",
        ]);
      });
    }

    // ── Tabela 2: Materiais ─────────────────────────────────────
    // Data só na 1ª linha de cada dia
    const t2 = [["Data", "Material", "Código", "Quantidade", "Unidade"]];
    for (const date of stockDates) {
      weekStock.filter(e => e.date === date).forEach((e, idx) => {
        t2.push([idx === 0 ? date : "", e.name || "", e.code || "", e.qty ?? "", e.unit || ""]);
      });
    }

    const hasT1 = t1.length > 1;
    const hasT2 = t2.length > 1;
    if (!hasT1 && !hasT2) {
      return res.status(200).json({ skipped: true, reason: `Sem dados entre ${fromDate} e ${toDate}.` });
    }

    // Combine: Tabela 1, linha vazia, Tabela 2
    let allRows = [];
    if (hasT1) allRows = [...t1];
    if (hasT1 && hasT2) allRows.push([]);
    if (hasT2) allRows = [...allRows, ...t2];

    const csvContent = toCSV(allRows);
    const dataRows   = (t1.length - 1) + (t2.length - 1);

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
      dataRows,
      recipient: recipientEmail,
      forced: force,
    });

  } catch (err) {
    console.error("weekly-report error:", err);
    return res.status(500).json({ error: err.message });
  }
};

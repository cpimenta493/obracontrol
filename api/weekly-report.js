const nodemailer = require("nodemailer");

const FIREBASE_URL = "https://obra-posto-medico-default-rtdb.europe-west1.firebasedatabase.app";

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return Object.values(val).filter(Boolean);
}

function toCSV(rows) {
  return rows
    .map(row =>
      row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
}

function lastWeekRange() {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun 1=Mon…
  // Days to go back to reach last Monday
  const daysBack = dow === 0 ? 13 : dow + 6;
  const lastMon = new Date(now);
  lastMon.setDate(now.getDate() - daysBack);
  const lastSun = new Date(lastMon);
  lastSun.setDate(lastMon.getDate() + 6);
  const fmt = d => d.toISOString().slice(0, 10);
  return { from: fmt(lastMon), to: fmt(lastSun) };
}

module.exports = async function handler(req, res) {
  // Allow GET (for manual test) and cron trigger
  const authHeader = req.headers["authorization"];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Read Firebase data
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
      return res.status(200).json({ message: "Nenhum email configurado. Define em ObraControl → Config." });
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass) {
      return res.status(500).json({ error: "SMTP_USER ou SMTP_PASS não definidos nas variáveis de ambiente do Vercel." });
    }

    // Date range: previous week Mon–Sun
    const { from: fromDate, to: toDate } = lastWeekRange();

    const weekAtt   = attendance.filter(a => a.date >= fromDate && a.date <= toDate);
    const weekStock = stock.filter(e => e.date >= fromDate && e.date <= toDate);

    // Collect all dates with data
    const allDates = [
      ...new Set([...weekAtt.map(a => a.date), ...weekStock.map(e => e.date)]),
    ].sort();

    // Build CSV
    const rows = [["Data", "Funcionários", "Trabalhos Realizados", "Material", "Código", "Quantidade", "Unidade"]];

    for (const date of allDates) {
      const attRec   = weekAtt.find(a => a.date === date);
      const dayStock = weekStock.filter(e => e.date === date);

      const workerNames = attRec
        ? workers.filter(w => (attRec.present || []).includes(w.id)).map(w => w.name).join(", ")
        : "";
      const works = attRec?.works || "";

      if (dayStock.length > 0) {
        dayStock.forEach(e => {
          rows.push([date, workerNames, works, e.name || "", e.code || "", e.qty ?? "", e.unit || ""]);
        });
      } else {
        rows.push([date, workerNames, works, "", "", "", ""]);
      }
    }

    if (rows.length === 1) {
      return res.status(200).json({ message: "Sem dados na semana anterior. Email não enviado." });
    }

    const csvContent = toCSV(rows);

    // Send email via Gmail SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `ObraControl <${smtpUser}>`,
      to: recipientEmail,
      subject: `ObraControl · Relatório Semanal ${fromDate} → ${toDate}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
          <h2 style="color:#6366f1">📊 Relatório Semanal · ObraControl</h2>
          <p>Semana de <strong>${fromDate}</strong> a <strong>${toDate}</strong>.</p>
          <p>Em anexo encontras o CSV com:</p>
          <ul>
            <li>Folha de ponto — funcionários presentes e trabalhos realizados</li>
            <li>Materiais utilizados (Registar Uso)</li>
          </ul>
          <p style="color:#94a3b8;font-size:12px">Enviado automaticamente pelo ObraControl todas as segundas-feiras.</p>
        </div>
      `,
      attachments: [{
        filename: `relatorio_${fromDate}_${toDate}.csv`,
        content: Buffer.from(csvContent, "utf-8"),
        contentType: "text/csv",
      }],
    });

    return res.status(200).json({
      success: true,
      period: `${fromDate} → ${toDate}`,
      dataRows: rows.length - 1,
      recipient: recipientEmail,
    });

  } catch (err) {
    console.error("weekly-report error:", err);
    return res.status(500).json({ error: err.message });
  }
};

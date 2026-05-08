const nodemailer  = require("nodemailer");
const XLSXStyle   = require("xlsx-js-style");

const FIREBASE_URL = "https://obra-posto-medico-default-rtdb.europe-west1.firebasedatabase.app";

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return Object.values(val).filter(Boolean);
}

function previousWeekRange() {
  const now = new Date();
  const dow = now.getUTCDay();
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

async function firebaseSet(path, value) {
  await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

function fmtDatePT(d) {
  if (!d) return "";
  const p = d.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

const BORDER = {
  top:    { style: "thin", color: { rgb: "000000" } },
  left:   { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  right:  { style: "thin", color: { rgb: "000000" } },
};
const HDR  = { font: { name: "Arial", sz: 11, bold: true }, fill: { patternType: "solid", fgColor: { rgb: "C9DAF8" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: BORDER };
const DATA = { font: { name: "Arial", sz: 10 }, fill: { patternType: "none" }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: BORDER };

function sc(ws, col, row, value, style) {
  ws[`${col}${row}`] = { v: value, t: typeof value === "number" ? "n" : "s", s: style };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const force = req.query?.force === "true";

  if (!force) {
    const authHeader = req.headers["authorization"];
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
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
      const nowUTC   = new Date();
      const month    = nowUTC.getUTCMonth() + 1;
      const ptOffset = (month >= 3 && month <= 10) ? 2 : 1;
      const ptTime   = new Date(nowUTC.getTime() + ptOffset * 3600000);
      const ptDay    = ptTime.getUTCDay();
      const configDay = parseInt(config.reportDay ?? 1);
      if (ptDay !== configDay) {
        return res.status(200).json({ skipped: true, reason: `Não é o dia configurado (config: dia ${configDay}; hoje: dia ${ptDay} PT).` });
      }
      const { thisMon } = previousWeekRange();
      if (config.reportLastSent && config.reportLastSent >= thisMon) {
        return res.status(200).json({ skipped: true, reason: "Relatório já enviado esta semana." });
      }
    }

    const { from: fromDate, to: toDate } = previousWeekRange();
    const weekAtt   = attendance.filter(a => a.date >= fromDate && a.date <= toDate);
    const weekStock = stock.filter(e => e.date >= fromDate && e.date <= toDate);

    const attDates   = [...new Set(weekAtt.filter(a => (a.present || []).length > 0).map(a => a.date))].sort();
    const stockDates = [...new Set(weekStock.map(e => e.date))].sort();

    if (!attDates.length && !stockDates.length) {
      return res.status(200).json({ skipped: true, reason: `Sem dados entre ${fromDate} e ${toDate}.` });
    }

    // ── Build Excel ──────────────────────────────────────────────
    const ws     = {};
    const merges = [];

    // A vazio | B Data | C Funcionários | D Hora Entrada | E Hora Saída | F Trabalhos
    // Table 2 reutiliza B-F: B Data | C Código | D Material | E Qtd | F Unidade
    ws["!cols"] = [
      { wch: 2  },  // A
      { wch: 11 },  // B  Data
      { wch: 20 },  // C  Funcionários / Código
      { wch: 35 },  // D  Hora Entrada / Material
      { wch: 12 },  // E  Hora Saída   / Quantidade
      { wch: 50 },  // F  Trabalhos    / Unidade
    ];

    // ── TABLE 1: Trabalhos ──
    sc(ws, "B", 1, "Data",                HDR);
    sc(ws, "C", 1, "Funcionários",        HDR);
    sc(ws, "D", 1, "Hora Entrada",        HDR);
    sc(ws, "E", 1, "Hora Saída",          HDR);
    sc(ws, "F", 1, "Trabalhos Realizados",HDR);

    let row      = 2;
    let dataRows = 0;

    for (const date of attDates) {
      const attRec = weekAtt.find(a => a.date === date);
      if (!attRec) continue;
      const presentIds     = attRec.present || [];
      const workerNamesMap = attRec.workerNames || {};
      const works          = attRec.works || "";
      const startRow       = row;

      presentIds.forEach((id, idx) => {
        const live = workers.find(w => w.id === id);
        const name = live?.name || workerNamesMap[id] || id;
        const wh   = (attRec.workerHours || {})[id] || {};

        sc(ws, "B", row, idx === 0 ? fmtDatePT(date) : "", DATA);
        sc(ws, "C", row, name,                             DATA);
        sc(ws, "D", row, wh.in  || "",                    DATA);
        sc(ws, "E", row, wh.out || "",                    DATA);
        sc(ws, "F", row, idx === 0 ? works : "",          DATA);
        row++;
        dataRows++;
      });

      if (presentIds.length > 1) {
        merges.push({ s: { r: startRow - 1, c: 1 }, e: { r: row - 2, c: 1 } }); // B
        merges.push({ s: { r: startRow - 1, c: 5 }, e: { r: row - 2, c: 5 } }); // F
      }
    }

    // ── TABLE 2: Materiais ──
    const t2Start  = Math.max(11, row + 1);
    sc(ws, "B", t2Start, "Data",       HDR);
    sc(ws, "C", t2Start, "Código",     HDR);
    sc(ws, "D", t2Start, "Material",   HDR);
    sc(ws, "E", t2Start, "Quantidade", HDR);
    sc(ws, "F", t2Start, "Unidade",    HDR);

    const matByDate = {};
    weekStock.forEach(e => { if (!matByDate[e.date]) matByDate[e.date] = []; matByDate[e.date].push(e); });

    let matRow = t2Start + 1;
    for (const date of stockDates) {
      const mats     = matByDate[date] || [];
      const startRow = matRow;
      mats.forEach((e, idx) => {
        sc(ws, "B", matRow, idx === 0 ? fmtDatePT(date) : "",                           DATA);
        sc(ws, "C", matRow, e.code || "",                                                DATA);
        sc(ws, "D", matRow, e.name || "",                                                DATA);
        sc(ws, "E", matRow, typeof e.qty === "number" ? e.qty : (parseFloat(e.qty)||0), DATA);
        sc(ws, "F", matRow, e.unit || "",                                                DATA);
        matRow++;
        dataRows++;
      });
      if (mats.length > 1) merges.push({ s: { r: startRow - 1, c: 1 }, e: { r: matRow - 2, c: 1 } });
    }

    ws["!merges"] = merges;
    ws["!ref"]    = `A1:F${Math.max(matRow - 1, t2Start)}`;

    const sheetName = `relatorio_${fromDate.replace(/-/g,"")}_${toDate.replace(/-/g,"")}`.slice(0, 31);
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, sheetName);

    const xlsxBuf = Buffer.from(XLSXStyle.write(wb, { bookType: "xlsx", type: "array" }));

    // ── Enviar email ─────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || "smtp.gmail.com",
      port:   parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth:   { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from:    `ObraControl <${smtpUser}>`,
      to:      recipientEmail,
      subject: `ObraControl · Relatório Semanal ${fromDate} → ${toDate}${force ? " (envio manual)" : ""}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;color:#1e293b">
          <h2 style="color:#6366f1">📊 Relatório Semanal · ObraControl</h2>
          <p>Semana de <strong>${fromDate}</strong> a <strong>${toDate}</strong>.</p>
          <p>Em anexo o ficheiro Excel (.xlsx) com a folha de ponto e materiais utilizados.</p>
          ${force ? '<p style="color:#f59e0b">⚡ Enviado manualmente.</p>' : ""}
          <p style="color:#94a3b8;font-size:12px">ObraControl · envio automático semanal</p>
        </div>`,
      attachments: [{
        filename:    `relatorio_${fromDate}_${toDate}.xlsx`,
        content:     xlsxBuf,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }],
    });

    const today = new Date().toISOString().slice(0, 10);
    await firebaseSet("config/reportLastSent", today);

    return res.status(200).json({
      success:   true,
      period:    `${fromDate} → ${toDate}`,
      dataRows,
      recipient: recipientEmail,
      forced:    force,
    });

  } catch (err) {
    console.error("weekly-report error:", err);
    return res.status(500).json({ error: err.message });
  }
};

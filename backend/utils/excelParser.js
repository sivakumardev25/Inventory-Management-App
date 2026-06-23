// excelParser.js — reads uploaded billing Excel, validates every row
const XLSX = require("xlsx");

const HEADER_MAP = {
  "client name": "clientName",
  name: "clientName",
  "customer name": "clientName",

  phone: "phone",
  mobile: "phone",
  "mobile no": "phone",
  "m.no": "phone",
  mno: "phone",
  contact: "phone",

  address: "address",

  "invoice no": "invoiceNo",
  "inv no": "invoiceNo",
  "invoice number": "invoiceNo",

  period: "period",
  "billing period": "period",

  "period start": "periodStart",
  from: "periodStart",

  "period end": "periodEnd",

  "bill date": "billDate",
  date: "billDate",

  "shop no": "shopNo",
  "shop number": "shopNo",

  "owner party id": "ownerPartyId",
  "owner id": "ownerPartyId",

  "account no": "accountNo",
  "account number": "accountNo",
  "ac number": "accountNo",

  ifsc: "ifsc",
  "ifsc code": "ifsc",

  particulars: "particulars1",
  "particulars 1": "particulars1",
  particulars1: "particulars1",

  qty: "qty1",
  quantity: "qty1",
  "qty 1": "qty1",
  qty1: "qty1",

  rate: "rate1",
  "rate 1": "rate1",
  rate1: "rate1",

  amount: "amount1",
  "amount 1": "amount1",
  amount1: "amount1",

  "particulars 2": "particulars2",
  particulars2: "particulars2",

  "qty 2": "qty2",
  qty2: "qty2",

  "rate 2": "rate2",
  rate2: "rate2",

  "amount 2": "amount2",
  amount2: "amount2",

  "particulars 3": "particulars3",
  particulars3: "particulars3",

  "qty 3": "qty3",
  qty3: "qty3",

  "rate 3": "rate3",
  rate3: "rate3",

  "amount 3": "amount3",
  amount3: "amount3",

  notes: "notes",
};

function normHeader(h) {
  return String(h).toLowerCase().trim().replace(/\s+/, " ");
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val) ? null : val;
  if (typeof val === "number") {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d) ? null : d;
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m)
    return new Date(
      `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`,
    );
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function cleanPhone(val) {
  if (!val) return "";
  return String(val).replace(/\D/g, "").slice(-10);
}

function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (raw.length < 2) throw new Error("Excel has no data rows");

  const headers = raw[0].map(normHeader);
  const fieldMap = {};
  headers.forEach((h, i) => {
    const f = HEADER_MAP[h];
    if (f) fieldMap[i] = f;
  });

  const rows = [];
  for (let ri = 1; ri < raw.length; ri++) {
    const row = raw[ri];
    if (row.every((c) => String(c).trim() === "")) continue;

    const r = {};
    Object.entries(fieldMap).forEach(([ci, field]) => {
      r[field] = row[ci];
    });

    const errors = [],
      warnings = [];

    if (!r.clientName || !String(r.clientName).trim())
      errors.push("Missing client name");

    const phone = cleanPhone(r.phone);
    if (!phone || phone.length !== 10)
      errors.push("Missing or invalid phone number (need 10 digits)");
    else r.phone = phone;

    // Build items (up to 3 product lines)
    const items = [];
    for (let n = 1; n <= 3; n++) {
      const p = String(r[`particulars${n}`] || "").trim();
      const q = parseFloat(r[`qty${n}`]) || 0;
      const rate = parseFloat(r[`rate${n}`]) || 0;
      if (p && q && rate) {
        const computed = Math.round(q * rate * 100) / 100;
        const amt = parseFloat(r[`amount${n}`]) || 0;
        if (amt && Math.abs(amt - computed) > 0.5)
          warnings.push(
            `"${p}" amount ${amt} ≠ Qty×Rate ${computed} — using computed`,
          );
        items.push({ particulars: p, quantity: q, rate, amount: computed });
      }
    }
    if (!items.length)
      errors.push("No valid product line (need Particulars, Qty, Rate)");

    // Parse period
    let periodStart = parseDate(r.periodStart),
      periodEnd = parseDate(r.periodEnd);
    if (!periodStart && r.period) {
      const parts = String(r.period).split(/\s+to\s+/i);
      if (parts.length === 2) {
        periodStart = parseDate(parts[0].trim());
        periodEnd = parseDate(parts[1].trim());
      } else {
        const d = new Date(r.period);
        if (!isNaN(d)) {
          periodStart = new Date(d.getFullYear(), d.getMonth(), 1);
          periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        }
      }
    }
    if (!periodStart) warnings.push("Period not detected — will use today");

    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const grandTotal = subtotal;

    rows.push({
      rowIndex: ri + 1,
      clientName: String(r.clientName || "").trim(),
      phone,
      address: String(r.address || "").trim(),
      shopNo: String(r.shopNo || "").trim(),
      ownerPartyId: String(r.ownerPartyId || "").trim(),
      invoiceNo: r.invoiceNo ? String(r.invoiceNo).trim() : null,
      billDate: parseDate(r.billDate) || new Date(),
      periodStart: periodStart || new Date(),
      periodEnd: periodEnd || new Date(),
      items,
      subtotal,
      grandTotal,
      notes: String(r.notes || "").trim(),
      errors,
      warnings,
      valid: errors.length === 0,
    });
  }

  return {
    rows,
    totalRows: rows.length,
    validCount: rows.filter((r) => r.valid).length,
    errorCount: rows.filter((r) => !r.valid).length,
    warningCount: rows.filter((r) => r.warnings.length > 0).length,
  };
}

module.exports = { parseExcel };

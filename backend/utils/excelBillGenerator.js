// excelBillGenerator.js — generates Aavin-format Excel bill using ExcelJS
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const { numberToWords } = require("./numberToWords");
const LEFT_LOGO_PATH = path.join(__dirname, "../assets/aavin-logo.jpg"); //path.join(__dirname, "../assets/aavin-logo.jpg");
const RIGHT_LOGO_PATH = path.join(__dirname, "../assets/Aavin1.jpg"); //path.join(__dirname, "../assets/Aavin1.png");
const STORE = require("../config/storeConfig");

// const STORE = {
//   name: process.env.STORE_NAME || "PATTATHARI PALAGAM",
//   subtitle: process.env.STORE_SUBTITLE || "AAVIN PALAGAM",
//   shop_address: process.env.STORE_SHOP_ADDRESS || "",
//   mobile: process.env.STORE_MOBILE || "",
//   ownerId: process.env.STORE_OWNER_PARTY_ID || "F2670",
//   shopNo: process.env.STORE_SHOP_NO || "SR 67",
//   account: process.env.STORE_ACCOUNT || "XXXXXXXXXXXX",
//   ifsc: process.env.STORE_IFSC || "XXXXXXXXXX",
//    gpay: process.env.STORE_GPAY || "XXXXXXXXXXXX",
// };

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

function merge(ws, a, b) {
  ws.mergeCells(`${a}:${b}`);
}
function c(ws, addr) {
  return ws.getCell(addr);
}

function fill(cell, argb) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}
function border(cell, col = "FF000000", style = "thin") {
  const b = { style, color: { argb: col } };
  cell.border = { top: b, left: b, bottom: b, right: b };
}
function font(cell, opts) {
  cell.font = { name: "Arial", ...opts };
}
function align(cell, h = "left", v = "middle") {
  cell.alignment = { horizontal: h, vertical: v };
}

async function generateBillExcel(bill, client) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Invoice", {
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4 },
    },
  });

  ws.columns = [
    { key: "A", width: 12 },
    { key: "B", width: 12 },
    { key: "C", width: 20 },
    { key: "D", width: 20 },
    { key: "E", width: 12 },
  ];

  let r = 1;

  /* ─── ROW 1-5: Header box──────────────────────────────────────────────────────────── */
  // Outer border for whole header
  /* ─── HEADER WITH LEFT LOGO, CENTER TITLE, RIGHT LOGO ─── */

  // Header row
  ws.getRow(r).height = 70;

  // Left logo area
  merge(ws, `A${r}`, `B${r}`);

  // Center heading area
  merge(ws, `C${r}`, `D${r}`);

  // Right logo area
  merge(ws, `E${r}`, `E${r}`);

  // Add LEFT logo
  if (fs.existsSync(LEFT_LOGO_PATH)) {
    const leftLogoId = wb.addImage({
      filename: LEFT_LOGO_PATH,
      extension: "jpeg", // Important: aavin-logo.jpg
    });

    ws.addImage(leftLogoId, {
      tl: {
        col: 0.15,
        row: r - 1 + 0.15,
      },
      ext: {
        width: 85,
        height: 55,
      },
    });
  }

  // Center title
  const title = c(ws, `C${r}`);

  title.value = STORE.name;

  font(title, {
    bold: true,
    size: 18,
    color: { argb: "FFCC0000" },
  });

  align(title, "center", "middle");
  fill(title, "FFFFFFFF");

  // Add RIGHT logo
  if (fs.existsSync(RIGHT_LOGO_PATH)) {
    const rightLogoId = wb.addImage({
      filename: RIGHT_LOGO_PATH,
      extension: "jpeg", // Aavin1.png
    });

    ws.addImage(rightLogoId, {
      tl: {
        col: 4.05,
        row: r - 1 + 0.15,
      },
      ext: {
        width: 70,
        height: 50,
      },
    });
  }

  r++;

  // Subtitle row
  ws.getRow(r).height = 25;
  merge(ws, `A${r}`, `E${r}`);

  const sub = c(ws, `A${r}`);
  sub.value = STORE.subtitle;

  font(sub, {
    bold: true,
    size: 14,
    color: { argb: "FF1F3864" },
  });

  align(sub, "center", "middle");
  fill(sub, "FFFFFFFF");

  r++;
  
  /* ─── INVOICE/CASH/CHEQUE BILL ────────────────────────────────────────── */
  ws.getRow(r).height = 18;
  merge(ws, `A${r}`, `E${r}`);
  const invTtl = c(ws, `A${r}`);
  invTtl.value = "INVOICE / CASH / CHEQUE BILL";
  font(invTtl, { bold: true, size: 11 });
  align(invTtl, "center");
  fill(invTtl, "FFFFFFFF");
  border(invTtl);
  r++;

  /* ─── Client + Invoice detail rows ───────────────────────────────────── */
  // Row: TO + Invoice No label + Invoice No value
  // Period label line (e.g. "TO ; feb")
  const month = new Date(bill.periodStart || Date.now())
    .toLocaleString("en-IN", { month: "long" })
    .toLowerCase();
  const detailRows = [
    [
      `To: ${client.name || "", "", "", ""}`,
      //  ${month}`,
      `Period: ${fmtDate(bill.periodStart)} to ${fmtDate(bill.periodEnd)}`,
      "Invoice No.",
      bill.invoiceNo || bill.billId,
    ],
    [
      
      "",
      "",
      "Date:",
      fmtDate(bill.billDate),
    ],
    ["", "", "Owner Party Id:", client.ownerPartyId || STORE.ownerId],
    [
      `Mobile No.:  ${client.mobileNo || client.phone || ""}`,
      "",
      "Shop No.:",
      client.shopNo || STORE.shopNo,
    ],
    [`Address: {$client.address || "", "", "", ""}`],
  ];

  detailRows.forEach(([lVal, , rLabel, rVal], i) => {
    ws.getRow(r).height = 16;
    merge(ws, `A${r}`, `B${r}`);
    const lc = c(ws, `A${r}`);
    lc.value = lVal;
    font(lc, { bold: i < 4, size: 9 });
    align(lc, "left");
    border(lc);
    const rlc = c(ws, `C${r}`);
    rlc.value = rLabel || "";
    font(rlc, { bold: true, size: 9 });
    align(rlc, "left");
    border(rlc);
    merge(ws, `D${r}`, `E${r}`);
    const rvc = c(ws, `D${r}`);
    rvc.value = rVal || "";
    font(rvc, { bold: true, size: 9 });
    align(rvc, "center");
    border(rvc);
    r++;
  });

  /* ─── Table header ────────────────────────────────────────────────────── */
  ws.getRow(r).height = 20;
  ["S.No.", "Particulars", "Qty", "Rate", "Amount"].forEach((h, i) => {
    const tc = c(ws, `${"ABCDE"[i]}${r}`);
    tc.value = h;
    font(tc, { bold: true, size: 11, color: { argb: "FFFFFFFF" } });
    fill(tc, "FF1F3864");
    align(tc, "center");
    border(tc, "FFFFFFFF");
  });
  r++;

  /* ─── Item rows (10 fixed) ────────────────────────────────────────────── */
  for (let i = 0; i < 10; i++) {
    ws.getRow(r).height = 15;
    const item = bill.items[i];
    const vals = item
      ? [
          i + 1,
          item.particulars,
          item.quantity,
          { value: item.rate, numFmt: "#,##0.00" },
          { value: item.amount, numFmt: "#,##0.00" },
        ]
      : ["", "", "", "", ""];
    const alignments = ["center", "left", "center", "right", "right"];
    "ABCDE".split("").forEach((col, ci) => {
      const tc = c(ws, `${col}${r}`);
      const v = vals[ci];
      if (v && typeof v === "object") {
        tc.value = v.value;
        tc.numFmt = v.numFmt;
      } else tc.value = v;
      font(tc, { size: 10 });
      // align(tc, ci >= 2 ? "right" : "left");
      align(tc, alignments[ci]);
      fill(tc, i % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB");
      border(tc);
    });
    r++;
  }

  /* ─── Subtotal ────────────────────────────────────────────────────────── */
  ws.getRow(r).height = 17;
  merge(ws, `A${r}`, `C${r}`);
  border(c(ws, `A${r}`));
  const slbl = c(ws, `D${r}`);
  slbl.value = "SUBTOTAL";
  font(slbl, { bold: true, size: 10, italic: true });
  align(slbl, "center");
  fill(slbl, "FFF5F5F5");
  border(slbl);
  const sval = c(ws, `E${r}`);
  sval.value = bill.subtotal;
  sval.numFmt = "#,##0.00";
  font(sval, { bold: true, size: 10 });
  align(sval, "right");
  fill(sval, "FFF5F5F5");
  border(sval);
  r++;

  /* ─── Grand total ─────────────────────────────────────────────────────── */
  ws.getRow(r).height = 22;
  merge(ws, `A${r}`, `C${r}`);
  border(c(ws, `A${r}`));
  const glbl = c(ws, `D${r}`);
  glbl.value = "GRAND  TOTAL";
  font(glbl, { bold: true, size: 11 });
  align(glbl, "center");
  border(glbl);
  const gval = c(ws, `E${r}`);
  gval.value = `Rs.${Number(bill.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  font(gval, { bold: true, size: 12, color: { argb: "FFFFFFFF" } });
  fill(gval, "FF1F3864");
  align(gval, "center");
  border(gval, "FFFFFFFF");
  r++;

  /* ─── Amount in words ─────────────────────────────────────────────────── */
  ws.getRow(r).height = 18;
  merge(ws, `A${r}`, `E${r}`);
  const wc = c(ws, `A${r}`);
  wc.value = `Rupees (In Words) :     ${bill.grandTotalWords || numberToWords(bill.grandTotal)}`;
  font(wc, { bold: true, size: 10 });
  align(wc, "left");
  border(wc);
  r++;

  /* ─── Account row (yellow) ────────────────────────────────────────────── */
  ws.getRow(r).height = 18;
  const acL = c(ws, `A${r}`);
  acL.value = "A/C NUMBER";
  font(acL, { bold: true, size: 10, color: { argb: "FFCC0000" } });
  fill(acL, "FFFFFF00");
  align(acL, "center");
  border(acL);
  merge(ws, `B${r}`, `C${r}`);
  const acV = c(ws, `B${r}`);
  acV.value = STORE.account;
  font(acV, { bold: true, size: 10 });
  fill(acV, "FFFFFF00");
  align(acV, "center");
  border(acV);
  const ifL = c(ws, `D${r}`);
  ifL.value = "IFSC :";
  font(ifL, { bold: true, size: 10, color: { argb: "FFCC0000" } });
  fill(ifL, "FFFFFF00");
  align(ifL, "center");
  border(ifL);
  const ifV = c(ws, `E${r}`);
  ifV.value = STORE.ifsc;
  font(ifV, { bold: true, size: 10 });
  fill(ifV, "FFFFFF00");
  align(ifV, "center");
  border(ifV);
  r++;

  /* ─── Notes + signature ───────────────────────────────────────────────── */
  ws.getRow(r).height = 16;
  merge(ws, `A${r}`, `C${r}`);
  border(c(ws, `A${r}`));
  merge(ws, `D${r}`, `E${r}`);
  const forC = c(ws, `D${r}`);
  forC.value = "For";
  font(forC, { size: 10 });
  align(forC, "right");
  border(forC);
  r++;
  ws.getRow(r).height = 16;
  merge(ws, `A${r}`, `C${r}`);
  const nc = c(ws, `A${r}`);
  nc.value =
    "Notes:  If paying via bank transfer, GPay, PhonePe, or Paytm, please share the transaction screenshot for payment verification.";
  font(nc, { bold: true, size: 8 });
  nc.alignment = { wrapText: true, vertical: "middle", indent: 1 };
  border(nc);
  merge(ws, `D${r}`, `E${r}`);
  border(c(ws, `D${r}`));
  r++;
  ws.getRow(r).height = 20;
  merge(ws, `A${r}`, `C${r}`);
  border(c(ws, `A${r}`));
  merge(ws, `D${r}`, `E${r}`);
  const sc = c(ws, `D${r}`);
  sc.value = "Authorized Signature";
  font(sc, { bold: true, size: 10 });
  align(sc, "right");
  border(sc);

  /* ─── Save ────────────────────────────────────────────────────────────── */
  const dir = path.join(__dirname, "../uploads/bills");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${bill.billId}_${(client.name || "client").replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
  const filepath = path.join(dir, filename);
  await wb.xlsx.writeFile(filepath);
  return { filePath: filepath, fileName: filename };
}

module.exports = { generateBillExcel };
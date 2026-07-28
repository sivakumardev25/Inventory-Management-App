// pdfBillGenerator.js — generates Aavin-format PDF bill using pdfkit
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { numberToWords } = require("./numberToWords");

const LEFT_LOGO_PATH = path.join(__dirname, "../assets/aavin-logo.jpg"); 
const RIGHT_LOGO_PATH = path.join(__dirname, "../assets/Aavin1.jpg"); 
const SIGNATURE_PATH = path.join(__dirname,  "../assets/sign.jpg");
const STORE = require("../config/storeConfig");

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return [
    String(dt.getDate()).padStart(2, "0"),
    String(dt.getMonth() + 1).padStart(2, "0"),
    dt.getFullYear(),
  ].join("/");
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function generateBillPDF(bill, client) {
  return new Promise((resolve, reject) => {
    try {
      const items = Array.isArray(bill.items) ? bill.items : [];
      const grandTotal = Number(bill.grandTotal || 0);
      const subtotal = Number(bill.subtotal || 0);

      const dir = path.join(__dirname, "../uploads/bills");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const safeName = (client.name || "client").replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `${bill.billId}_${safeName}.pdf`;
      const filepath = path.join(dir, filename);

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 30, bottom: 30, left: 35, right: 35 },
        info: { Title: `Invoice #${bill.invoiceNo}`, Author: STORE.name },
      });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      const W = 525; // usable page width
      const LM = 35; // left margin
      let Y = 30;

      // Remember where the invoice starts so we can draw the outer
      // border around the real content height at the very end, instead
      // of guessing a fixed number that breaks whenever content length
      // changes (e.g. a longer shop address).
      const borderTopY = Y - 5;
      /* ─── helpers ─────────────────────────────────────────────────────── */
      const fillRect = (x, y, w, h, color) =>
        doc.rect(x, y, w, h).fillColor(color).fill();

      const hline = (y, color = "#000", lw = 0.5) =>
        doc
          .moveTo(LM, y)
          .lineTo(LM + W, y)
          .strokeColor(color)
          .lineWidth(lw)
          .stroke();

      const vline = (x, y1, y2, color = "#000", lw = 0.5) =>
        doc
          .moveTo(x, y1)
          .lineTo(x, y2)
          .strokeColor(color)
          .lineWidth(lw)
          .stroke();

      /* ─── outer border ────────────────────────────────────────────────── */
      // Wraps the whole invoice, not just the header — must use the page's
      
      // doc
      //   .rect(LM - 5, Y - 5, W + 10, 470)
      //   .strokeColor("#000")
      //   .lineWidth(1.5)
      //   .stroke();


      /* ─── header ──────────────────────────────────────────────────────── */
      // Header height
      const headerY = Y;
      const logoWidth = 65;
      const logoHeight = 45;

      // LEFT LOGO
      if (fs.existsSync(LEFT_LOGO_PATH)) {
        doc.image(LEFT_LOGO_PATH, LM, headerY + 3, {
          fit: [logoWidth, logoHeight],
          align: "center",
          valign: "center",
        });
      }
      
      // CENTER HEADING — each line now gets its own Y position instead of
      // all three sharing headerY + 29, which caused them to overlap.
      doc
        .fontSize(18)
        .fillColor("#CC0000")
        .font("Helvetica-Bold")
        .text(STORE.name, LM + 70, headerY, {
          width: W - 140,
          align: "center",
        });

      doc
        .fontSize(11)
        .fillColor("#1F3864")
        .font("Helvetica-Bold")
        .text(STORE.subtitle, LM + 70, headerY + 22, {
          width: W - 140,
          align: "center",
        });
      if (STORE.address) {
        doc
          .fontSize(7.5)
          .fillColor("#1F3864")
          .font("Helvetica")
          .text(STORE.address, LM + 70, headerY + 36, {
            width: W - 140,
            align: "center",
          });
      }
      if (STORE.mobile) {
        doc
          .fontSize(7.5)
          .fillColor("#1F3864")
          .font("Helvetica")
          .text(`Mobile: ${STORE.mobile}`, LM + 70, headerY + 47, {
            width: W - 140,
            align: "center",
          });
      }
      // RIGHT LOGO
      if (fs.existsSync(RIGHT_LOGO_PATH)) {
        doc.image(RIGHT_LOGO_PATH, LM + W - 65, headerY + 3, {
          fit: [logoWidth, logoHeight],
          align: "center",
          valign: "center",
        });
      }

      Y += 60;
      hline(Y, "#000", 1.5);

      /* ─── INVOICE / CASH / CHEQUE BILL ────────────────────────────────── */
      Y += 5;
      doc
        .fontSize(10)
        .fillColor("#000")
        .font("Helvetica-Bold")
        .text("INVOICE / CASH / CHEQUE BILL", LM, Y, {
          width: W,
          align: "center",
        });
      Y += 16;
      hline(Y, "#000", 1);

      /* ─── client + invoice details ────────────────────────────────────── */
      const leftW = W * 0.54;
      const rightW = W - leftW;
      const detY = Y + 5;

      // Left: client info
      // const month = new Date(bill.periodStart || Date.now())
      //   .toLocaleString("en-IN", { month: "long" })
      //   .toLowerCase();

      doc
        .fontSize(9.5)
        .fillColor("#000")
        .font("Helvetica-Bold")
        .text(`Buyer (Bill To): ${client.name || ""}`, LM, detY, { width: leftW });
      doc
        .fontSize(9.5)
        .font("Helvetica-Bold")
        .text(
          `Period: ${fmtDate(bill.periodStart)} to ${fmtDate(bill.periodEnd)}`,
          LM,
          detY + 13,
          { width: leftW },
        );
      doc
        .fontSize(9.5)
        .font("Helvetica-Bold")
        .text(
          `Mobile No.:  ${client.mobileNo || client.phone || ""}`,
          LM,
          detY + 28,
          { width: leftW },
        );
      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .text(`Address: ${client.address || ""}`, LM, detY + 43, { width: leftW - 5 });

      // Right: invoice meta
      const rx = LM + leftW + 5;
      const metaRows = [
        ["Invoice No.:", bill.invoiceNo || bill.billId],
        ["Date:", fmtDate(bill.billDate)],
        ["Owner Party Id:", client.ownerPartyId || STORE.ownerId],
        // ["Shop No.:", client.shopNo || STORE.shopNo],
      ];
      let ry = detY;
      metaRows.forEach(([k, v]) => {
        doc
          .fontSize(8.5)
          .fillColor("#000")
          .font("Helvetica-Bold")
          .text(k, rx, ry + 3, { width: rightW * 0.54 });
        doc
          .fontSize(8.5)
          .font("Helvetica-Bold")
          .text(String(v), rx + rightW * 0.54, ry + 3, {
            width: rightW * 0.44,
            align: "right",
          });
        ry += 16;
        doc
          .moveTo(rx, ry)
          .lineTo(LM + W, ry)
          .strokeColor("#ddd")
          .lineWidth(0.3)
          .stroke();
      });

      vline(LM + leftW, Y, Y + 78, "#000", 0.6);
      Y += 80;
      hline(Y, "#000", 1);

      /* ─── table header ────────────────────────────────────────────────── */
      Y += 2;
      fillRect(LM - 5, Y, W + 10, 18, "#1F3864");

      const COLS = [
        { label: "S.No.", x: LM, w: 40, align: "center" },
        { label: "Particulars", x: LM + 40, w: 220, align: "left" },
        { label: "Qty", x: LM + 260, w: 55, align: "center" },
        { label: "Rate", x: LM + 315, w: 90, align: "right" },
        { label: "Amount", x: LM + 405, w: 120, align: "right" },
      ];
      COLS.forEach((c) =>
        doc
          .fontSize(9)
          .fillColor("#fff")
          .font("Helvetica-Bold")
          .text(c.label, c.x, Y + 5, { width: c.w, align: c.align }),
      );
      Y += 18;

      /* ─── item rows ───────────────────────────────────────────────────── */
      const FIXED = 10; // matches excelBillGenerator.js — keep these in sync
                        // so a bill never shows different items across formats
      if (items.length > FIXED) {
        console.warn(
          `Bill ${bill.billId} has ${items.length} items but only ${FIXED} fit on the PDF — extra items were dropped.`,
        );
      }
      for (let i = 0; i < FIXED; i++) {
      const item = items[i];
        if (i % 2 === 1) fillRect(LM - 5, Y, W + 10, 17, "#FAFAFA");
        if (item) {
          doc
            .fontSize(9)
            .fillColor("#000")
            .font("Helvetica")
            .text(String(i + 1), COLS[0].x, Y + 4, {
              width: COLS[0].w,
              align: "center",
            })
            .text(item.particulars || "", COLS[1].x, Y + 4, {
              width: COLS[1].w,
            })
            .text(String(item.quantity), COLS[2].x, Y + 4, {
              width: COLS[2].w,
              align: "center",
            })
            .text(fmtMoney(item.rate), COLS[3].x, Y + 4, {
              width: COLS[3].w,
              align: "right",
            })
            .text(fmtMoney(item.amount), COLS[4].x, Y + 4, {
              width: COLS[4].w,
              align: "right",
            });
        }
        doc
          .moveTo(LM - 5, Y + 17)
          .lineTo(LM + W + 5, Y + 17)
          .strokeColor("#E5E7EB")
          .lineWidth(0.3)
          .stroke();
        Y += 17;
      }
      hline(Y, "#000", 1);

      /* ─── subtotal ────────────────────────────────────────────────────── */
      Y += 2;
      fillRect(LM - 5, Y, W + 10, 17, "#F5F5F5");
      doc
        .fontSize(9.5)
        .fillColor("#000")
        .font("Helvetica-Bold")
        .text("SUBTOTAL", COLS[3].x, Y + 4, {
          width: COLS[3].w,
          align: "right",
        })
        .text(fmtMoney(subtotal), COLS[4].x, Y + 4, {
          width: COLS[4].w,
          align: "right",
        });
      Y += 17;
      hline(Y, "#000", 1);

      /* ─── grand total ─────────────────────────────────────────────────── */
      Y += 2;
      fillRect(LM - 5, Y, W + 10, 20, "#1F3864");
      doc
        .fontSize(11)
        .fillColor("#fff")
        .font("Helvetica-Bold")
        .text("GRAND  TOTAL", LM, Y + 5, { width: W - 95, align: "right" })
        .text(`Rs.${fmtMoney(grandTotal)}`, COLS[4].x, Y + 5, {
          width: COLS[4].w,
          align: "right",
        });
      Y += 20;
      hline(Y, "#000", 1);

      /* ─── amount in words ─────────────────────────────────────────────── */
      Y += 4;

      const wordsText = `Rupees (In Words) :   ${
        bill.grandTotalInWords || numberToWords(grandTotal)
      }`;

      doc
        .fontSize(8.5)
        .fillColor("#000")
        .font("Helvetica-Bold")
        .text(wordsText, LM, Y, { width: W, lineGap: 2 });
      Y = doc.y + 4;
      hline(Y, "#000", 1);

      /* ─── account details (yellow) ────────────────────────────────────── */
      Y += 1;
      fillRect(LM - 5, Y, W + 10, 18, "#FFFF00");
      doc
        .fontSize(9)
        .fillColor("#CC0000")
        .font("Helvetica-Bold")
        .text("A/C Number:", LM, Y + 5);
      doc
        .fontSize(9)
        .fillColor("#000")
        .font("Helvetica-Bold")
        .text(STORE.account, LM + 65, Y + 5);
      doc
        .fontSize(9)
        .fillColor("#CC0000")
        .font("Helvetica-Bold")
        .text("IFSC:", LM + 200, Y + 5);
      doc
        .fontSize(9)
        .fillColor("#000")
        .font("Helvetica-Bold")
        .text(STORE.ifsc, LM + 230, Y + 5);
       doc
        .fontSize(9)
        .fillColor("#CC0000")
        .font("Helvetica-Bold")
        .text("G-Pay / PhonePe:", LM + 330, Y + 5);
      doc
        .fontSize(9)
        .fillColor("#000")
        .font("Helvetica-Bold")
        .text(STORE.gpay, LM + 410, Y + 5,);
      Y += 18;
      hline(Y, "#000", 1);

      /* ─── notes + signature ───────────────────────────────────────────── */
      const noteW = W * 0.62;
      Y += 4;
      doc
        .fontSize(8.5)
        .fillColor("#000")
        .font("Helvetica-Bold")
        .text(
          "Notes: If paying via bank transfer, GPay, PhonePe, or Paytm, please share the transaction screenshot for payment verification.",
          LM,
          Y,
          { width: noteW },
        );
      doc
        .fontSize(9)
        .font("Helvetica")
        .text("For", LM + noteW + 5, Y + 2, {
          width: W - noteW - 5,
          align: "left",
        });
      // Signature image, drawn above the "Authorized Signature" label
      // Signature image sits above the label, with enough gap that it
      // can't visually collide with the "Authorized Signature" text below.
      let sigBottom = Y + 6;
      if (fs.existsSync(SIGNATURE_PATH)) {
        const sigWidth = 90;
        const sigHeight = 28;
        const sigX = LM + noteW + ((W - noteW - 5) - sigWidth) / 2 + 5;
        doc.image(SIGNATURE_PATH, sigX, sigBottom, {
          fit: [sigWidth, sigHeight],
          align: "left",
        });
        sigBottom += sigHeight;
      }
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("Authorized Signature", LM + noteW, sigBottom + 2, {
          width: W - noteW,
          align: "center",
        });
      vline(LM + noteW, Y - 4, sigBottom + 20, "#000", 0.6);
      Y = sigBottom + 30;

      // Draw the outer border now, using the real final content height —
      // this can never clip or leave a gap regardless of how long the
      // shop address, notes, or item list end up being.
      doc
        .rect(LM - 5, borderTopY, W + 10, Y - borderTopY)
        .strokeColor("#000")
        .lineWidth(1.5)
        .stroke();

      doc.end();
      stream.on("finish", () => resolve({ filepath, filename }));
      stream.on("error", reject);
    } catch (e) {
      reject(e);
    }
  }); 
}

module.exports = { generateBillPDF };
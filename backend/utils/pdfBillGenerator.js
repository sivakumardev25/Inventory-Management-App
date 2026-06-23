// pdfBillGenerator.js — generates Aavin-format PDF bill using pdfkit
const PDFDocument        = require('pdfkit');
const fs                 = require('fs');
const path               = require('path');
const { numberToWords }  = require('./numberToWords');

const STORE = {
  name:     process.env.STORE_NAME             || 'PATTATHARI PALAGAM',
  subtitle: process.env.STORE_SUBTITLE         || 'AAVIN PALAGAM',
  ownerId:  process.env.STORE_OWNER_PARTY_ID   || 'F2670',
  shopNo:   process.env.STORE_SHOP_NO          || 'SR 67',
  account:  process.env.STORE_ACCOUNT          || 'XXXXXXXXXXXX',
  ifsc:     process.env.STORE_IFSC             || 'XXXXXXXXXX',
};

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return [
    String(dt.getDate()).padStart(2, '0'),
    String(dt.getMonth() + 1).padStart(2, '0'),
    dt.getFullYear(),
  ].join('/');
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function generateBillPDF(bill, client) {
  return new Promise((resolve, reject) => {
    try {
      const dir = path.join(__dirname, '../uploads/bills');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const safeName = (client.name || 'client').replace(/[^a-zA-Z0-9]/g, '_');
      const filename  = `${bill.billId}_${safeName}.pdf`;
      const filepath  = path.join(dir, filename);

      const doc = new PDFDocument({
        size:    'A4',
        margins: { top: 30, bottom: 30, left: 35, right: 35 },
        info:    { Title: `Invoice #${bill.invoiceNo}`, Author: STORE.name },
      });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      const W  = 525;  // usable page width
      const LM = 35;   // left margin
      let   Y  = 30;

      /* ─── helpers ─────────────────────────────────────────────────────── */
      const fillRect = (x, y, w, h, color) =>
        doc.rect(x, y, w, h).fillColor(color).fill();

      const hline = (y, color = '#000', lw = 0.5) =>
        doc.moveTo(LM - 5, y).lineTo(LM + W + 5, y).strokeColor(color).lineWidth(lw).stroke();

      const vline = (x, y1, y2, color = '#000', lw = 0.5) =>
        doc.moveTo(x, y1).lineTo(x, y2).strokeColor(color).lineWidth(lw).stroke();

      /* ─── outer border ────────────────────────────────────────────────── */
      doc.rect(LM - 5, Y - 5, W + 10, 770).strokeColor('#000').lineWidth(1.5).stroke();

      /* ─── header ──────────────────────────────────────────────────────── */
      // Logo left
      doc.fontSize(20).fillColor('#00008B').font('Helvetica-Bold').text('🐄', LM, Y + 6, { width: 70, align: 'center' });
      doc.fontSize(8).fillColor('#00008B').text('aavin', LM, Y + 30, { width: 70, align: 'center' });

      // Store name
      doc.fontSize(20).fillColor('#CC0000').font('Helvetica-Bold')
         .text(STORE.name, LM + 70, Y + 4, { width: W - 140, align: 'center' });
      doc.fontSize(12).fillColor('#1F3864').font('Helvetica-Bold')
         .text(STORE.subtitle, LM + 70, Y + 28, { width: W - 140, align: 'center' });

      // Logo right
      doc.fontSize(20).fillColor('#00008B').font('Helvetica-Bold').text('🐄', LM + W - 65, Y + 6, { width: 70, align: 'center' });
      doc.fontSize(8).fillColor('#00008B').text('aavin', LM + W - 65, Y + 30, { width: 70, align: 'center' });

      Y += 52;
      hline(Y, '#000', 1.5);

      /* ─── INVOICE / CASH / CHEQUE BILL ────────────────────────────────── */
      Y += 5;
      doc.fontSize(10).fillColor('#000').font('Helvetica-Bold')
         .text('INVOICE / CASH / CHEQUE BILL', LM, Y, { width: W, align: 'center' });
      Y += 16;
      hline(Y, '#000', 1);

      /* ─── client + invoice details ────────────────────────────────────── */
      const leftW  = W * 0.54;
      const rightW = W - leftW;
      const detY   = Y + 5;

      // Left: client info
      const month = new Date(bill.periodStart || Date.now())
        .toLocaleString('en-IN', { month: 'long' }).toLowerCase();

      doc.fontSize(9.5).fillColor('#000').font('Helvetica-Bold')
         .text(`TO ;  ${month}`, LM, detY, { width: leftW });
      doc.fontSize(9.5).font('Helvetica-Bold')
         .text(`${fmtDate(bill.periodStart)} TO ${fmtDate(bill.periodEnd)}`, LM, detY + 13, { width: leftW });
      doc.fontSize(9.5).font('Helvetica-Bold')
         .text(`M.NO ;  ${client.mobileNo || client.phone || ''}`, LM, detY + 28, { width: leftW });
      doc.fontSize(9).font('Helvetica').fillColor('#000')
         .text(client.name || '', LM, detY + 41, { width: leftW });
      doc.fontSize(8.5).fillColor('#444').font('Helvetica')
         .text(client.address || '', LM, detY + 53, { width: leftW - 5 });

      // Right: invoice meta
      const rx = LM + leftW + 5;
      const metaRows = [
        ['Invoice No.', bill.invoiceNo || bill.billId],
        ['DATE :', fmtDate(bill.billDate)],
        ['OWNER PARTY ID', client.ownerPartyId || STORE.ownerId],
        ['SHOP No', client.shopNo || STORE.shopNo],
      ];
      let ry = detY;
      metaRows.forEach(([k, v]) => {
        doc.fontSize(8.5).fillColor('#000').font('Helvetica-Bold')
           .text(k, rx, ry + 3, { width: rightW * 0.54 });
        doc.fontSize(8.5).font('Helvetica-Bold')
           .text(String(v), rx + rightW * 0.54, ry + 3, { width: rightW * 0.44, align: 'right' });
        ry += 16;
        doc.moveTo(rx, ry).lineTo(LM + W, ry).strokeColor('#ddd').lineWidth(0.3).stroke();
      });

      vline(LM + leftW, Y, Y + 78, '#000', 0.6);
      Y += 80;
      hline(Y, '#000', 1);

      /* ─── table header ────────────────────────────────────────────────── */
      Y += 2;
      fillRect(LM - 5, Y, W + 10, 18, '#1F3864');

      const COLS = [
        { label: 'S.No.',       x: LM,       w: 36,        align: 'center' },
        { label: 'Particulars', x: LM + 36,  w: 232,       align: 'left'   },
        { label: 'Qty',         x: LM + 268, w: 62,        align: 'center' },
        { label: 'Rate',        x: LM + 330, w: 78,        align: 'right'  },
        { label: 'Amount',      x: LM + 408, w: W - 373,   align: 'right'  },
      ];
      COLS.forEach(c =>
        doc.fontSize(9).fillColor('#fff').font('Helvetica-Bold')
           .text(c.label, c.x, Y + 5, { width: c.w, align: c.align })
      );
      Y += 18;

      /* ─── item rows ───────────────────────────────────────────────────── */
      const FIXED = 10;
      for (let i = 0; i < FIXED; i++) {
        const item = bill.items[i];
        if (i % 2 === 1) fillRect(LM - 5, Y, W + 10, 17, '#FAFAFA');
        if (item) {
          doc.fontSize(9).fillColor('#000').font('Helvetica')
             .text(String(i + 1),         COLS[0].x, Y + 4, { width: COLS[0].w, align: 'center' })
             .text(item.particulars || '', COLS[1].x, Y + 4, { width: COLS[1].w })
             .text(String(item.quantity),  COLS[2].x, Y + 4, { width: COLS[2].w, align: 'center' })
             .text(fmtMoney(item.rate),    COLS[3].x, Y + 4, { width: COLS[3].w, align: 'right'  })
             .text(fmtMoney(item.amount),  COLS[4].x, Y + 4, { width: COLS[4].w, align: 'right'  });
        }
        doc.moveTo(LM - 5, Y + 17).lineTo(LM + W + 5, Y + 17).strokeColor('#E5E7EB').lineWidth(0.3).stroke();
        Y += 17;
      }
      hline(Y, '#000', 1);

      /* ─── subtotal ────────────────────────────────────────────────────── */
      Y += 2;
      fillRect(LM - 5, Y, W + 10, 17, '#F5F5F5');
      doc.fontSize(9.5).fillColor('#000').font('Helvetica-Bold')
         .text('SUBTOTAL', LM, Y + 4, { width: W - 80, align: 'right' })
         .text(fmtMoney(bill.subtotal), COLS[4].x, Y + 4, { width: COLS[4].w, align: 'right' });
      Y += 17;
      hline(Y, '#000', 1);

      /* ─── grand total ─────────────────────────────────────────────────── */
      Y += 2;
      fillRect(LM - 5, Y, W + 10, 20, '#1F3864');
      doc.fontSize(11).fillColor('#fff').font('Helvetica-Bold')
         .text('GRAND  TOTAL', LM, Y + 5, { width: W - 95, align: 'right' })
         .text(`Rs.${fmtMoney(bill.grandTotal)}`, COLS[4].x - 8, Y + 5, { width: COLS[4].w + 8, align: 'right' });
      Y += 20;
      hline(Y, '#000', 1);

      /* ─── amount in words ─────────────────────────────────────────────── */
      Y += 4;
      doc.fontSize(9).fillColor('#000').font('Helvetica-Bold')
         .text(
           `Rupees (In Words) :   ${bill.grandTotalWords || numberToWords(bill.grandTotal)}`,
           LM, Y, { width: W }
         );
      Y += 16;
      hline(Y, '#000', 1);

      /* ─── account details (yellow) ────────────────────────────────────── */
      Y += 1;
      fillRect(LM - 5, Y, W + 10, 18, '#FFFF00');
      doc.fontSize(9).fillColor('#CC0000').font('Helvetica-Bold').text('A/C NUMBER', LM, Y + 5, { width: 74 });
      doc.fontSize(9).fillColor('#000').font('Helvetica-Bold').text(STORE.account, LM + 78, Y + 5, { width: 160 });
      doc.fontSize(9).fillColor('#CC0000').font('Helvetica-Bold').text('IFSC :', LM + 252, Y + 5, { width: 34 });
      doc.fontSize(9).fillColor('#000').font('Helvetica-Bold').text(STORE.ifsc, LM + 290, Y + 5, { width: 150 });
      Y += 18;
      hline(Y, '#000', 1);

      /* ─── notes + signature ───────────────────────────────────────────── */
      const noteW = W * 0.62;
      Y += 4;
      doc.fontSize(8.5).fillColor('#000').font('Helvetica-Bold')
         .text(
           'Notes :- If you Pay Money To Bank Account or G-Pay or Phone pay\n' +
           ',paytm please Send the Screenshot of Payment for Verification',
           LM, Y, { width: noteW }
         );
      doc.fontSize(9).font('Helvetica').text('For', LM + noteW + 5, Y + 2, { width: W - noteW - 5, align: 'right' });
      doc.fontSize(9).font('Helvetica-Bold').text('Authorized Signature', LM + noteW + 5, Y + 34, { width: W - noteW - 5, align: 'right' });
      vline(LM + noteW, Y - 4, Y + 50, '#000', 0.6);

      doc.end();
      stream.on('finish', () => resolve({ filepath, filename }));
      stream.on('error',  reject);
    } catch (e) { reject(e); }
  });
}

module.exports = { generateBillPDF };
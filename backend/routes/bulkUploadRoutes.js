// bulkRoutes.js — Excel upload → parse → validate → generate PDFs → send via WhatsApp
const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const { parseExcel }       = require('../utils/excelParser');
const { generateBillPDF }  = require('../utils/pdfBillGenerator');
const { numberToWords }    = require('../utils/numberToWords');
const wa                   = require('../utils/whatsappService');
const Bill                 = require('../models/Bill');
const Client               = require('../models/Client');

// Multer — save uploaded Excel to uploads/excel/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/excel');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `upload_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = ['.xlsx','.xls'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Only .xlsx/.xls files allowed'), ok);
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// ── POST /api/bulk/parse ───────────────────────────────────────────────────
// Upload Excel → parse → validate → return rows with errors/warnings
router.post('/parse', upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const buffer = fs.readFileSync(req.file.path);
    const result = parseExcel(buffer);
    // Keep file path for next step
    res.json({ success: true, data: result, filePath: req.file.path, message: `Parsed ${result.totalRows} rows` });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// ── POST /api/bulk/generate-pdfs ──────────────────────────────────────────
// Takes parsed rows → generates PDF per valid row → returns list
router.post('/generate-pdfs', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !rows.length) return res.status(400).json({ success: false, message: 'No rows provided' });

    const validRows = rows.filter(r => r.valid);
    if (!validRows.length) return res.status(400).json({ success: false, message: 'No valid rows to generate' });

    const results = [];
    const storeAcct = process.env.STORE_ACCOUNT || 'XXXXXXXXXXXX';
    const storeIFSC = process.env.STORE_IFSC    || 'XXXXXXXXXX';

    for (const row of validRows) {
      try {
        // Count existing bills for sequential invoice number
        const count = await Bill.countDocuments();
        const invoiceNo = row.invoiceNo ? parseInt(row.invoiceNo) : count + 1;
        const billId    = `BILL${new Date().getFullYear()}${String(invoiceNo).padStart(4,'0')}`;

        const billDoc = {
          billId, invoiceNo,
          client:     null,           // no DB client lookup needed for bulk
          billDate:   row.billDate || new Date(),
          periodStart:row.periodStart || new Date(),
          periodEnd:  row.periodEnd   || new Date(),
          items:      row.items,
          subtotal:   row.subtotal,
          grandTotal: row.grandTotal,
          grandTotalInWords: numberToWords(row.grandTotal),
          status:     'Draft',
        };

        const clientDoc = {
          name:         row.clientName,
          phone:        row.phone,
          mobileNo:     row.phone,
          address:      row.address,
          shopNo:       row.shopNo,
          ownerPartyId: row.ownerPartyId,
        };

        // Generate PDF
        const { filepath, filename } = await generateBillPDF(billDoc, clientDoc);

        // Try to find/create client in DB
        let dbClient = await Client.findOne({   $or: [
    { phone: row.phone },
    { mobileNo: row.phone }
  ]
});
        if (!dbClient) {
          dbClient = await new Client({
            name: row.clientName, phone: row.phone, mobileNo: row.phone,
            address: row.address, shopNo: row.shopNo, ownerPartyId: row.ownerPartyId
          }).save().catch(() => null);
        }

        // Save bill to DB
        const savedBill = await new Bill({
          ...billDoc,
          client:    dbClient?._id || null,
          // excelFile: filename,
          pdfFile: filename,
        }).save().catch(() => null);

        results.push({
          rowIndex:   row.rowIndex,
          clientName: row.clientName,
          phone:      row.phone,
          invoiceNo,
          grandTotal: row.grandTotal,
          pdfPath:    filepath,
          filename,
          billId:     savedBill?.billId || billId,
          dbBillId:   savedBill?._id,
          status:     'generated',
          error:      null,
        });
      } catch (e) {
        results.push({
          rowIndex:   row.rowIndex,
          clientName: row.clientName,
          phone:      row.phone,
          status:     'failed',
          error:      e.message,
        });
      }
    }

    const generated = results.filter(r => r.status === 'generated').length;
    res.json({ success: true, data: results, generated, message: `${generated} PDFs generated` });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── POST /api/bulk/send ───────────────────────────────────────────────────
// Send a single bill PDF via WhatsApp
router.post('/send', async (req, res) => {
  try {
    const { phone, pdfPath, clientName, invoiceNo, grandTotal, dbBillId } = req.body;
    if (!phone || !pdfPath) return res.status(400).json({ success: false, message: 'phone and pdfPath required' });
    if (!wa.isReady()) return res.status(503).json({ success: false, message: 'WhatsApp not connected — scan QR first' });

    const caption = `🐄 *PATTATHARI PALAGAM — AAVIN PALAGAM*\n\n📋 Invoice #${invoiceNo}\n👤 ${clientName}\n💰 Total: ₹${Number(grandTotal).toLocaleString('en-IN',{minimumFractionDigits:2})}\n\n_Please check the attached bill PDF._\n_If paying via Bank/GPay/PhonePe/Paytm, send payment screenshot. 🙏_`;

    // await wa.sendPDF(phone, pdfPath, caption);
    if (!fs.existsSync(pdfPath)) {
  throw new Error("PDF file not found");
}

    // Mark bill as sent in DB
    if (dbBillId) {
      await Bill.findByIdAndUpdate(dbBillId, { whatsappSent: true, whatsappSentAt: new Date(), status: 'Sent' }).catch(()=>{});
    }

    res.json({ success: true, message: `Bill sent to ${clientName} (${phone})` });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── POST /api/bulk/send-all ───────────────────────────────────────────────
// Send all generated bills in one shot (server-side loop)
router.post('/send-all', async (req, res) => {
  try {
    const { bills } = req.body; // array of { phone, pdfPath, clientName, invoiceNo, grandTotal, dbBillId }
    if (!bills || !bills.length) return res.status(400).json({ success: false, message: 'No bills provided' });
    if (!wa.isReady()) return res.status(503).json({ success: false, message: 'WhatsApp not connected — scan QR first' });

    const results = [];
    for (const b of bills) {
      try {
        const caption = `🐄 *PATTATHARI PALAGAM — AAVIN PALAGAM*\n\n📋 Invoice #${b.invoiceNo}\n👤 ${b.clientName}\n💰 Total: ₹${Number(b.grandTotal).toLocaleString('en-IN',{minimumFractionDigits:2})}\n\n_Please check the attached bill PDF._\n_If paying via Bank/GPay/PhonePe/Paytm, send payment screenshot. 🙏_`;
        await wa.sendPDF(b.phone, b.pdfPath, caption);
        if (b.dbBillId) await Bill.findByIdAndUpdate(b.dbBillId, { whatsappSent:true, whatsappSentAt:new Date(), status:'Sent' }).catch(()=>{});
        results.push({ clientName: b.clientName, phone: b.phone, success: true });
        // Small delay between sends to avoid rate limiting
        await new Promise(r => setTimeout(r, 1200));
      } catch (e) {
        results.push({ clientName: b.clientName, phone: b.phone, success: false, error: e.message });
      }
    }

    const sent   = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    res.json({ success: true, data: results, sent, failed, message: `Sent ${sent}, Failed ${failed}` });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── GET /api/bulk/download/:filename ──────────────────────────────────────
router.get('/download/:filename', (req, res) => {
  const fp = path.join(__dirname, '../uploads/bills', req.params.filename);
  if (!fs.existsSync(fp)) return res.status(404).json({ success: false, message: 'File not found' });
  res.download(fp);
});

// ── GET /api/bulk/sample-template ─────────────────────────────────────────
// Returns a sample Excel template for download
router.get('/sample-template', async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Billing Template');

    const headers = [
      'Client Name','Phone','Address','Period Start','Period End',
      'Invoice No','Bill Date','Shop No','Owner Party ID',
      'Particulars1','Qty1','Rate1','Amount1',
      'Particulars2','Qty2','Rate2','Amount2',
      'Particulars3','Qty3','Rate3','Amount3',
      'Notes'
    ];

    // Style header row
    ws.addRow(headers);
    ws.getRow(1).eachCell(cell => {
      cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1F3864' } };
      cell.font = { color:{ argb:'FFFFFFFF' }, bold:true, name:'Arial' };
      cell.alignment = { horizontal:'center', vertical:'middle', wrapText: true };
      cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
    });
    ws.getRow(1).height = 22;

    // Sample data rows
    const samples = [
      ['Ravi Kumar','9876543210','12, Main Street, Chennai','01/02/2026','28/02/2026',19,'02/03/2026','SR 67','F2670','Green',69,24,1656,'','','','','','','',''],
      ['Priya Stores','9865432109','45, Anna Nagar, Chennai','01/02/2026','28/02/2026',20,'02/03/2026','SR 34','F2671','Green',44,24,1056,'Blue',32,28,896,'','','',''],
      ['Murugan Dairy','9754321089','78, T Nagar, Chennai','01/02/2026','28/02/2026',21,'02/03/2026','SR 12','F2680','Token',40,22,880,'','','','','','','',''],
    ];
    samples.forEach(row => {
      ws.addRow(row);
    });

    // Column widths
    ws.columns = headers.map((h,i) => ({ width: i<3?22:i<9?13:16 }));

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename=aavin_billing_template.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { res.status(500).json({ success:false, message: e.message }); }
});

module.exports = router;

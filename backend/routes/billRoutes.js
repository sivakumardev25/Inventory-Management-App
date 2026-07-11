const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const Bill = require("../models/Bill");
const Client = require("../models/Client");
const InventoryEntry = require("../models/InventoryEntry");
const { generateBillExcel } = require("../utils/excelBillGenerator");
const { numberToWords } = require("../utils/numberToWords");

//List all bills
router.get("/", async (req, res) => {
  try {
    const { status, client, page = 1, limit = 20, month } = req.query;
    let q = {};
    if (status) q.status = status;
    if (client) q.client = client;

    if (month) {
      const [year, monthIndex] = month.split("-").map(Number);
      if (year && monthIndex) {
        const start = new Date(year, monthIndex - 1, 1);
        const end = new Date(year, monthIndex, 0, 23, 59, 59, 999);
        q.$or = [
          { periodStart: { $lte: end }, periodEnd: { $gte: start } },
          { billDate: { $gte: start, $lte: end } },
        ];
      }
    }

    const [data, total] = await Promise.all([
      Bill.find(q)
        .populate("client", "name phone clientId")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Bill.countDocuments(q),
    ]);
    res.json({ success: true, data, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

//GET single bill
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Bill ID",
      });
    }
    const data = await Bill.findById(req.params.id).populate("client");
    if (!data)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

//Generate bill for single client
router.post("/generate", async (req, res) => {
  try {
    console.log("Generate Bill Payload:");
    console.log(req.body);

    const { clientId, periodStart, periodEnd, billDate } = req.body;
    const startDate = new Date(`${periodStart}T00:00:00`);
    const endDate = new Date(`${periodEnd}T23:59:59`);
    const billDateValue = billDate
      ? new Date(`${billDate}T00:00:00`)
      : new Date();
    const client = await Client.findById(clientId);
    console.log("Client:", client);

    if (!client)
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });

    //fetch & aggregate inventory data
    const entries = await InventoryEntry.find({
      client: client._id,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    }).populate("lines.product", "name unit productCode");
    console.log("Entries Found:", entries.length);

    if (!entries.length) {
      return res.status(404).json({
        success: false,
        message: "No inventory entries found for the specified period",
      });
    }

    //create a map to aggregate quantities and amounts by product
    const map = {};
    entries.forEach((e) =>
      e.lines.forEach((l) => {
        if (!l.product) return;

        const key = l.product._id.toString();
        if (!map[key])
          map[key] = {
            particulars: l.product.name,
            unit: l.product.unit,
            quantity: 0,
            rate: l.priceAtTime,
            amount: 0,
          };
        map[key].quantity += l.quantity;
        map[key].amount += l.subtotal;
      }),
    );

    const items = Object.values(map);
    const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
    const grandTotal = subtotal; // Add taxes or discounts if needed

    console.log("Items:", items);
    console.log("Subtotal:", subtotal);

    // Create bill with retry on duplicate billId (handles race / deleted-doc gaps)
    let bill;
    const billData = {
      client: clientId,
      billDate: billDateValue,
      periodStart: startDate,
      periodEnd: endDate,
      items,
      subtotal,
      grandTotal,
      grandTotalInWords: numberToWords(grandTotal),
    };
    let attempts = 0;
    while (!bill && attempts < 5) {
      try {
        bill = await new Bill(billData).save();
      } catch (saveErr) {
        // Handle duplicate billId (E11000) by computing next invoiceNo and retrying
        if (
          saveErr &&
          saveErr.code === 11000 &&
          saveErr.keyPattern &&
          saveErr.keyPattern.billId
        ) {
          const maxDoc = await Bill.findOne()
            .sort({ invoiceNo: -1 })
            .select("invoiceNo")
            .lean();
          const next = (maxDoc?.invoiceNo || 0) + 1;
          billData.invoiceNo = next;
          billData.billId = `BILL_${String(next).padStart(5, "0")}`;
          attempts++;
          continue; // loop will retry
        }
        throw saveErr;
      }
    }
    if (!bill) throw new Error("Failed to create bill after multiple attempts");

    console.log("Bill Saved:", bill._id);

    let fileName = null;
    try {
      const result = await generateBillExcel(bill, client);
      fileName = result.fileName;
      await Bill.findByIdAndUpdate(bill._id, { excelFile: fileName });
    } catch (excelErr) {
      console.error("Excel generation failed:", excelErr.message);
    }

    const populated = await Bill.findById(bill._id).populate(
      "client",
      "name phone clientId",
    );

    res.status(201).json({
      success: true,
      data: populated,
      fileName,
      message: fileName
        ? "Bill generated"
        : "Bill generated without Excel file",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
});

//Generate bills for ALL active clients
router.post("/generate-all", async (req, res) => {
  try {
    const { periodStart, periodEnd, billDate } = req.body;
    const startDate = new Date(`${periodStart}T00:00:00`);
    const endDate = new Date(`${periodEnd}T23:59:59`);
    const billDateValue = billDate
      ? new Date(`${billDate}T00:00:00`)
      : new Date();
    const clients = await Client.find({ active: true });
    const results = [];
    const errors = [];

    for (const client of clients) {
      try {
        //fetch & aggregate inventory data
        const entries = await InventoryEntry.find({
          client: client._id,
          date: {
            $gte: startDate,
            $lte: endDate,
          },
        }).populate("lines.product", "name unit productCode");

        if (!entries.length) continue;

        //create a map to aggregate quantities and amounts by product
        const map = {};
        entries.forEach((e) =>
          e.lines.forEach((l) => {
            if (!l.product) return;
            const key = l.product._id.toString();
            if (!map[key])
              map[key] = {
                particulars: l.product.name,
                unit: l.product.unit,
                quantity: 0,
                rate: l.priceAtTime,
                amount: 0,
              };
            map[key].quantity += l.quantity;
            map[key].amount += l.subtotal;
          }),
        );

        const items = Object.values(map);
        const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
        const grandTotal = subtotal;

        // Create bill with retry on duplicate billId (bulk path)
        let bill;
        const billData = {
          client: client._id,
          billDate: billDateValue,
          periodStart: startDate,
          periodEnd: endDate,
          items,
          subtotal,
          grandTotal,
          grandTotalInWords: numberToWords(grandTotal),
        };
        let attempts = 0;
        while (!bill && attempts < 5) {
          try {
            bill = await new Bill(billData).save();
          } catch (saveErr) {
            if (
              saveErr &&
              saveErr.code === 11000 &&
              saveErr.keyPattern &&
              saveErr.keyPattern.billId
            ) {
              const maxDoc = await Bill.findOne()
                .sort({ invoiceNo: -1 })
                .select("invoiceNo")
                .lean();
              const next = (maxDoc?.invoiceNo || 0) + 1;
              billData.invoiceNo = next;
              billData.billId = `BILL_${String(next).padStart(5, "0")}`;
              attempts++;
              continue;
            }
            throw saveErr;
          }
        }
        if (!bill)
          throw new Error("Failed to create bill after multiple attempts");

        let fileName = null;
        try {
          const result = await generateBillExcel(bill, client);
          fileName = result.fileName;
          await Bill.findByIdAndUpdate(bill._id, { excelFile: fileName });
        } catch (excelErr) {
          console.error(
            "Excel generation failed for bulk bill:",
            excelErr.message,
          );
        }
        results.push({
          clientName: client.name,
          billId: bill.billId,
          grandTotal: subtotal,
          excelFile: fileName,
        });
      } catch (e) {
        errors.push({ clientName: client.name, error: e.message });
      }
    }
    res.json({ success: true, generated: results.length, results, errors });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

//Download Excel
router.get("/:id/download", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Bill ID",
      });
    }
    const bill = await Bill.findById(req.params.id).populate("client");
    if (!bill)
      return res.status(404).json({ success: false, message: "Not found" });

    let filename = bill.excelFile;
    let filepath = filename
      ? path.join(__dirname, "../uploads/bills", filename)
      : null;

    if (!filepath || !fs.existsSync(filepath)) {
      const result = await generateBillExcel(bill, bill.client);
      filepath = result.filePath;
      filename = result.fileName;
      await Bill.findByIdAndUpdate(bill._id, { excelFile: filename });
    }
    res.download(filepath, filename);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

//Mark whatsapp sent
router.post("/:id/mark-whatsapp", async (req, res) => {
  try {
    const data = await Bill.findByIdAndUpdate(
      req.params.id,
      {
        whatsappSent: true,
        whatsappSentAt: new Date(),
        status: "Unpaid",
      },
      { new: true },
    ).populate("client", "name phone");
    res.json({ success: true, data, message: "Marked as sent" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

//Update Status
router.put("/:id/status", async (req, res) => {
  try {
    console.log("Update Status Payload:", req.body);
    const data = await Bill.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true },
    ).populate("client", "name phone");

    if (!data)
      return res
        .status(404)
        .json({ success: false, message: "Bill not found" });
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

//Delete Bill
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Bill ID",
      });
    }
    console.log("Delete Request");
    console.log(req.params.id);
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (bill?.excelFile) {
      const fp = path.join(__dirname, "../uploads/bills", bill.excelFile);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    res.json({ success: true, message: "Bill deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET whatsapp links for all unsent bills in a period
router.get("/whatsapp-links", async (req, res) => {
  try {
    const { status } = req.query;
    const q = status ? { status } : { status: { $in: ["Draft", "Sent"] } };
    const bills = await Bill.find(q).populate(
      "client",
      "name phone mobileNo clientId",
    );
    const links = bills.map((b) => ({
      billId: b.billId,
      invoiceNo: b.invoiceNo,
      clientName: b.client?.name,
      phone: b.client?.phone || b.client?.mobileNo,
      grandTotal: b.grandTotal,
      whatsappSent: b.whatsappSent,
    }));
    res.json({ success: true, data: links });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;

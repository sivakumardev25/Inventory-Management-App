const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const Bill = require("../models/Bill");
const Client = require("../models/Client");
const InventoryEntry = require("../models/InventoryEntry");
const { generateBillExcel } = require("../utils/excelBillGenerator");
const { numberToWords } = require("../utils/numberToWords");

//List all bills
router.get("/", async (req, res) => {
  try {
    const { status, client, page = 1, limit = 20 } = req.query;
    let q = {};
    if (status) q.status = status;
    if (client) q.client = client;

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
        $gte: new Date(periodStart),
        $lte: new Date(new Date(periodEnd).setHours(23, 59, 59)),
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


    const bill = await new Bill({
      client: clientId,
      billDate: billDate ? new Date(billDate) : new Date(),
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      items,
      subtotal,
      grandTotal,
      grandTotalInWords: numberToWords(grandTotal),
    }).save();

    console.log("Bill Saved:", bill._id);

    const { filePath, fileName } = await generateBillExcel(bill, client);
    console.log("Excel Generated:", { filePath, fileName });
    await Bill.findByIdAndUpdate(bill._id, { excelFile: fileName });

    const populated = await Bill.findById(bill._id).populate(
      "client",
      "name phone clientId",
    );

    res.status(201).json({
      success: true,
      data: populated,
      fileName,
      message: "Bill generated",
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
    const clients = await Client.find({ active: true });
    const results = [];
    const errors = [];

    for (const client of clients) {
      try {
        //fetch & aggregate inventory data
        const entries = await InventoryEntry.find({
          client: client._id,
          date: {
            $gte: new Date(periodStart),
            $lte: new Date(new Date(periodEnd).setHours(23, 59, 59)),
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

        const bill = await new Bill({
          client: client._id,
          billDate: billDate ? new Date(billDate) : new Date(),
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          items,
          subtotal,
          grandTotal,
          grandTotalInWords: numberToWords(grandTotal),
        }).save();

        const { filePath, fileName } = await generateBillExcel(bill, client);
        await Bill.findByIdAndUpdate(bill._id, { excelFile: fileName });
        results.push({
          clientName: client.name,
          billId: bill.billId,
          grandTotal: subtotal,
        });

        // const populated = await Bill.findById(bill._id).populate("client", "name phone clientId");

        // res.status(201).json({ success: true, data: populated, fileName, message: "Bill generated" });
        //   } catch (e) {
        //     console.error(e);
        //     res.status(500).json({ success: false, message: e.message });
        //   }
        // };
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
router.post("/:id/status", async (req, res) => {
  try {
    const data = await Bill.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true },
    ).populate("client", "name phone");
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

//Delete Bill
router.delete("/:id", async (req, res) => {
  try {
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

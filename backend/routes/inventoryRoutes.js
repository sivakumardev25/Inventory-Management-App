const router = require("express").Router();
const InventoryEntry = require("../models/InventoryEntry");
const Product = require("../models/Product");

//GET list (with friends)
router.get("/", async (req, res) => {
  try {
    const { client, startDate, endDate, page = 1, limit = 50 } = req.query;
    let q = {};
    if (client) q.client = client;
    if (startDate || endDate) {
      q.date = {};
      if (startDate) q.date.$gte = new Date(startDate);
      if (endDate)
        q.date.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
    }

    const [data, total] = await Promise.all([
      InventoryEntry.find(q)
        // populate client name, phone, clientId; and product name, unit, productCode in lines
        .populate("client", "name phone clientId")
        .populate("lines.product", "name unit productCode")
        .sort({ date: -1 }) //newest first
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      InventoryEntry.countDocuments(q),
    ]);
    res.json({
      success: true,
      data,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

//get single id
router.get("/:id", async (req, res) => {
  try {
    const data = await InventoryEntry.findById(req.params.id)
      .populate("client", "name phone clientId")
      .populate("lines.product", "name unit productCode");

    if (!data)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

//POST Create
router.post("/", async (req, res) => {
  console.log("Inventory Payload:");
  console.log(JSON.stringify(req.body, null, 2));
  try {
    const { client, date, lines, notes } = req.body;
    if (!client || !lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Client and at least one line item are required",
      });
    }

    const processedLines = await Promise.all(
      lines.map(async (l) => {
        const product = await Product.findById(l.product);
        console.log("Found Product:", product);

        if (!product) throw new Error(`Product ${l.product} not found`);

        const price = l.priceAtTime ?? product.pricePerUnit;

        console.log("Price:", price);

        return {
          product: l.product,
          quantity: l.quantity,
          priceAtTime: price,
          subtotal: price * l.quantity,
        };
      }),
    );
    const totalAmount = processedLines.reduce((sum, l) => sum + l.subtotal, 0);
    const entry = await new InventoryEntry({
      client,
      date,
      lines: processedLines,
      totalAmount,
      notes,
    }).save();

    const populated = await InventoryEntry.findById(entry._id)
      .populate("client", "name phone clientId")
      .populate("lines.product", "name unit productCode");
    res.status(201).json({
      success: true,
      data: populated,
      message: "Inventory entry created successfully",
    });
  } catch (e) {
    //     res.status(500).json({ success: false, message: e.message });
    //   }
    // });

    console.error("Inventory POST Error:");
    console.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { lines, notes, date } = req.body;
    const processedLines = await Promise.all(
      lines.map(async (l) => {
        const product = await Product.findById(l.product);
        if (!product) throw new Error(`Product ${l.product} not found`);

        const price = l.priceAtTime ?? product.pricePerUnit;
        return {
          product: l.product,
          quantity: l.quantity,
          priceAtTime: price,
          subtotal: price * l.quantity,
        };
      }),
    );
    const totalAmount = processedLines.reduce((sum, l) => sum + l.subtotal, 0);
    const data = await InventoryEntry.findByIdAndUpdate(
      req.params.id,
      { lines: processedLines, notes, date, totalAmount },
      { new: true },
    )
      .populate("client", "name phone clientId")
      .populate("lines.product", "name unit productCode");
    if (!data)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data, message: "Inventory entry updated" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const data = await InventoryEntry.findByIdAndDelete(req.params.id);
    if (!data)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Inventory entry deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Aggregate inventory for a client+period (used for billing preview)
router.get("/summary/period", async (req, res) => {
  try {
    const { client, startDate, endDate } = req.query;
    if (!client || !startDate || !endDate)
      return res.status(400).json({
        success: false,
        message: "client, startDate, endDate required",
      });
    const entries = await InventoryEntry.find({
      client,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59)),
      },
    }).populate("lines.product", "name unit productCode");
    const map = {};

    entries.forEach((e) =>
      e.lines.forEach((l) => {
        if (!l.product) return;
        const pid = l.product._id.toString();
        if (!map[pid])
          map[pid] = {
            particulars: l.product.name,
            unit: l.product.unit,
            productCode: l.product.productCode,
            quantity: 0,
            rate: l.priceAtTime,
            amount: 0,
          };

        map[pid].quantity += l.quantity;
        // map[pid].amount += l.quantity * l.priceAtTime;
        map[pid].amount += l.subtotal;
      }),
    );
    const items = Object.values(map);

    res.json({
      success: true,
      data: {
        items,
        subtotal: items.reduce((s, i) => s + i.amount, 0),
        entryCount: entries.length,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;

const router = require("express").Router();
const Product = require("../models/Product");
const mongoose = require("mongoose");

const normalizeUnit = (unit) => {
  if (!unit || typeof unit !== "string") return unit;
  const normalized = unit.trim().toLowerCase();
  if (normalized === "packet(500ml)" || normalized === "packet (500ml)") return "Packet (500ml)";
  if (normalized === "packet") return "Packet";
  if (normalized === "piece") return "Piece";
  return unit;
};

router.get("/", async (req, res) => {
  try {
    const q =
      req.query.active !== undefined
        ? { active: (req.query.active === "true") }
        : {};
    res.json({
      success: true,
      data: await Product.find(q).sort({ name: 1 }),
      count: await Product.countDocuments(q),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    console.log("Incoming Product:", req.body);
    
    const payload = { ...req.body, unit: normalizeUnit(req.body.unit) };
      console.log("Normalized:", payload);
    const data = await new Product(payload).save();
    res.status(201).json({ success: true, data, message: "Product Created" });
  } catch (err) {
     console.error(err);
    res.status(400).json({ success: false, message: err.message, errors: err.errors });
  }
});

router.put("/:id", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid product id" });
  }
  try {
    const payload = { ...req.body, unit: normalizeUnit(req.body.unit) };
    const data = await Product.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data, message: "Product Updated" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put("/:id/deactivate", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
  return res.status(400).json({
    success: false,
    message: "Invalid product id",
  });
}
  try {
const data = await Product.findByIdAndUpdate(req.params.id, {active: false},  { new: true }
    );
       if (!data) {
      return res.status(404).json({ success: false, message: "Product not found", });
    }
    res.json({ success: true, data, message: "Product deactivated" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
  return res.status(400).json({
    success: false,
    message: "Invalid product id",
  });
}
  try {
    const data = await Product.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      data,
      message: "Product deactivated successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;
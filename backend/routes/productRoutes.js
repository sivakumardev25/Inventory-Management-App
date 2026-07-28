const router = require("express").Router();
const Product = require("../models/Product");
const mongoose = require("mongoose");

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
    
    // Product.js schema already normalizes `unit` via its own setter on save,
    // so no need to duplicate that logic here.
    const data = await new Product(req.body).save();
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
       const data = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
      runValidators: true,
    });
    res.json({ success: true, data, message: "Product Updated" });
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
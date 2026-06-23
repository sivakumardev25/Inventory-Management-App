const mongoose = require("mongoose");
const crypto = require("crypto");

const productSchema = new mongoose.Schema(
  {
    productCode: {
      type: String,
      unique: true,
      // default: () => "PRD_" + Date.now().toString().slice(-5),
      default: () =>
        "PRD_" + crypto.randomBytes(3).toString("hex").toUpperCase(),
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["Milk", "Curd", "Butter", "Ghee", "Paneer", "Ice cream", "Other"],
      default: "Milk",
    },
    unit: {
      type: String,
      enum: ["Litre", "Kg", "Pack", "Piece"],
      default: "Litre",
    },
    pricePerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Product", productSchema);

const mongoose = require("mongoose");
const crypto = require("crypto");

const normalizeUnit = (unit) => {
  if (!unit || typeof unit !== "string") return unit;
  const normalized = unit.trim().toLowerCase();
  if (["packet", "packect"].includes(normalized)) return "Packet";
  if (["packet(500ml)", "packet (500ml)", "packect(500ml)", "packect (500ml)"].includes(normalized)) return "Packet (500ml)";
  if (normalized === "piece") return "Piece";
  return unit;
};

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
      enum: [ "Packet (500ml)", "Piece", "Packet"],
      default: "Packet (500ml)",
      set: normalizeUnit,
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

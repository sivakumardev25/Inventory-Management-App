const mongoose = require("mongoose");

const lineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    priceAtTime: {
      type: Number,
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
    },
  },
  { _id: false },
);

const inventoryEntrySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    lines: [lineSchema],
    totalAmount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true },
);

inventoryEntrySchema.pre("save", async function () {
  this.totalAmount = this.lines.reduce((sum, line) => sum + line.subtotal, 0);
});

inventoryEntrySchema.index({ client: 1, date: -1 });

module.exports = mongoose.model("InventoryEntry", inventoryEntrySchema);

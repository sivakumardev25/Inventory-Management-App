const mongoose = require("mongoose");

const billItemSchema = new mongoose.Schema(
  {
    particulars: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      min: 0,
    },
    rate: {
      type: Number,
    },
    amount: {
      type: Number,
    },
  },
  { _id: false },
);

const billSchema = new mongoose.Schema(
  {
    billId: {
      type: String,
      unique: true,
      // required: true,
    },

    invoiceNo: {
      type: Number,
      // required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },
    billDate: {
      type: Date,
      default: Date.now,
    },

    periodStart: {
      type: Date,
    },

    periodEnd: {
      type: Date,
    },

    items: [billItemSchema],

    subtotal: {
      type: Number,
      default: 0,
      required: true,
    },
    grandTotal: {
      type: Number,
      default: 0,
      required: true,
    },

    grandTotalInWords: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "Paid",
        "Unpaid",
        "Partially Paid",
        "Draft",
        "Sent",
        "Overdue",
        "Cancelled",
      ],
      default: "Draft",
    },

    whatsappSent: {
      type: Boolean,
      default: false,
    },
    whatsappSentAt: {
      type: Date,
    },
    excelFile: {
      type: String,
    },
    pdfFile: {
      type: String,
    },
  },
  { timestamps: true },
);

billSchema.pre("validate", async function () {
  if (!this.billId) {
    const count = await this.constructor.countDocuments();
    this.invoiceNo = count + 1;
    this.billId = `BILL_${this.invoiceNo.toString().padStart(5, "0")}`;
  }
});

module.exports = mongoose.model("Bill", billSchema);

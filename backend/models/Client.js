const mongoose = require("mongoose");

const crypto = require("crypto");

const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      // required: true,
      unique: true,
      default: () => "CLI_" + crypto.randomBytes(3).toString("hex").toUpperCase(),
    },

   
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    mobileNo: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    area: {
      type: String,
      trim: true,
    },
    shopNo: {
      type: String,
      trim: true,
    },
    ownerPartyId: {
      type: String,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Client", clientSchema);

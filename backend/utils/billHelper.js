// billHelper.js — shared bill-creation logic used by every billing flow
// (single generate, generate-all, and bulk Excel upload), so invoice
// numbering and duplicate-key retry behaviour stays identical everywhere.
const Bill = require("../models/Bill");

// Saves a new Bill, retrying automatically if a race condition causes a
// duplicate billId (e.g. two bills generated at the same moment).
async function saveBillWithRetry(billData, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await new Bill(billData).save();
    } catch (err) {
      const isDuplicateBillId =
        err && err.code === 11000 && err.keyPattern && err.keyPattern.billId;
      if (!isDuplicateBillId) throw err;
      // Clear the pre-set values so the model's pre('validate') hook
      // recalculates the next available invoice number and retries.
      delete billData.invoiceNo;
      delete billData.billId;
      lastErr = err;
    }
  }
  throw lastErr || new Error("Failed to create bill after multiple attempts");
}

module.exports = { saveBillWithRetry };
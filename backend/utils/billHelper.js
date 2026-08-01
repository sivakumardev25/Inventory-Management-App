// billHelper.js — shared bill-creation logic used by every billing flow

const Bill = require("../models/Bill");

// Saves a new Bill, retrying automatically if a race condition causes a
// duplicate billId (e.g. two bills generated at the same moment).
async function saveBillWithRetry(billData, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
       // Create a fresh copy for every attempt
      const data = { ...billData };

      // On retry, allow the Bill model's pre-validation hook
      // to generate a new invoiceNo and billId.
      if (i > 0) {
        delete data.invoiceNo;
        delete data.billId;
      }
      return await new Bill(data).save();
    } catch (err) {
      const isDuplicateBillId =
        err && err.code === 11000 &&
      (
          err.keyPattern?.billId ||
          err.keyValue?.billId
        );
      if (!isDuplicateBillId) {
        throw err; 
        
      }
      // Clear the pre-set values so the model's pre('validate') hook
      // delete billData.invoiceNo;
      // delete billData.billId;
      lastErr = err;
      console.warn(
        `Duplicate billId detected. Retrying bill creation (${i + 1}/${attempts})...`,
      );
    }
  }
  throw (lastErr || new Error("Failed to create bill after multiple attempts"));
}

module.exports = { saveBillWithRetry };
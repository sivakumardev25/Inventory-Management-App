export function buildWhatsAppLink(phone, bill, clientName) {
  // Clean phone number - keep only digits, add country code for India
  let num = phone.replace(/\D/g, "");
  if (num.length === 10) num = "91" + num;
  else if (num.startsWith("0")) num = "91" + num.slice(1);

  const startDate = new Date(bill.periodStart).toLocaleDateString("en-IN");
  const endDate = new Date(bill.periodEnd).toLocaleDateString("en-IN");
  const billDate = new Date(bill.billDate).toLocaleDateString("en-IN");

  const msg = `🐄 *PATTATHARI PALAGAM - AAVIN PALAGAM*
━━━━━━━━━━━━━━━━━━━━━━
📋 *INVOICE DETAILS*

*Invoice No:* ${bill.invoiceNo || bill.billId}
*Date:* ${billDate}
*Period:* ${startDate} to ${endDate}
*To:* ${clientName}

━━━━━━━━━━━━━━━━━━━━━━
🛒 *PARTICULARS*

${bill.items
  .map(
    (item, i) => `${i + 1}. ${item.particulars}
   Qty: ${item.quantity} × ₹${item.rate.toFixed(2)} = *₹${item.amount.toFixed(2)}*`,
  )
  .join("\n\n")}

━━━━━━━━━━━━━━━━━━━━━━
💰 *SUBTOTAL: ₹${bill.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}*
💳 *GRAND TOTAL: ₹${bill.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}*

📝 *${bill.grandTotalWords}*

━━━━━━━━━━━━━━━━━━━━━━
🏦 *Payment Details*
A/C No: (see bill)
IFSC: (see bill)

*Note:* If you Pay Money To Bank Account or G-Pay or Phone Pay or Paytm, please send the Screenshot of Payment for Verification.

Thank you! 🙏`;

  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

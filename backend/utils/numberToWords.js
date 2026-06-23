//Convert number to Indian rupees in words

const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",];

const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
function b100(num) {
    return num < 20 ? ones[num] : tens[Math.floor(num / 10)] + (num % 10 ? "" + ones[num % 10] : "");
}

function b1000(num) {
    return num < 100 ? b100(num) : ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + b100(num % 100) : "");
}


function numberToWords(amount) {
    const n = Math.round(Number(amount));

    if (!n) return "Zero Rupees Only";

    let w = '';
    if (n >= 10000000)
        w += b1000(Math.floor(n / 10000000)) + 'Crore';
    if (Math.floor(n / 100000) % 100)
        w += ' ' + b100(Math.floor(n / 100000) % 100) + 'Lakh';
    if (Math.floor(n / 1000) % 100) 
        w += ' ' + b100(Math.floor(n / 1000) % 100) + 'Thousand';
    if (Math.floor(n/100) % 10) 
        w += ' ' + ones[Math.floor(n / 100) % 10] + 'Hundred';
    if (n % 100)
        w += ' ' + b100(n % 100);
    return w.trim() + 'Rupees Only';
}

module.exports = { numberToWords };
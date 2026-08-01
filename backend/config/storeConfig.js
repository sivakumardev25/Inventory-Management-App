// Store configuration
const STORE = {
  name: process.env.STORE_NAME || "PATTATHARI PALAGAM",
  subtitle: process.env.STORE_SUBTITLE || "AAVIN PALAGAM",
  address: process.env.STORE_ADDRESS || "",
  mobile: process.env.STORE_MOBILE || "",
  ownerId: process.env.STORE_OWNER_PARTY_ID || "",
  shopNo: process.env.STORE_SHOP_NO || "",
  account: process.env.STORE_ACCOUNT || "",
  ifsc: process.env.STORE_IFSC || "",
  gpay: process.env.STORE_GPAY || "",
};

module.exports = STORE;
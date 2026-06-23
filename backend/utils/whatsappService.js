const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

const qrcode = require("qrcode");
const fs = require("fs");

let client = null;
let ready = false;
let qrDataURL = null;
let status = "not_started";
let initPromise = null;

function getStatus() {
  return {
    status,
    ready,
    hasQR: !!qrDataURL,
  };
}

function initClient() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    status = "initializing";

    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: process.env.WA_SESSION_PATH || "./wa_session",
      }),

      puppeteer: {
        headless: true,
        executablePath: process.env.CHROME_PATH || undefined,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-zygote",
          "--disable-gpu",
        ],
      },
    });

    client.on("qr", async (qr) => {
      status = "qr_pending";
      ready = false;
      qrDataURL = await qrcode.toDataURL(qr).catch(() => null);
      console.log(
        "📱 QR ready — poll /api/whatsapp/status to show it in the app",
      );
    });

    client.on("ready", () => {
      status = "ready";
      ready = true;
      qrDataURL = null;
      console.log("✅ WhatsApp ready — bills can now be sent automatically");
      resolve({ ok: true });
    });

    client.on("authenticated", () => {
      status = "authenticated";
      console.log("🔐 WhatsApp authenticated");
    });

    client.on("auth_failure", (msg) => {
      status = "auth_failed";
      ready = false;
      initPromise = null;
      console.error("❌ WhatsApp auth failure:", msg);
      resolve({ ok: false, error: msg });
    });

    client.on("disconnected", (reason) => {
      status = "disconnected";
      ready = false;
      initPromise = null;
      console.warn("⚠️ WhatsApp disconnected:", reason);
    });

    client.initialize().catch((err) => {
      status = "error";
      ready = false;
      initPromise = null;
      console.error("WhatsApp init error:", err.message);
      resolve({ ok: false, error: err.message });
    });
  });

  return initPromise;
}

// Convert 10-digit Indian number → WhatsApp ID
function toWAId(phone) {
  let n = String(phone).replace(/\D/g, "");
  if (n.length === 10) n = "91" + n;
  else if (n.startsWith("0") && n.length === 11) n = "91" + n.slice(1);
  return n + "@c.us";
}

// Check if a number is registered on WhatsApp
async function validateNumber(phone) {
  if (!ready) throw new Error("WhatsApp not ready");
  const waId = toWAId(phone);
  const ok = await client.isRegisteredUser(waId);
  return { valid: ok, waId };
}

// Send a PDF file to a WhatsApp number
async function sendPDF(phone, pdfPath, caption) {
  if (!ready) throw new Error("WhatsApp not connected — scan QR first");
  if (!fs.existsSync(pdfPath)) throw new Error(`PDF not found: ${pdfPath}`);

  const waId = toWAId(phone);
  const ok = await client.isRegisteredUser(waId);
  if (!ok) throw new Error(`${phone} is not registered on WhatsApp`);

  const media = MessageMedia.fromFilePath(pdfPath);
  await client.sendMessage(waId, media, { caption: caption || "" });
  return { success: true };
}

// Logout and clear session
async function logout() {
  if (client) {
    await client.logout();
    ready = false;
    status = "not_started";
    initPromise = null;
    qrDataURL = null;
  }
}

module.exports = {
  initClient,
  getStatus,
  getQR: () => qrDataURL,
  isReady: () => ready,
  validateNumber,
  sendPDF,
  logout,
  toWAId,
};

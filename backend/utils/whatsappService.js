const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

const qrcode = require("qrcode");
const fs = require("fs");

let client = null;
let ready = false;
let qrDataURL = null;
let lastError = null;
let status = "not_started";
let initPromise = null;

// Get the current status of the WhatsApp client
function getStatus() {
  return {
    status,
    ready,
    hasQR: !!qrDataURL,
    error: lastError,
  };
}

async function ensureReady() {
  if (client && ready) {
    return;
  }

  if (!client) {
    await initClient();
  }

  // Wait up to 15 seconds for ready event
  let retry = 30;

  while (!ready && retry > 0) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    retry--;
  }
  if (!ready) {
    throw new Error(
      "WhatsApp is not connected. Please scan the QR code first.",
    );
  }
}

console.log("Node:", process.version);
console.log("Platform:", process.platform);
console.log("CHROME_PATH:", process.env.CHROME_PATH);

if (process.env.CHROME_PATH) {
  console.log("Chrome Exists:", fs.existsSync(process.env.CHROME_PATH));
}

function initClient() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    status = "initialising";
    ready = false;
    qrDataURL = null;
    lastError = null;

    const puppeteerOptions = {
      headless: true,
      protocolTimeout: 120000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-zygote",
        "--disable-gpu",
        "--disable-features=site-per-process",
      ],
    };

    const chromePath =
      process.env.CHROME_PATH ||
      "/opt/render/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome";

    if (fs.existsSync(chromePath)) {
      console.log("Using Chrome:", chromePath);
      puppeteerOptions.executablePath = chromePath;
    } else {
      console.log("Chrome NOT found:", chromePath);
    }

    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: process.env.WA_SESSION_PATH || "./wa_session",
      }),
      puppeteer: puppeteerOptions,
    });

    client.on("qr", async (qr) => {
      status = "qr_pending";
      ready = false;
      lastError = null;
      qrDataURL = await qrcode.toDataURL(qr).catch(() => null);
      console.log(
        "📱 QR ready — poll /api/whatsapp/status to show it in the app",
      );
    });

    //     client.on("ready", () => {
    //       status = "ready";
    //       ready = true;
    //       qrDataURL = null;
    //       console.log("✅ WhatsApp ready — bills can now be sent automatically");
    //       resolve({ ok: true });
    //     });

    //     client.on("authenticated", () => {
    //       status = "authenticated";
    //       console.log("🔐 WhatsApp authenticated");
    //     });

    //     client.on("loading_screen", (percent, message) => {
    //     console.log(`Loading: ${percent}% - ${message}`);
    // });

    client.on("ready", async () => {
      console.log("================================");
      console.log("✅ WhatsApp READY");
      console.log("================================");

      status = "ready";
      ready = true;
      qrDataURL = null;
      lastError = null;

      try {
        const info = client.info;
        console.log("Logged in as:", info.pushname);
        console.log("Number:", info.wid.user);
      } catch (e) {}

      resolve({ ok: true });
    });

    client.on("change_state", (state) => {
      console.log("WhatsApp State:", state);
    });

    // client.on("ready", () => {
    //     console.log("READY EVENT FIRED");
    //     status = "ready";
    //     ready = true;
    //     qrDataURL = null;
    //     resolve({ ok: true });
    // });

    client.on("remote_session_saved", () => {
      console.log("✅ Remote session saved.");
    });

    client.on("auth_failure", async (msg) => {
      console.error("❌ Auth Failed:", msg);

      status = "auth_failed";
      ready = false;
      lastError = msg;
      qrDataURL = null;

      try {
        await client.destroy();
      } catch (e) {}

      client = null;
      initPromise = null;

      resolve({ ok: false, error: msg });
    });

    client.on("disconnected", async (reason) => {
      console.warn("⚠️ WhatsApp disconnected:", reason);
      ready = false;
      status = "disconnected";

      // initPromise = null;
      qrDataURL = null;
      // console.warn("⚠️ WhatsApp disconnected:", reason);
      try {
        await client.destroy();
      } catch (err) {
        console.warn(
          "⚠️ Error destroying WhatsApp client after disconnect:",
          err.message,
        );
      }
      client = null;
      initPromise = null;

      // reconnect automatically
      //   setTimeout(() => {
      //     if (!client) {
      //       initClient().catch(console.error);
      //     }
      // },3000);
    });

    (async () => {
      try {
        console.log("Initializing WhatsApp...");
        await client.initialize();
        console.log("Initialization request completed.");
      } catch (err) {
        status = "error";
        ready = false;
        lastError = err.message;
        qrDataURL = null;

        if (client) {
          try {
            await client.destroy();
          } catch (_) {}
        }

        client = null;
        initPromise = null;

        console.error("========== WHATSAPP INIT ERROR ==========");
        console.error(err);
        console.error(err.stack);
        console.error("=========================================");

        resolve({
          ok: false,
          error: err.message,
        });
      }
    })();
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
  await ensureReady();
  const waId = toWAId(phone);
  const ok = await client.isRegisteredUser(waId);
  return { valid: ok, waId };
}

// Send a PDF file to a WhatsApp number
async function sendPDF(phone, pdfPath, caption) {
  await ensureReady();

  if (!client) {
    throw new Error("WhatsApp client is not available.");
  }

  if (!ready) {
    throw new Error("WhatsApp is not connected.");
  }

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  const waId = toWAId(phone);

  const isRegistered = await client.isRegisteredUser(waId);

  if (!isRegistered) {
    throw new Error(`${phone} is not registered on WhatsApp`);
  }

  const media = MessageMedia.fromFilePath(pdfPath);
  try {
    await client.sendMessage(waId, media, {
      caption: caption || "",
    });
    console.log(`✅ PDF sent successfully to ${phone}`);
    return { success: true };
  } catch (err) {
    console.error(`❌ Failed to send PDF to ${phone}`);
    console.error(err);
    throw err;
  }
}

// Logout and clear session
async function logout() {
  if (!client) return;

  try {
    await client.logout();
    await client.destroy();
  } catch (err) {
    console.error(err);
  }

  client = null;
  ready = false;
  qrDataURL = null;
  status = "not_started";
  initPromise = null;
  lastError = null;
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

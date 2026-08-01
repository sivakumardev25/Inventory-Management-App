const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const puppeteer = require("puppeteer");
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
// Tear down a broken/stale client so the next call rebuilds a fresh one
// instead of hanging on a client that will never become ready.
async function resetClient() {
  const oldClient = client;
  client = null;
  initPromise = null;
  ready = false;

  if (oldClient) {
    try {
      await oldClient.destroy();
    } catch (err) {
      console.warn("⚠️ Error destroying WhatsApp client:", err.message);
    }
  }
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
  if (!client || !client.info) {
    throw new Error(
      "WhatsApp is not connected.",
    );
  }
}

console.log("Node:", process.version);
console.log("Platform:", process.platform);

async function initClient() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      status = "initialising";
      ready = false;
      qrDataURL = null;
      lastError = null;

      const chromePath = await puppeteer.executablePath();

      console.log("Puppeteer executable:", chromePath);
      console.log("Chrome exists at that path:", fs.existsSync(chromePath));

      if (!fs.existsSync(chromePath)) {
        throw new Error(`Chrome executable not found at: ${chromePath}`);
      }

      const puppeteerOptions = {
        executablePath: chromePath,
        headless: true, // must be true on a server — there is no display to show a real browser window
        timeout: 120000,
        protocolTimeout: 120000,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          // Extra flags to reduce memory/CPU usage on low-RAM hosts
          "--disable-gpu",
          "--disable-dev-tools",
          "--disable-accelerated-2d-canvas",
          "--disable-software-rasterizer",
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-default-apps",
          "--disable-sync",
          "--disable-translate",
          "--metrics-recording-only",
          "--mute-audio",
          "--no-first-run",
        ],
      };

      // Assign to the module-level `client`, not a new local variable —
      // everything else in this file (ensureReady, sendPDF, logout) reads
      // the module-level one, so this must not be shadowed.
      client = new Client({
        authStrategy: new LocalAuth({
          dataPath: process.env.WA_SESSION_PATH || "./wa_session",
        }),
        puppeteer: puppeteerOptions,
      });
      console.log("Client created");

      client.on("qr", async (qr) => {
        status = "qr_pending";
        ready = false;
        lastError = null;

        qrDataURL = await qrcode.toDataURL(qr).catch(() => null);

        console.log("📱 QR ready — poll /api/whatsapp/status");
      });

      client.on("loading_screen", (percent, message) => {
        console.log(`Loading: ${percent}% - ${message}`);
      });

      client.on("authenticated", () => {
        // whatsapp-web.js can emit this multiple times during initial
        // pairing (once per auth data chunk saved) — only log once.
        if (status !== "authenticated") {
          console.log("✅ WhatsApp authenticated");
        }
        status = "authenticated";
        qrDataURL = null; // no longer needed/valid once authenticated
        lastError = null;
      });

      client.on("ready", () => {
        console.log("✅ WhatsApp READY");

        status = "ready";
        ready = true;
        qrDataURL = null;
        lastError = null;

        try {
          const info = client.info;

          console.log("Logged in as:", info.pushname);
          console.log("Number:", info.wid.user);
        } catch (e) {
          console.warn("Could not read WhatsApp account info");
        }
      });

      client.on("error", (err) => {
        console.error("WhatsApp Client Error:", err);

        status = "error";
        lastError = err.message;

        resetClient().catch((e) =>
          console.warn("⚠️ Error resetting client after error:", e.message),
        );
      });

      client.on("change_state", (state) => {
        console.log("WhatsApp State:", state);
        if (state === "CONFLICT") {
          client.resetState();
        }
      });

      client.on("remote_session_saved", () => {
        console.log("✅ Remote session saved");
      });

      client.on("auth_failure", async (msg) => {
        console.error("❌ WhatsApp Auth Failed:", msg);

        status = "auth_failed";
        ready = false;
        lastError = msg;
        qrDataURL = null;

        await resetClient().catch((e) =>
          console.warn(
            "⚠️ Error resetting client after auth failure:",
            e.message,
          ),
        );
      });

      client.on("disconnected", async (reason) => {
        console.warn("⚠️ WhatsApp disconnected:", reason);

        status = "disconnected";
        qrDataURL = null;
        lastError = reason;
        
        if (reason === "LOGOUT") {
        await logout();
        return;
        }
        

        await resetClient();
      });
      console.log("==============================");
      console.log("Initializing WhatsApp...");
      console.log("Chrome:", chromePath);
      console.log("Platform:", process.platform);
      console.log("==============================");

      console.log("Before initialize");

      await Promise.race([
        client.initialize(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("WhatsApp initialization timed out")),
            90000,
          ),
        ),
      ]);

      console.log("After initialize");
      console.log("initialize() returned");
      return {
        ok: true,
        message: "WhatsApp initialization started",
      };
    } catch (err) {
      status = "error";
      ready = false;
      lastError = err.message;
      qrDataURL = null;
      console.error("========== WHATSAPP INIT ERROR ==========");

      console.error(err);
      console.error(err.stack);

      console.error("=========================================");
      if (client) {
        try {
          await client.destroy();
        } catch (destroyError) {
          console.error("Error destroying client:", destroyError.message);
        }
      }

      client = null;
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

// Convert 10-digit Indian number → WhatsApp ID
function toWAId(phone) {
  let n = String(phone || "").replace(/\D/g, "");

  if (n.startsWith("0") && n.length === 11) {
    n = "91" + n.slice(1);
  } else if (n.length === 10) {
    n = "91" + n;
  }

  if (!/^91\d{10}$/.test(n)) {
    throw new Error(`Invalid Indian mobile number: ${phone}`);
  }
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
async function sendPDF(phone, filePath, caption) {
  await ensureReady();

  if (!client) {
    throw new Error("WhatsApp client is not available.");
  }

  if (!ready) {
    throw new Error("WhatsApp is not connected.");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF not found: ${filePath}`);
  }

  const waId = toWAId(phone);

  const isRegistered = await client.isRegisteredUser(waId);

  if (!isRegistered) {
    throw new Error(`${phone} is not registered on WhatsApp`);
  }

  const media = MessageMedia.fromFilePath(filePath);
  try {

  await Promise.race([
    client.sendMessage(
        waId,
        media,
        {
            caption: caption || "",
        }
    ),
    new Promise((_, reject) =>
        setTimeout(
            () => reject(new Error("Send timeout")),
            30000
        )
    ),
 ]);
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
  if (client) {
    try {
      await client.logout();
      await client.destroy();
    } catch (err) {
      console.error("Logout error:", err);
    }
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
// whatsappRoutes.js
const router = require('express').Router();
const wa     = require('../utils/whatsappService');

// GET status + QR
router.get('/status', (req, res) => {
  const s = wa.getStatus() || {};
  res.json({ success: true, data: { ...s, qr: wa.getQR() } });
});

// POST init / connect
router.post('/init', async (req, res) => {
  try {
    // Fire and forget — client initialises async, QR arrives via polling
    // wa.initClient().catch(() => { });
    wa.initClient().catch((err) => {
  console.error("WhatsApp init failed:", err);
});
    res.json({ success: true, message: 'WhatsApp initialising — poll /status for QR' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST logout
router.post('/logout', async (req, res) => {
  try {
    await wa.logout();
    res.json({ success: true, message: 'Logged out' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST validate a number
router.post('/validate', async (req, res) => {
  try {
    const { phone } = req.body?.trim();
     if (!phone) {
      return res.status(400).json({ success: false, message: "phone required",});}
    if (!phone) return res.status(400).json({ success: false, message: 'phone required' });
    const result = await wa.validateNumber(phone);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
// whatsappRoutes.js
const router = require('express').Router();
const wa     = require('../utils/whatsappService');

router.get("/status", async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        ...wa.getStatus(),
        qr: wa.getQR(),
      },
    });
  } catch (err) {
      console.error("STATUS ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// POST init / connect
router.post('/init', async (req, res) => {
  try {
    if (wa.getStatus().status === "ready") {
      return res.json({
        success: true,
        message: "Already connected",
      });
    }
    await wa.initClient();

    res.json({
      success: true,
      message: "WhatsApp initialising started — check status for QR",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
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
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, message: 'phone required' });
    }
    const result = await wa.validateNumber(phone);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});


module.exports = router;
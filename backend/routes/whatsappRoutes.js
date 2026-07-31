// whatsappRoutes.js
const router = require('express').Router();
const wa     = require('../utils/whatsappService');

// GET status + QR
// router.get('/status', (req, res) => {
//   const s = wa.getStatus() || {};
//   res.json({ success: true, data: { ...s, qr: wa.getQR() } });
// });

router.get("/status", async (req, res) => {
    console.log("Status endpoint called");
  try {
      const status = wa.getStatus();
    const qr = wa.getQR();

    console.log("Status:", status);

    res.json({
      success: true,
      data: {
         ...status,
        qr,
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
    // Fire and forget — client initialises async, QR arrives via polling
    if (wa.getStatus().status === "ready") {
      return res.json({
        success: true,
        message: "Already connected",
      });
    }

    // await wa.initClient();
    wa.initClient().catch(err => {
    console.error(err);
});
    
  
    res.json({ success: true, message: 'WhatsApp initialising started — check status for QR' });
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
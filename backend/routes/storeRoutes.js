const express = require("express");
const router = express.Router();

const STORE = require("../config/storeConfig");

router.get("/", (req, res) => {
  res.json({
    success: true,
    store: STORE,
  });
});

module.exports = router;
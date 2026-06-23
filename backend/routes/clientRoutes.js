const router = require("express").Router();
const Client = require("../models/Client");
const mongoose = require("mongoose");



// GET all clients
router.get("/", async (req, res) => {

  try {
    const { search, active } = req.query;

    let q = {};
    if (active !== undefined) q.active = active === "true";

    if (search)
      q.$or = [
        //What is $or? MongoDB will search if any one condition matches.
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { clientId: { $regex: search, $options: "i" } },
        { mobileNo: { $regex: search, $options: "i"} },
      ];

    const data = await Client.find(q).sort({ createdAt: -1 });
    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

//GET single
router.get("/:id", async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid client id",
    });
  }
  try {
    const data = await Client.findById(req.params.id);
    if (!data)
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST Create
router.post("/", async (req, res) => {
  try {
    const data = await new Client(req.body).save();
    res.status(201).json({ success: true, data, message: "Client Created" });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

//PUT update
router.put("/:id", async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid client id",
    });
  }
  try {
    const data = await Client.findByIdAndUpdate(req.params.id, req.body, {
      new: true, //return updated data
      runValidators: true, //validate data before update
    });
    if (!data)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data, message: "Client Updated" });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

//DELETE
router.delete("/:id", async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid client id",
    });
  }
  try {
   const data = await Client.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true },
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }
    res.json({ success: true, message: "Client deactivated" });
    // const data = await Client.findByIdAndUpdate(req.params.id);
    // if (!data)
    //   return res.status(404).json({ success: false, message: "Not found" });
    // res.json({ success: true, data, message: "Client Deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;

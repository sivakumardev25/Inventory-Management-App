const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// Load environment variables
require("dotenv").config();

//
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
// app.use(express.json({ limit: '20mb' }));
// app.use(express.urlencoded({ extended: true, limit: '20mb' }));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection
// const connectDB = require("config/db.js");
// connectDB();

// Routes
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/clients", require("./routes/clientRoutes"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/bills", require("./routes/billRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/bulk-upload", require("./routes/bulkUploadRoutes"));
app.use("/api/whatsapp", require("./routes/whatsappRoutes"));

// app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date() }));

// Connect to MongoDB and start the server

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1);
  });

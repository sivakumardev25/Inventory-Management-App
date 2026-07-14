const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// Load environment variables
require("dotenv").config();

//
const app = express();

// Middleware
// Allow specifying one or more client origins via CLIENT_URL or CLIENT_URLS (comma-separated)
const rawClientUrls =
  process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:3000";
const allowedOrigins = rawClientUrls
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
console.log("Allowed CORS origins:", allowedOrigins);
const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser (server-to-server / testing) requests when origin is undefined
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    console.warn("Blocked CORS origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};
app.use(cors(corsOptions));

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
app.use("/api/bulk", require("./routes/bulkUploadRoutes"));
app.use("/api/bulk-upload", require("./routes/bulkUploadRoutes"));
app.use("/api/whatsapp", require("./routes/whatsappRoutes"));

// app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date() }));

// Serve React build in production (same-origin, avoids CORS/mixed-content issues)
if (process.env.NODE_ENV === "production") {
  const express = require("express");
  const path = require("path");
  const buildPath = path.join(
    __dirname,
    "..",
    "frontend",
    "inventory-fe",
    "build",
  );
  console.log("Production mode: serving frontend from", buildPath);
  app.use(express.static(buildPath));
  app.get("*", (req, res) => {
    // Serve index.html for any non-API request
    if (req.path.startsWith("/api"))
      return res.status(404).json({ success: false, message: "Not found" });
    res.sendFile(path.join(buildPath, "index.html"));
  });
}

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

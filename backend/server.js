const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
// const wa = require("./utils/whatsappService");

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION");
  console.error(reason);
  console.error(reason?.stack);
});

// Load environment variables
require("dotenv").config();

//express app
const app = express();

// Middleware
// Allow specifying one or more client origins via CLIENT_URL
const rawClientUrls = process.env.CLIENT_URL || "http://localhost:3000";

const allowedOrigins = rawClientUrls
  .split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

console.log("Allowed CORS origins:", allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/$/, "");

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    console.log("Allowed:", allowedOrigins);
    console.log("Received:", normalizedOrigin);

    return callback(new Error("Not allowed by CORS"));
  },

  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());

// Routes
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/clients", require("./routes/clientRoutes"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/bills", require("./routes/billRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/bulk", require("./routes/bulkUploadRoutes"));
app.use("/api/bulk-upload", require("./routes/bulkUploadRoutes"));
app.use("/api/whatsapp", require("./routes/whatsappRoutes"));
app.use("/api/store", require("./routes/storeRoutes"));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Inventory Management Backend is running",
  });
});

    // Start the server
  const PORT = process.env.PORT || 5000;
    
  app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Inventory Management Backend is running",
  });
  });

  // Health check endpoint
  app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
  });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log("WhatsApp service is idle.");
      console.log("Call POST /api/whatsapp/init to connect.");
    });

// Connect to MongoDB 
mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000, // give up after 10s instead of hanging
  })
  .then(() => {
    console.log("Connected to MongoDB");

  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error.message);

  });
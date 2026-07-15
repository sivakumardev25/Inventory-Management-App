const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
// const path = require("path");

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

// app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date() }));

// Serve React build in production (same-origin, avoids CORS/mixed-content issues)
// if (process.env.NODE_ENV === "production") {
//   const buildPath = path.join(
//     __dirname,
//     "..",
//     "frontend",
//     "inventory-fe",
//     "build",
//   );
//   console.log("Production mode: serving frontend from", buildPath);
//   app.use(express.static(buildPath));
//   app.get("*", (req, res) => {
//     // Serve index.html for any non-API request
//     if (req.path.startsWith("/api"))
//       return res.status(404).json({ success: false, message: "Not found" });
//     res.sendFile(path.join(buildPath, "index.html"));
//   });
// }

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Inventory Management Backend is running",
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Connect to MongoDB and start the server

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000, // give up after 10s instead of hanging
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error.message);
    // Don't process.exit here — that would kill the server (and the open
    // port) just because the DB had a hiccup. Log it and let Render's
    // health checks / your own monitoring surface the problem instead.
  });

// mongoose
//   .connect(process.env.MONGODB_URI)
//   .then(() => {
//     console.log("Connected to MongoDB");
//     app.listen(process.env.PORT || 5000, () => {
//       console.log(`Server running on port ${process.env.PORT || 5000}`);
//     });
//   })
//   .catch((error) => {
//     console.error("Error connecting to MongoDB:", error.message);
//     process.exit(1);
//   });

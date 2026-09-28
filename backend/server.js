const express = require("express");
const mongoose = require("mongoose");

const app = express();

const PORT = 5000;

app.use(express.json());

// Home route
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// API route
app.get("/api", (req, res) => {
  res.send("Hello from Backend! 🚀");
});

// MongoDB connection
if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("MongoDB connected");
    })
    .catch((err) => {
      console.error("MongoDB connection failed:", err);
    });
}

// Export app for testing
module.exports = app;

// Start server only when this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

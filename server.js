const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ==================== MIDDLEWARE ====================
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "https://sababa-tours.vercel.app",
      "https://sababa-tours-backend.onrender.com",
    ],
    credentials: true,
  }),
);

app.use(express.json());

// ==================== DATABASE CONNECTION ====================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// ==================== BOOKING SCHEMA (Updated) ====================
const bookingSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userEmail: { type: String, required: true },
  userName: String,

  serviceId: String,
  serviceName: { type: String, required: true },
  serviceBalance: String,

  travelers: { type: Number, required: true, min: 1 },
  preferredDate: { type: Date, required: true },
  totalAmount: { type: Number, required: true },

  // NEW FIELDS
  phoneNumber: { type: String, required: true },
  address: { type: String, required: true },

  notes: String,

  status: {
    type: String,
    default: "pending",
    enum: ["pending", "confirmed", "cancelled"],
  },
  createdAt: { type: Date, default: Date.now },
});

const Booking = mongoose.model("Booking", bookingSchema);

// ==================== ROUTES ====================

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Backend is running" });
});

// Create New Booking
app.post("/api/bookings", async (req, res) => {
  try {
    console.log("Received booking:", req.body);

    const booking = new Booking(req.body);
    const savedBooking = await booking.save();

    console.log("Booking saved successfully:", savedBooking._id);

    res.status(201).json({
      success: true,
      message: "Booking request submitted successfully!",
      bookingId: savedBooking._id,
    });
  } catch (error) {
    console.error("Booking Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message,
    });
  }
});

// Get User's Bookings
app.get("/api/bookings/user/:userId", async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.params.userId }).sort({
      createdAt: -1,
    });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== ADMIN ROUTES ====================

app.get("/api/admin/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch("/api/admin/bookings/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );
    res.json({ success: true, booking: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/admin/bookings/:id", async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Booking deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

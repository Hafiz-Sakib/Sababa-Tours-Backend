// server.js
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

// ==================== BOOKING SCHEMA ====================
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

// ==================== SERVICE SCHEMA ====================
const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  about: { type: String, required: true },
  balance: { type: String, required: true },
  picture: { type: String, required: true },
  category: { type: String, default: "General" },
  duration: { type: String, default: "Flexible" },
  location: { type: String, default: "Bangladesh" },
  createdAt: { type: Date, default: Date.now },
});

const Service = mongoose.model("Service", serviceSchema);

// ==================== HEALTH CHECK ====================
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Backend is running" });
});

// ==================== BOOKING ROUTES ====================

// Create booking with duplicate prevention
app.post("/api/bookings", async (req, res) => {
  try {
    const { userId, serviceId } = req.body;

    if (!userId || !serviceId) {
      return res.status(400).json({
        success: false,
        message: "userId and serviceId are required",
      });
    }

    // Check if user already has a booking for this service
    const existingBooking = await Booking.findOne({
      userId: userId,
      serviceId: serviceId,
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message:
          "You have already requested this tour. Only one request per service is allowed.",
        existingBookingId: existingBooking._id,
        status: existingBooking.status,
      });
    }

    // Create new booking
    const booking = new Booking(req.body);
    const saved = await booking.save();

    res.status(201).json({
      success: true,
      message: "Booking request submitted successfully!",
      bookingId: saved._id,
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

// Get user's bookings
app.get("/api/bookings/user/:userId", async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.params.userId }).sort({
      createdAt: -1,
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== ADMIN — BOOKING ROUTES ====================

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

// ==================== ADMIN — SERVICE ROUTES ====================

app.get("/api/services", async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/services/:id", async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json(service);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/admin/services", async (req, res) => {
  try {
    const service = new Service(req.body);
    const saved = await service.save();
    res.status(201).json({ success: true, service: saved });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch("/api/admin/services/:id", async (req, res) => {
  try {
    const updated = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    res.json({ success: true, service: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/admin/services/:id", async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Service deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

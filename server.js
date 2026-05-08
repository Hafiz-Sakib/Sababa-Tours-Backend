const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://sababa-tours.vercel.app",
      "https://sababa-tours-backend.onrender.com",
    ],
    credentials: true,
  }),
);

app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ==================== SCHEMA ====================
const bookingSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userEmail: { type: String, required: true },
  userName: String,

  serviceId: String,
  serviceName: { type: String, required: true },
  serviceBalance: String,

  travelers: { type: Number, required: true },
  preferredDate: { type: Date, required: true },
  totalAmount: { type: Number, required: true },

  // NEW FIELDS
  phoneNumber: { type: String, required: true },
  address: { type: String, required: true },

  status: {
    type: String,
    default: "pending",
    enum: ["pending", "confirmed", "cancelled"],
  },
  createdAt: { type: Date, default: Date.now },
});

const Booking = mongoose.model("Booking", bookingSchema);

// Create Booking
app.post("/api/bookings", async (req, res) => {
  try {
    console.log("📥 Received Data:", req.body); // ← For debugging
    const booking = new Booking(req.body);
    const saved = await booking.save();
    console.log("✅ Saved Booking:", saved._id);
    res.status(201).json({ success: true, bookingId: saved._id });
  } catch (error) {
    console.error("❌ Save Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Other routes...
app.get("/api/bookings/user/:userId", async (req, res) => {
  const bookings = await Booking.find({ userId: req.params.userId }).sort({
    createdAt: -1,
  });
  res.json(bookings);
});

app.get("/api/admin/bookings", async (req, res) => {
  const bookings = await Booking.find().sort({ createdAt: -1 });
  res.json(bookings);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));

// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose");
require("dotenv").config();

const app = express();

// ==================== CONFIG ====================
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "tour-guide-553b5";

// Comma separated list of admin emails (must be Firebase-verified emails)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "hafizsakib5@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://sababa-tours.vercel.app",
  "https://sababa-tours-backend.onrender.com",
  `https://${FIREBASE_PROJECT_ID}.web.app`,
  `https://${FIREBASE_PROJECT_ID}.firebaseapp.com`,
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
];

const MAX_TRAVELERS = 20;
const BD_PHONE_REGEX = /^(013|014|015|016|017|018|019)\d{8}$/;

// ==================== MIDDLEWARE ====================
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "100kb" }));

// ==================== DATABASE CONNECTION ====================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// ==================== AUTH (Firebase ID token verification) ====================
// No service-account secret needed: Firebase ID tokens are verified against
// Google's public keys.
const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

const verifyFirebaseToken = async (token) => {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  if (!payload.sub) throw new Error("Invalid token subject");
  return payload;
};

const isAdminPayload = (p) =>
  !!p?.email &&
  p.email_verified === true &&
  ADMIN_EMAILS.includes(String(p.email).toLowerCase());

const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/i);
  if (!match) {
    return res.status(401).json({
      success: false,
      message: "Please login to continue.",
    });
  }
  try {
    const payload = await verifyFirebaseToken(match[1]);
    req.user = {
      uid: payload.sub,
      email: payload.email || "",
      name: payload.name || "",
      isAdmin: isAdminPayload(payload),
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Your session is invalid or expired. Please login again.",
    });
  }
};

const requireAdmin = (req, res, next) =>
  requireAuth(req, res, () => {
    if (!req.user.isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required." });
    }
    next();
  });

// ==================== HELPERS ====================
const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id));

const parsePrice = (balance) =>
  parseFloat(String(balance ?? "").replace(/[^0-9.]/g, "")) || 0;

const countWords = (text) => String(text).trim().split(/\s+/).filter(Boolean).length;

// ==================== BOOKING SCHEMA ====================
const bookingSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  userEmail: { type: String, required: true },
  userName: String,
  serviceId: String,
  serviceName: { type: String, required: true },
  serviceBalance: String,
  travelers: { type: Number, required: true, min: 1, max: MAX_TRAVELERS },
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

const SERVICE_FIELDS = [
  "name",
  "about",
  "balance",
  "picture",
  "category",
  "duration",
  "location",
];
const pickServiceFields = (body = {}) => {
  const out = {};
  SERVICE_FIELDS.forEach((f) => {
    if (body[f] !== undefined) out[f] = body[f];
  });
  return out;
};

// ==================== HEALTH CHECK ====================
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Backend is running",
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

// ==================== BOOKING ROUTES (login required) ====================

// Create booking — only logged-in users. Price/service data come from the DB,
// identity comes from the verified token (never from the request body).
app.post("/api/bookings", requireAuth, async (req, res) => {
  try {
    const { serviceId, travelers, preferredDate, phoneNumber, address, notes } =
      req.body || {};

    if (!serviceId || !isValidId(serviceId)) {
      return res
        .status(400)
        .json({ success: false, message: "A valid serviceId is required" });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: "This tour package no longer exists." });
    }

    const travelerCount = Number(travelers);
    if (
      !Number.isInteger(travelerCount) ||
      travelerCount < 1 ||
      travelerCount > MAX_TRAVELERS
    ) {
      return res.status(400).json({
        success: false,
        message: `Travelers must be between 1 and ${MAX_TRAVELERS}`,
      });
    }

    const date = new Date(preferredDate);
    if (!preferredDate || Number.isNaN(date.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: "A valid travel date is required" });
    }
    // 24h grace so timezone differences never reject "today"
    if (date.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
      return res
        .status(400)
        .json({ success: false, message: "Travel date cannot be in the past" });
    }

    const phone = String(phoneNumber || "").trim();
    if (!BD_PHONE_REGEX.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid Bangladeshi phone number (e.g. 017XXXXXXXX)",
      });
    }

    const addr = String(address || "").trim();
    if (!addr) {
      return res
        .status(400)
        .json({ success: false, message: "Address is required" });
    }
    if (countWords(addr) > 30) {
      return res
        .status(400)
        .json({ success: false, message: "Address must not exceed 30 words" });
    }

    const price = parsePrice(service.balance);
    if (price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price is not set for this package. Please contact us.",
      });
    }

    // One active request per user per service (cancelled ones don't count)
    const existingBooking = await Booking.findOne({
      userId: req.user.uid,
      serviceId: String(service._id),
      status: { $ne: "cancelled" },
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

    const fallbackName =
      req.user.name ||
      (typeof req.body.userName === "string" ? req.body.userName.trim() : "") ||
      req.user.email.split("@")[0];

    const booking = new Booking({
      userId: req.user.uid,
      userEmail: req.user.email || "unknown",
      userName: fallbackName.slice(0, 100),
      serviceId: String(service._id),
      serviceName: service.name,
      serviceBalance: service.balance,
      travelers: travelerCount,
      preferredDate: date,
      totalAmount: Math.round(price * travelerCount),
      phoneNumber: phone,
      address: addr,
      notes: typeof notes === "string" ? notes.trim().slice(0, 500) : undefined,
      status: "pending",
    });
    const saved = await booking.save();

    res.status(201).json({
      success: true,
      message: "Booking request submitted successfully!",
      bookingId: saved._id,
      totalAmount: saved.totalAmount,
    });
  } catch (error) {
    console.error("Booking Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to create booking" });
  }
});

// Get user's own bookings (admin may view anyone's)
app.get("/api/bookings/user/:userId", requireAuth, async (req, res) => {
  try {
    if (req.params.userId !== req.user.uid && !req.user.isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "You can only view your own bookings." });
    }
    const bookings = await Booking.find({ userId: req.params.userId }).sort({
      createdAt: -1,
    });
    res.json(bookings);
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

// Cancel your own booking (only while it is still pending)
app.patch("/api/bookings/:id/cancel", requireAuth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid booking id" });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking || (booking.userId !== req.user.uid && !req.user.isAdmin)) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }
    if (booking.status === "cancelled") {
      return res.json({ success: true, booking });
    }
    if (booking.status !== "pending" && !req.user.isAdmin) {
      return res.status(409).json({
        success: false,
        message:
          "This booking is already confirmed. Please contact us to change it.",
      });
    }
    booking.status = "cancelled";
    await booking.save();
    res.json({ success: true, booking });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel booking" });
  }
});

// ==================== ADMIN — BOOKING ROUTES ====================

app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

app.patch("/api/admin/bookings/:id", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid booking id" });
    }
    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }
    res.json({ success: true, booking: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update booking" });
  }
});

app.delete("/api/admin/bookings/:id", requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid booking id" });
    }
    const deleted = await Booking.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }
    res.json({ success: true, message: "Booking deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to delete booking" });
  }
});

// ==================== SERVICE ROUTES ====================

// Public: anyone (logged in or not) can view all packages
app.get("/api/services", async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load services" });
  }
});

app.get("/api/services/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ message: "Service not found" });
    }
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json(service);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load service" });
  }
});

// ==================== ADMIN — SERVICE ROUTES ====================

app.post("/api/admin/services", requireAdmin, async (req, res) => {
  try {
    const service = new Service(pickServiceFields(req.body));
    const saved = await service.save();
    res.status(201).json({ success: true, service: saved });
  } catch (error) {
    const status = error.name === "ValidationError" ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

app.patch("/api/admin/services/:id", requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    const updated = await Service.findByIdAndUpdate(
      req.params.id,
      pickServiceFields(req.body),
      { new: true, runValidators: true },
    );
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    res.json({ success: true, service: updated });
  } catch (error) {
    const status = error.name === "ValidationError" ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

app.delete("/api/admin/services/:id", requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    const deleted = await Service.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    }
    res.json({ success: true, message: "Service deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to delete service" });
  }
});

// ==================== FALLBACKS ====================
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Malformed JSON etc.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }
  console.error(err);
  res.status(500).json({ success: false, message: "Server error" });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

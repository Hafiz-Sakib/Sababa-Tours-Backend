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

// ---- Customer change window ----
// A customer may edit / cancel a booking only until LOCK_DAYS days before the trip date.
// The admin is never limited by this. Days are counted in Bangladesh time (UTC+6), because
// the trip date is saved as the chosen calendar day at 00:00 UTC.
const LOCK_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
const daysUntilTrip = (date) =>
  Math.floor(new Date(date).getTime() / DAY_MS) -
  Math.floor((Date.now() + BD_OFFSET_MS) / DAY_MS);
const LOCK_MESSAGE = `Changes and cancellations close ${LOCK_DAYS} days before the trip. Please contact our travel desk for help.`;
const PAST_MESSAGE =
  "This trip date has passed, so the booking can no longer be changed.";
const lockMessageFor = (date) =>
  daysUntilTrip(date) < 0 ? PAST_MESSAGE : LOCK_MESSAGE;

// ---- Advance payment ----
// Admin confirms a booking -> the client must pay a 30% advance within 72 hours (status "awaiting_payment").
// Advance paid -> "confirmed" automatically. Not paid in time -> auto-cancelled (see sweepExpired).
// Payments are marked paid immediately (no manual verification).
const ADVANCE_PERCENT = 30;
const HOLD_HOURS = 72;
// true  = advance is asked only when that trip date is still free in the schedule
// false = advance is asked on every confirmation
const ADVANCE_ONLY_WHEN_SCHEDULE_FREE = true;
const PAY_METHODS = ["bKash", "Nagad", "Bank", "Card"];

const advanceFor = (total) => Math.ceil((Number(total) * ADVANCE_PERCENT) / 100);

// trip dates are saved as the chosen calendar day at 00:00 UTC
const dayRange = (date) => {
  const start = Math.floor(new Date(date).getTime() / DAY_MS) * DAY_MS;
  return { $gte: new Date(start), $lt: new Date(start + DAY_MS) };
};

// match a booking by its paidAmount even when old documents have no paidAmount field yet
const paidIs = (paid) =>
  paid === 0
    ? { $or: [{ paidAmount: 0 }, { paidAmount: { $exists: false } }] }
    : { paidAmount: paid };

// Validates the editable booking fields. Returns { fields } or { error }.
// Only fields that are present in the body are checked and returned.
const parseBookingFields = (body = {}) => {
  const fields = {};

  if (body.travelers !== undefined) {
    const n = Number(body.travelers);
    if (!Number.isInteger(n) || n < 1 || n > MAX_TRAVELERS) {
      return { error: `Travelers must be between 1 and ${MAX_TRAVELERS}` };
    }
    fields.travelers = n;
  }

  if (body.preferredDate !== undefined) {
    const d = new Date(body.preferredDate);
    if (!body.preferredDate || Number.isNaN(d.getTime())) {
      return { error: "A valid travel date is required" };
    }
    fields.preferredDate = d;
  }

  if (body.phoneNumber !== undefined) {
    const phone = String(body.phoneNumber || "").trim();
    if (!BD_PHONE_REGEX.test(phone)) {
      return {
        error: "Enter a valid Bangladeshi phone number (e.g. 017XXXXXXXX)",
      };
    }
    fields.phoneNumber = phone;
  }

  if (body.address !== undefined) {
    const addr = String(body.address || "").trim();
    if (!addr) return { error: "Address is required" };
    if (countWords(addr) > 30) {
      return { error: "Address must not exceed 30 words" };
    }
    fields.address = addr;
  }

  if (body.notes !== undefined) {
    fields.notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : "";
  }

  return { fields };
};

// Total = package price x travelers. Uses the price saved on the booking and
// falls back to the live package price if that is missing.
const totalFor = async (booking) => {
  let price = parsePrice(booking.serviceBalance);
  if (price <= 0 && booking.serviceId && isValidId(booking.serviceId)) {
    const service = await Service.findById(booking.serviceId);
    price = parsePrice(service?.balance);
  }
  return price > 0 ? Math.round(price * booking.travelers) : booking.totalAmount;
};

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
    enum: ["pending", "awaiting_payment", "confirmed", "cancelled"],
  },
  // advance / billing
  advanceRequired: { type: Boolean, default: false },
  advanceAmount: { type: Number, default: 0 },
  confirmedAt: Date,
  payDeadline: Date, // confirmedAt + 72 h, cleared once the advance is paid
  cancelReason: String, // "advance_not_paid" | "customer" | "admin"
  paidAmount: { type: Number, default: 0 },
  payments: [
    {
      amount: { type: Number, required: true },
      method: String,
      ref: String, // transaction id shown on the receipt
      brand: String, // card brand (cards only)
      last4: String, // last four digits (cards only, never the full number)
      account: String, // masked wallet number (bKash / Nagad)
      paidAt: { type: Date, default: Date.now },
    },
  ],
  invoiceNo: String,
  createdAt: { type: Date, default: Date.now },
});

const Booking = mongoose.model("Booking", bookingSchema);

// Cancel every booking whose 72 hours ran out without the 30% advance.
// Runs every minute, and also at the start of the routes below (Render's free instance may have been asleep).
const sweepExpired = async () => {
  try {
    await Booking.updateMany(
      {
        status: "awaiting_payment",
        payDeadline: { $lte: new Date() },
        $expr: { $lt: [{ $ifNull: ["$paidAmount", 0] }, "$advanceAmount"] },
      },
      { $set: { status: "cancelled", cancelReason: "advance_not_paid", payDeadline: null } },
    );
  } catch (e) {
    console.error("Sweep error:", e.message);
  }
};
setInterval(sweepExpired, 60 * 1000);

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
    await sweepExpired();
    const bookings = await Booking.find({ userId: req.params.userId }).sort({
      createdAt: -1,
    });
    res.json(bookings);
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

// Edit your own booking: until LOCK_DAYS days before the trip. A confirmed booking goes back
// to "pending" so the admin can review the new details.
app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid booking id" });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking || booking.userId !== req.user.uid) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.status === "cancelled") {
      return res
        .status(409)
        .json({ success: false, message: "A cancelled booking cannot be edited." });
    }
    if (daysUntilTrip(booking.preferredDate) < LOCK_DAYS) {
      return res
        .status(403)
        .json({ success: false, message: lockMessageFor(booking.preferredDate) });
    }

    const { fields, error } = parseBookingFields(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    if (!Object.keys(fields).length) {
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }
    if (fields.preferredDate && daysUntilTrip(fields.preferredDate) < LOCK_DAYS) {
      return res.status(400).json({
        success: false,
        message: `The new trip date must be at least ${LOCK_DAYS} days from today.`,
      });
    }

    Object.assign(booking, fields);
    booking.totalAmount = await totalFor(booking);
    booking.advanceAmount = advanceFor(booking.totalAmount);
    // a confirmed / awaiting-advance booking goes back to "pending" for re-approval; payments made so far are kept
    if (booking.status === "confirmed" || booking.status === "awaiting_payment") {
      booking.status = "pending";
      booking.payDeadline = null;
    }
    await booking.save();
    res.json({ success: true, booking });
  } catch (error) {
    console.error("Edit booking error:", error);
    res.status(500).json({ success: false, message: "Failed to update booking" });
  }
});

// Cancel your own booking (pending or confirmed) until LOCK_DAYS days before the trip
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
    if (!req.user.isAdmin && daysUntilTrip(booking.preferredDate) < LOCK_DAYS) {
      return res
        .status(403)
        .json({ success: false, message: lockMessageFor(booking.preferredDate) });
    }
    booking.status = "cancelled";
    booking.payDeadline = null;
    booking.cancelReason = req.user.isAdmin && booking.userId !== req.user.uid ? "admin" : "customer";
    await booking.save(); // paidAmount / payments stay on the record so a refund can be arranged
    res.json({ success: true, booking });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel booking" });
  }
});

// Pay for your own booking. Any whole amount from 1 up to the balance; marked paid immediately.
// While "awaiting_payment": once the total paid reaches the 30% advance the booking becomes "confirmed" by itself.
app.post("/api/bookings/:id/pay", requireAuth, async (req, res) => {
  try {
    await sweepExpired();
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid booking id" });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking || booking.userId !== req.user.uid) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.status === "cancelled") {
      return res.status(409).json({
        success: false,
        message:
          booking.cancelReason === "advance_not_paid"
            ? `The ${ADVANCE_PERCENT}% advance was not paid within ${HOLD_HOURS} hours, so this booking was cancelled.`
            : "This booking is cancelled, so it cannot be paid.",
      });
    }
    if (booking.status === "pending") {
      return res.status(409).json({
        success: false,
        message: "You can pay once our team approves this booking.",
      });
    }

    const amount = Number(req.body?.amount);
    const method = PAY_METHODS.includes(req.body?.method) ? req.body.method : "Online";
    // optional receipt details sent by the checkout (sanitised, never full card numbers)
    const clean = (v, max) => String(v || "").replace(/[^\w •*-]/g, "").slice(0, max);
    const extra = {
      ref: clean(req.body?.ref, 24),
      brand: clean(req.body?.brand, 12),
      last4: String(req.body?.last4 || "").replace(/\D/g, "").slice(-4),
      account: clean(req.body?.account, 16),
    };
    const paid = booking.paidAmount || 0;
    const balance = booking.totalAmount - paid;
    if (balance <= 0) {
      return res.status(409).json({ success: false, message: "This booking is already paid in full." });
    }
    if (!Number.isInteger(amount) || amount < 1 || amount > balance) {
      return res.status(400).json({
        success: false,
        message: `Enter a whole amount between 1 and ${balance}.`,
      });
    }

    // atomic: only applies if nobody paid / cancelled in between
    let updated = await Booking.findOneAndUpdate(
      { _id: booking._id, userId: req.user.uid, status: booking.status, ...paidIs(paid) },
      {
        $inc: { paidAmount: amount },
        $push: { payments: { amount, method, ...extra, paidAt: new Date() } },
      },
      { new: true },
    );
    if (!updated) {
      return res
        .status(409)
        .json({ success: false, message: "The booking changed. Please refresh and try again." });
    }

    const advance = updated.advanceAmount > 0 ? updated.advanceAmount : advanceFor(updated.totalAmount);
    if (updated.status === "awaiting_payment" && updated.paidAmount >= advance) {
      updated =
        (await Booking.findOneAndUpdate(
          { _id: updated._id, status: "awaiting_payment" },
          { $set: { status: "confirmed", payDeadline: null, advanceAmount: advance } },
          { new: true },
        )) || updated;
    }
    res.json({ success: true, booking: updated });
  } catch (error) {
    console.error("Pay booking error:", error);
    res.status(500).json({ success: false, message: "Payment failed. Please try again." });
  }
});

// Delete your own booking: only after it has been cancelled
app.delete("/api/bookings/:id", requireAuth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid booking id" });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking || booking.userId !== req.user.uid) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.status !== "cancelled") {
      return res.status(409).json({
        success: false,
        message: "Please cancel the booking first, then delete it.",
      });
    }
    await booking.deleteOne();
    res.json({ success: true, message: "Booking deleted" });
  } catch (error) {
    console.error("Delete booking error:", error);
    res.status(500).json({ success: false, message: "Failed to delete booking" });
  }
});

// ==================== ADMIN — BOOKING ROUTES ====================

app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
  try {
    await sweepExpired();
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

// Admin: change the status and/or any editable detail. No date limit for the admin.
app.patch("/api/admin/bookings/:id", requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid booking id" });
    }
    const { status } = req.body || {};
    if (status !== undefined && !["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const { fields, error } = parseBookingFields(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    if (status === undefined && !Object.keys(fields).length) {
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }

    await sweepExpired(); // before loading, so an expired booking is not revived by a stale copy
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    Object.assign(booking, fields);
    if (fields.travelers) {
      booking.totalAmount = await totalFor(booking);
      if (booking.advanceAmount > 0) booking.advanceAmount = advanceFor(booking.totalAmount);
    }

    if (status === "confirmed") {
      if (booking.status === "confirmed" || booking.status === "awaiting_payment") {
        return res.status(409).json({ success: false, message: "This booking is already confirmed." });
      }
      // Is the trip date still free in the schedule?
      const busy = await Booking.exists({
        _id: { $ne: booking._id },
        status: { $in: ["confirmed", "awaiting_payment"] },
        preferredDate: dayRange(booking.preferredDate),
      });
      const needAdvance = !ADVANCE_ONLY_WHEN_SCHEDULE_FREE || !busy;
      booking.advanceAmount = advanceFor(booking.totalAmount);
      booking.cancelReason = undefined;
      if (needAdvance && (booking.paidAmount || 0) < booking.advanceAmount) {
        booking.status = "awaiting_payment";
        booking.advanceRequired = true;
        booking.confirmedAt = new Date();
        booking.payDeadline = new Date(Date.now() + HOLD_HOURS * 60 * 60 * 1000);
      } else {
        booking.status = "confirmed";
        booking.advanceRequired = false;
        booking.confirmedAt = new Date();
        booking.payDeadline = null;
      }
    } else if (status !== undefined) {
      booking.status = status;
      booking.payDeadline = null;
      if (status === "cancelled") booking.cancelReason = "admin";
    }

    await booking.save();
    res.json({ success: true, booking });
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

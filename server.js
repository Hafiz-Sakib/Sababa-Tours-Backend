// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose");
require("dotenv").config();
const mail = require("./mailer");
const { parseExtras, checkConsistency, CATEGORIES, ROOM_TYPES, BED_TYPES, MEAL_PLANS, FLIGHT_MODES, CABINS } = require("./extras");

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
// Allow the fixed list above plus any Vercel deployment/preview of this project
const vercelOrigin = /^https:\/\/sababa-tours[a-z0-9-]*\.vercel\.app$/i;
app.use(
  cors({
    origin: (origin, cb) => {
      // no Origin header = server-to-server / curl / health pings
      if (!origin || allowedOrigins.includes(origin) || vercelOrigin.test(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "100kb" }));

// ==================== DATABASE CONNECTION ====================
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is NOT set. Add it in Render > Environment.");
}
mongoose
  .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
  .then(() => console.log(`✅ MongoDB Connected Successfully (db: ${mongoose.connection.name})`))
  .catch((err) => {
    // name + message tell the cause: bad auth / IP not allowed (Atlas Network Access) / bad URI
    console.error(`❌ MongoDB Connection Error [${err.name}]: ${err.message}`);
  });

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
const ADVANCE_ONLY_WHEN_SCHEDULE_FREE = false;
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
  servicePicture: String, // snapshot of the package picture + place, so My Bookings still shows them if the package is removed
  serviceLocation: String,
  travelers: { type: Number, required: true, min: 1, max: MAX_TRAVELERS },
  preferredDate: { type: Date, required: true },
  totalAmount: { type: Number, required: true },
  phoneNumber: { type: String, required: true },
  address: { type: String, required: true },
  notes: String,
  // ---- extra booking information (validated by extras.js) ----
  category: { type: String, enum: CATEGORIES }, // Family | Couple | Friends | Solo | Corporate
  traveler: {
    fullName: String, // lead traveler
    nationality: String,
    children: { type: Number, default: 0 }, // adults = travelers - children
    emergencyName: String,
    emergencyPhone: String,
  },
  hotel: {
    needed: Boolean, // false = the customer has their own stay
    roomType: { type: String, enum: ROOM_TYPES },
    rooms: Number,
    bedType: { type: String, enum: BED_TYPES },
    mealPlan: { type: String, enum: MEAL_PLANS },
    nights: Number, // check-in = trip date, check-out = trip date + nights
    requests: String,
  },
  flight: {
    mode: { type: String, enum: FLIGHT_MODES }, // own | arrange | none
    departFrom: String,
    airline: String,
    flightNo: String,
    arrivalTime: String, // "HH:MM" at the destination
    returnFlightNo: String,
    returnDate: Date,
    cabin: { type: String, enum: CABINS }, // when the desk arranges the flight
    roundTrip: Boolean,
  },
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
  reminderSent: { type: Boolean, default: false }, // the "24 h left" e-mail went out
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
      currency: { type: String, default: "BDT" },
      status: { type: String, default: "paid" },
      payerName: String, // who paid (from the verified login)
      payerEmail: String,
      balanceAfter: Number, // what was still due after this payment
      paidAt: { type: Date, default: Date.now },
    },
  ],
  invoiceNo: String,
  createdAt: { type: Date, default: Date.now },
});

const Booking = mongoose.model("Booking", bookingSchema);

// ---- Payment ledger ----
// Every payment is also saved as its own document (an audit trail that survives even if a booking is
// deleted later). Card numbers, CVC and wallet PINs are NEVER stored: only brand, last four digits and
// a masked wallet number, exactly as on the receipt.
const paymentSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  userEmail: String,
  userName: String,
  serviceName: String,
  amount: { type: Number, required: true },
  currency: { type: String, default: "BDT" },
  method: String,
  ref: { type: String, index: true },
  brand: String,
  last4: String,
  account: String,
  status: { type: String, default: "paid", enum: ["paid", "refunded"] },
  paidTotalAfter: Number, // booking.paidAmount after this payment
  balanceAfter: Number,
  bookingStatusAfter: String,
  paidAt: { type: Date, default: Date.now },
});
const Payment = mongoose.model("Payment", paymentSchema);

// Cancel every booking whose 72 hours ran out without the 30% advance, and send the "24 h left" reminder.
// Runs every minute, and also at the start of the routes below (Render's free instance may have been asleep).
// Every change is a guarded findOneAndUpdate, so even if two sweeps overlap each mail goes out only once.
const advanceUnpaid = { $expr: { $lt: [{ $ifNull: ["$paidAmount", 0] }, "$advanceAmount"] } };
const sweepExpired = async () => {
  try {
    const now = new Date();

    const expired = await Booking.find({ status: "awaiting_payment", payDeadline: { $lte: now }, ...advanceUnpaid }).select("_id");
    for (const { _id } of expired) {
      const done = await Booking.findOneAndUpdate(
        { _id, status: "awaiting_payment", payDeadline: { $lte: now }, ...advanceUnpaid },
        { $set: { status: "cancelled", cancelReason: "advance_not_paid", payDeadline: null } },
        { new: true },
      );
      if (done) mail.cancelled(done);
    }

    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const due = await Booking.find({ status: "awaiting_payment", reminderSent: { $ne: true }, payDeadline: { $gt: now, $lte: soon }, ...advanceUnpaid }).select("_id");
    for (const { _id } of due) {
      const done = await Booking.findOneAndUpdate(
        { _id, status: "awaiting_payment", reminderSent: { $ne: true } },
        { $set: { reminderSent: true } },
        { new: true },
      );
      if (done) mail.reminder(done);
    }
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

// ==================== BLOG SCHEMA ====================
// Collection name in MongoDB: "blogs"
const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, index: true },
    category: { type: String, default: "Travel Tips", trim: true, maxlength: 40 },
    excerpt: { type: String, required: true, trim: true, maxlength: 400 },
    body: {
      type: [String], // one string per paragraph
      validate: { validator: (v) => Array.isArray(v) && v.length > 0, message: "The article body is required" },
    },
    image: { type: String, default: "" },
    author: { type: String, default: "Sababa Travel Desk", trim: true, maxlength: 80 },
    tags: { type: [String], default: [] },
    readMinutes: { type: Number, default: 3 },
    featured: { type: Boolean, default: false }, // shown big at the top of the Travel Blog (only one at a time)
    published: { type: Boolean, default: true, index: true }, // false = draft, hidden from the public
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
const Blog = mongoose.model("Blog", blogSchema);

const slugify = (t) =>
  String(t || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";

const uniqueSlug = async (title, ignoreId) => {
  const base = slugify(title);
  let slug = base;
  for (let i = 2; await Blog.exists({ slug, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) }); i++) slug = `${base}-${i}`;
  return slug;
};

// accepts body as a string (paragraphs split by a blank line) or as an array of paragraphs
const toParagraphs = (b) =>
  (Array.isArray(b) ? b : String(b || "").split(/\n\s*\n/)).map((p) => String(p).trim()).filter(Boolean);

const BLOG_FIELDS = ["title", "category", "excerpt", "image", "author", "published", "featured"];
const pickBlogFields = (body = {}) => {
  const out = {};
  BLOG_FIELDS.forEach((f) => {
    if (body[f] !== undefined) out[f] = body[f];
  });
  if (body.body !== undefined) {
    out.body = toParagraphs(body.body);
    out.readMinutes = Math.max(1, Math.round(out.body.join(" ").split(/\s+/).filter(Boolean).length / 200));
  }
  if (body.tags !== undefined) {
    const list = Array.isArray(body.tags) ? body.tags : String(body.tags).split(",");
    out.tags = list.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
  }
  return out;
};

// ==================== RATE LIMIT (tiny, in memory, no extra package) ====================
// Stops one account from spamming requests. Counts per logged-in user (falls back to IP).
const rateLimit = ({ windowMs, max, message }) => {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, 5 * 60 * 1000).unref();
  return (req, res, next) => {
    const key = req.user?.uid || req.ip;
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset <= now) h = { count: 0, reset: now + windowMs };
    h.count += 1;
    hits.set(key, h);
    if (h.count > max) {
      res.set("Retry-After", String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ success: false, message: message || "Too many requests. Please try again later." });
    }
    next();
  };
};
const bookingLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: "Too many booking requests. Please try again in an hour or call our desk." });
const changeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, message: "Too many changes in a short time. Please try again later." });

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
app.post("/api/bookings", requireAuth, bookingLimiter, async (req, res) => {
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

    // category, lead traveler, hotel room and flight details
    const { fields: extras, error: extrasError } = parseExtras(req.body, { requireAll: true, tripDate: date });
    if (extrasError) return res.status(400).json({ success: false, message: extrasError });
    const consistency = checkConsistency({ travelers: travelerCount, ...extras });
    if (consistency) return res.status(400).json({ success: false, message: consistency });

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
      servicePicture: service.picture,
      serviceLocation: service.location,
      travelers: travelerCount,
      preferredDate: date,
      totalAmount: Math.round(price * travelerCount),
      phoneNumber: phone,
      address: addr,
      notes: typeof notes === "string" ? notes.trim().slice(0, 500) : undefined,
      ...extras,
      status: "pending",
    });
    const saved = await booking.save();
    mail.newRequest(saved);

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
app.patch("/api/bookings/:id", requireAuth, changeLimiter, async (req, res) => {
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
    const hasExtras = ["category", "traveler", "hotel", "flight"].some((k) => req.body?.[k] !== undefined);
    if (!Object.keys(fields).length && !hasExtras) {
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }
    if (fields.preferredDate && daysUntilTrip(fields.preferredDate) < LOCK_DAYS) {
      return res.status(400).json({
        success: false,
        message: `The new trip date must be at least ${LOCK_DAYS} days from today.`,
      });
    }

    const tripDate = fields.preferredDate || booking.preferredDate;
    const { fields: extras, error: extrasError } = parseExtras(req.body, { tripDate });
    if (extrasError) return res.status(400).json({ success: false, message: extrasError });

    Object.assign(booking, fields, extras);
    const consistency = checkConsistency(booking);
    if (consistency) return res.status(400).json({ success: false, message: consistency });
    booking.totalAmount = await totalFor(booking);
    booking.advanceAmount = advanceFor(booking.totalAmount);
    // a confirmed / awaiting-advance booking goes back to "pending" for re-approval; payments made so far are kept
    if (booking.status === "confirmed" || booking.status === "awaiting_payment") {
      booking.status = "pending";
      booking.payDeadline = null;
    }
    await booking.save();
    mail.customerEdited(booking);
    res.json({ success: true, booking });
  } catch (error) {
    console.error("Edit booking error:", error);
    res.status(500).json({ success: false, message: "Failed to update booking" });
  }
});

// Cancel your own booking (pending or confirmed) until LOCK_DAYS days before the trip
app.patch("/api/bookings/:id/cancel", requireAuth, changeLimiter, async (req, res) => {
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
    if (booking.cancelReason === "customer") mail.customerCancelled(booking);
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
    // the same payment sent twice (double click, retry, duplicate request) must be counted once
    if (extra.ref && (booking.payments || []).some((p) => p.ref === extra.ref)) {
      return res.json({ success: true, booking });
    }
    const paid = booking.paidAmount || 0;
    const balance = booking.totalAmount - paid;
    if (balance <= 0) {
      return res.status(409).json({ success: false, message: "This booking is already paid in full.", booking });
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
        $push: {
          payments: {
            amount,
            method,
            ...extra,
            currency: "BDT",
            status: "paid",
            payerName: (req.user.name || booking.userName || "").slice(0, 100),
            payerEmail: req.user.email,
            balanceAfter: balance - amount,
            paidAt: new Date(),
          },
        },
      },
      { new: true },
    );
    if (!updated) {
      return res
        .status(409)
        .json({ success: false, message: "The booking changed. Please refresh and try again.", booking: (await Booking.findById(booking._id)) || undefined });
    }

    const advance = updated.advanceAmount > 0 ? updated.advanceAmount : advanceFor(updated.totalAmount);
    const wasAwaiting = updated.status === "awaiting_payment";
    if (updated.status === "awaiting_payment" && updated.paidAmount >= advance) {
      updated =
        (await Booking.findOneAndUpdate(
          { _id: updated._id, status: "awaiting_payment" },
          { $set: { status: "confirmed", payDeadline: null, advanceAmount: advance } },
          { new: true },
        )) || updated;
    }
    if (wasAwaiting && updated.status === "confirmed") mail.confirmed(updated);
    // ledger copy of this payment (a failure here must never undo a payment that was already counted)
    try {
      await Payment.create({
        bookingId: String(updated._id),
        userId: updated.userId,
        userEmail: updated.userEmail,
        userName: updated.userName,
        serviceName: updated.serviceName,
        amount,
        method,
        ref: extra.ref || undefined,
        brand: extra.brand || undefined,
        last4: extra.last4 || undefined,
        account: extra.account || undefined,
        paidTotalAfter: updated.paidAmount,
        balanceAfter: Math.max(0, updated.totalAmount - updated.paidAmount),
        bookingStatusAfter: updated.status,
      });
    } catch (e) {
      console.error("Payment ledger error:", e.message);
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
    const hasExtras = ["category", "traveler", "hotel", "flight"].some((k) => req.body?.[k] !== undefined);
    if (status === undefined && !Object.keys(fields).length && !hasExtras) {
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }

    await sweepExpired(); // before loading, so an expired booking is not revived by a stale copy
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }
    const prevStatus = booking.status;

    const { fields: extras, error: extrasError } = parseExtras(req.body, { tripDate: fields.preferredDate || booking.preferredDate });
    if (extrasError) return res.status(400).json({ success: false, message: extrasError });
    Object.assign(booking, fields, extras);
    if (hasExtras || fields.travelers) {
      const consistency = checkConsistency(booking);
      if (consistency) return res.status(400).json({ success: false, message: consistency });
    }
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
        booking.reminderSent = false;
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
    if (status === "confirmed") {
      if (booking.status === "awaiting_payment") mail.awaitingPayment(booking);
      else if (booking.status === "confirmed") mail.confirmed(booking);
    } else if (status === "cancelled" && prevStatus !== "cancelled") {
      mail.cancelled(booking);
    }
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

// Admin: the payment ledger (every payment ever made). Optional ?bookingId=… or ?userId=…
app.get("/api/admin/payments", requireAdmin, async (req, res) => {
  try {
    const q = {};
    if (req.query.bookingId) q.bookingId = String(req.query.bookingId);
    if (req.query.userId) q.userId = String(req.query.userId);
    const payments = await Payment.find(q).sort({ paidAt: -1 }).limit(1000);
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load payments" });
  }
});

// Customer: their own payment history
app.get("/api/payments/mine", requireAuth, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.uid }).sort({ paidAt: -1 }).limit(500);
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load payments" });
  }
});

// Public: which calendar days already have a confirmed / awaiting-payment trip. Dates only, no personal data.
// Used by the booking calendar to mark busy days. Trip dates are stored as the chosen day at 00:00 UTC.
app.get("/api/schedule/busy", async (req, res) => {
  try {
    const from = new Date(Date.now() - DAY_MS);
    const rows = await Booking.find({
      status: { $in: ["confirmed", "awaiting_payment"] },
      preferredDate: { $gte: from },
    }).select("preferredDate -_id");
    const days = [...new Set(rows.map((r) => new Date(r.preferredDate).toISOString().slice(0, 10)))].sort();
    res.set("Cache-Control", "public, max-age=60");
    res.json({ days });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load schedule" });
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

// ==================== BLOG ROUTES ====================

// Public: published blogs only, newest first
app.get("/api/blogs", async (req, res) => {
  try {
    const blogs = await Blog.find({ published: true }).sort({ featured: -1, publishedAt: -1 }).lean();
    res.json(blogs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load blogs" });
  }
});

// Public: one published blog by id or slug
app.get("/api/blogs/:idOrSlug", async (req, res) => {
  try {
    const key = req.params.idOrSlug;
    const blog = await Blog.findOne({ published: true, ...(isValidId(key) ? { _id: key } : { slug: key }) }).lean();
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json(blog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load blog" });
  }
});

// Admin: everything, drafts included
app.get("/api/admin/blogs", requireAdmin, async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ publishedAt: -1 }).lean();
    res.json(blogs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load blogs" });
  }
});

app.post("/api/admin/blogs", requireAdmin, async (req, res) => {
  try {
    const fields = pickBlogFields(req.body);
    fields.slug = await uniqueSlug(fields.title);
    if (fields.featured) await Blog.updateMany({ featured: true }, { $set: { featured: false } });
    const saved = await new Blog(fields).save();
    res.status(201).json({ success: true, blog: saved });
  } catch (error) {
    const status = error.name === "ValidationError" ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

app.patch("/api/admin/blogs/:id", requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ success: false, message: "Blog not found" });
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: "Blog not found" });
    const fields = pickBlogFields(req.body);
    if (fields.title && fields.title !== blog.title) fields.slug = await uniqueSlug(fields.title, blog._id);
    if (fields.featured) await Blog.updateMany({ _id: { $ne: blog._id }, featured: true }, { $set: { featured: false } });
    blog.set(fields);
    const saved = await blog.save();
    res.json({ success: true, blog: saved });
  } catch (error) {
    const status = error.name === "ValidationError" ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

app.delete("/api/admin/blogs/:id", requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ success: false, message: "Blog not found" });
    const deleted = await Blog.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Blog not found" });
    res.json({ success: true, message: "Blog deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to delete blog" });
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

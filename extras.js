// extras.js
// Extra booking information collected in the booking flow:
//   category  - what kind of trip this is (Family, Couple, ...)
//   traveler  - lead traveler, nationality, children count, emergency contact
//   hotel     - room preference for the stay
//   flight    - the customer's own flight details, or a request for the desk to arrange one
// Everything is validated here on the server (the website validates too, but only the server counts).
// parseExtras() never throws: it returns { fields } or { error }.

const CATEGORIES = ["Family", "Couple", "Friends", "Solo", "Corporate"];
const ROOM_TYPES = ["Standard", "Deluxe", "Family Suite", "Luxury Suite"];
const BED_TYPES = ["Double", "Twin", "Any"];
const MEAL_PLANS = ["Room only", "Breakfast", "Half board", "Full board"];
const FLIGHT_MODES = ["own", "arrange", "none"];
const CABINS = ["Economy", "Premium Economy", "Business"];

const MAX_ROOMS = 10;
const MAX_NIGHTS = 14;

const FLIGHT_NO_REGEX = /^[A-Z0-9]{2}-?\d{1,4}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const INTL_PHONE_REGEX = /^\+?\d{8,15}$/;
const NAME_REGEX = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]{1,79}$/u;

const str = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const oneOf = (v, list) => list.includes(v);
const startOfUtcDay = (d) => Math.floor(new Date(d).getTime() / 86400000) * 86400000;

const parseCategory = (v) => {
  if (!oneOf(v, CATEGORIES)) return { error: `Choose a trip type: ${CATEGORIES.join(", ")}.` };
  return { value: v };
};

const parseTraveler = (v) => {
  if (!isObj(v)) return { error: "Lead traveler details are required." };
  const fullName = str(v.fullName, 80);
  if (!NAME_REGEX.test(fullName)) return { error: "Enter the lead traveler's full name." };
  const nationality = str(v.nationality, 40) || "Bangladeshi";
  const children = v.children === undefined || v.children === "" ? 0 : Number(v.children);
  if (!Number.isInteger(children) || children < 0 || children > 19) {
    return { error: "Children must be a whole number from 0 to 19." };
  }
  const emergencyName = str(v.emergencyName, 80);
  const emergencyPhone = String(v.emergencyPhone ?? "").replace(/[\s-]/g, "");
  if (emergencyName && !NAME_REGEX.test(emergencyName)) return { error: "Enter a valid emergency contact name." };
  if (emergencyPhone && !INTL_PHONE_REGEX.test(emergencyPhone)) return { error: "Enter a valid emergency contact phone number." };
  if (emergencyName && !emergencyPhone) return { error: "Add a phone number for the emergency contact." };
  if (emergencyPhone && !emergencyName) return { error: "Add a name for the emergency contact." };
  return { value: { fullName, nationality, children, emergencyName, emergencyPhone } };
};

const parseHotel = (v) => {
  if (!isObj(v)) return { error: "Hotel details are required." };
  if (!v.needed) return { value: { needed: false } }; // customer has their own stay
  const rooms = Number(v.rooms);
  const nights = Number(v.nights);
  if (!oneOf(v.roomType, ROOM_TYPES)) return { error: "Choose a room type." };
  if (!Number.isInteger(rooms) || rooms < 1 || rooms > MAX_ROOMS) return { error: `Rooms must be between 1 and ${MAX_ROOMS}.` };
  if (!oneOf(v.bedType, BED_TYPES)) return { error: "Choose a bed preference." };
  if (!oneOf(v.mealPlan, MEAL_PLANS)) return { error: "Choose a meal plan." };
  if (!Number.isInteger(nights) || nights < 1 || nights > MAX_NIGHTS) return { error: `Nights must be between 1 and ${MAX_NIGHTS}.` };
  return {
    value: { needed: true, roomType: v.roomType, rooms, bedType: v.bedType, mealPlan: v.mealPlan, nights, requests: str(v.requests, 200) },
  };
};

// tripDate: the booking's trip date, used to check the return date
const parseFlight = (v, tripDate) => {
  if (!isObj(v)) return { error: "Flight details are required." };
  if (!oneOf(v.mode, FLIGHT_MODES)) return { error: "Choose how you will travel to the destination." };
  if (v.mode === "none") return { value: { mode: "none" } };

  const departFrom = str(v.departFrom, 40);
  if (departFrom.length < 2) return { error: "Enter the city you are flying from." };

  if (v.mode === "arrange") {
    if (!oneOf(v.cabin, CABINS)) return { error: "Choose a cabin class." };
    return { value: { mode: "arrange", departFrom, cabin: v.cabin, roundTrip: !!v.roundTrip } };
  }

  // mode === "own"
  const airline = str(v.airline, 40);
  if (airline.length < 2) return { error: "Enter the airline name." };
  const flightNo = String(v.flightNo ?? "").replace(/\s/g, "").toUpperCase();
  if (!FLIGHT_NO_REGEX.test(flightNo)) return { error: "Enter a valid flight number, e.g. BG435." };
  const arrivalTime = String(v.arrivalTime ?? "");
  if (!TIME_REGEX.test(arrivalTime)) return { error: "Enter the arrival time (HH:MM)." };

  const out = { mode: "own", departFrom, airline, flightNo, arrivalTime };

  const returnFlightNo = String(v.returnFlightNo ?? "").replace(/\s/g, "").toUpperCase();
  if (returnFlightNo) {
    if (!FLIGHT_NO_REGEX.test(returnFlightNo)) return { error: "Enter a valid return flight number." };
    out.returnFlightNo = returnFlightNo;
  }
  if (v.returnDate) {
    const d = new Date(v.returnDate);
    if (Number.isNaN(d.getTime())) return { error: "Enter a valid return date." };
    if (tripDate && startOfUtcDay(d) < startOfUtcDay(tripDate)) return { error: "The return date cannot be before the trip date." };
    out.returnDate = d;
  }
  return { value: out };
};

/**
 * Validates the extra booking fields that are present in `body`.
 * opts.requireAll   - creating a booking: every group must be present
 * opts.tripDate     - the (new) trip date, for the return-date check
 * Returns { fields } (only the groups that were sent) or { error }.
 */
const parseExtras = (body = {}, opts = {}) => {
  const fields = {};
  const groups = [
    ["category", (v) => parseCategory(v)],
    ["traveler", (v) => parseTraveler(v)],
    ["hotel", (v) => parseHotel(v)],
    ["flight", (v) => parseFlight(v, opts.tripDate)],
  ];
  for (const [key, fn] of groups) {
    if (body[key] === undefined) {
      if (opts.requireAll) return { error: "Booking details are incomplete. Please refresh the page and try again." };
      continue;
    }
    const r = fn(body[key]);
    if (r.error) return { error: r.error };
    fields[key] = r.value;
  }
  return { fields };
};

// Checks that need the final merged booking (travelers can change independently of children / rooms).
const checkConsistency = (booking) => {
  const travelers = Number(booking.travelers) || 0;
  const children = Number(booking.traveler?.children) || 0;
  if (children >= travelers) return "Children must be fewer than the total number of travelers (at least one adult is needed).";
  if (booking.hotel?.needed && Number(booking.hotel.rooms) > travelers) return "You cannot book more rooms than travelers.";
  return null;
};

module.exports = {
  CATEGORIES, ROOM_TYPES, BED_TYPES, MEAL_PLANS, FLIGHT_MODES, CABINS, MAX_ROOMS, MAX_NIGHTS,
  parseExtras, checkConsistency,
};

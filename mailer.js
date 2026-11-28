// mailer.js
// Booking e-mails (admin alert + customer updates).
//
// Render's free instance blocks SMTP ports, so mail goes out through an HTTPS API instead.
// Pick ONE provider by setting its key in Render > Environment:
//   BREVO_API_KEY   (recommended: free 300 mails/day, you only verify one sender address, no domain needed)
//   RESEND_API_KEY  (free 100/day, but needs a verified domain to mail customers)
// Also set:
//   MAIL_FROM        sender address (for Brevo: the address you verified as a sender)
//   MAIL_FROM_NAME   optional, default "Sababa Tours"
//   ADMIN_NOTIFY_EMAIL  optional, comma list; defaults to ADMIN_EMAILS
//   SITE_URL         optional, default https://sababa-tours.vercel.app
//
// Nothing here ever throws: a mail problem must never break a booking.

const SITE_URL = (process.env.SITE_URL || "https://sababa-tours.vercel.app").replace(/\/$/, "");
const FROM_EMAIL = process.env.MAIL_FROM || "";
const FROM_NAME = process.env.MAIL_FROM_NAME || "Sababa Tours";
const DESK_PHONE = "01516195904";
const ADVANCE_PERCENT = 30;
const HOLD_HOURS = 72;
const LOCK_DAYS = 5;

const adminList = () =>
  String(process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAILS || "hafizsakib5@gmail.com")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

const enabled = () => !!(FROM_EMAIL && (process.env.BREVO_API_KEY || process.env.RESEND_API_KEY));

/* ───────── formatting ───────── */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const bdt = (n) => "BDT " + Math.round(Number(n || 0)).toLocaleString("en-US");
// trip dates are stored as the chosen calendar day at 00:00 UTC
const tripDay = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dhakaTime = (d) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) + " (Bangladesh time)";

/* ───────── sending ───────── */
async function post(url, headers, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  } finally {
    clearTimeout(timer);
  }
}

async function sendMail({ to, subject, html, text }) {
  try {
    const recipients = (Array.isArray(to) ? to : [to]).filter((e) => e && /\S+@\S+\.\S+/.test(e));
    if (!recipients.length) return;
    if (!enabled()) {
      console.log(`✉️  (mail skipped: no provider configured) ${subject}`);
      return;
    }
    if (process.env.BREVO_API_KEY) {
      await post("https://api.brevo.com/v3/smtp/email", { "api-key": process.env.BREVO_API_KEY, accept: "application/json" }, {
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: recipients.map((email) => ({ email })),
        subject,
        htmlContent: html,
        textContent: text,
      });
    } else {
      await post("https://api.resend.com/emails", { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, {
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: recipients,
        subject,
        html,
        text,
      });
    }
    console.log(`✉️  mail sent: ${subject}`);
  } catch (e) {
    console.error("Mail error:", e.message);
  }
}

/* ───────── layout ───────── */
const row = (k, v) =>
  `<tr><td style="padding:6px 0;color:#667085;font-size:13px;width:140px">${esc(k)}</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#101828">${v}</td></tr>`;

const layout = ({ title, intro, rows = [], note = "", button }) => `<!doctype html><html><body style="margin:0;background:#eef6f5;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 14px">
  <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d6e9e7">
    <div style="background:#1f8a84;padding:18px 24px;color:#fff;font-size:18px;font-weight:700">Sababa Tours</div>
    <div style="padding:24px">
      <h1 style="margin:0 0 10px;font-size:20px;color:#101828">${esc(title)}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#344054">${intro}</p>
      ${rows.length ? `<table style="width:100%;border-collapse:collapse;border-top:1px solid #eaecf0;border-bottom:1px solid #eaecf0;margin:8px 0 16px">${rows.join("")}</table>` : ""}
      ${note ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#475467">${note}</p>` : ""}
      ${button ? `<a href="${esc(button.href)}" style="display:inline-block;background:#1f8a84;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px">${esc(button.label)}</a>` : ""}
      ${button ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#667085">Button not working? Copy this link into your browser:<br>${esc(button.href)}</p>` : ""}
    </div>
  </div>
  <p style="text-align:center;font-size:12px;color:#667085;margin:14px 0 0">Questions? Call or WhatsApp our desk: ${DESK_PHONE}</p>
</div></body></html>`;

const tripRows = (b) => [
  row("Trip", esc(b.serviceName)),
  row("Trip date", esc(tripDay(b.preferredDate))),
  row("Travelers", esc(b.travelers)),
  row("Total", esc(bdt(b.totalAmount))),
];
const myBookings = { href: `${SITE_URL}/my-bookings`, label: "Open My Bookings" };
const firstName = (b) => esc(String(b.userName || "").split(" ")[0] || "there");

/* ───────── the notifications ───────── */
const safe = (fn) => (b) => {
  try {
    // fire and forget
    Promise.resolve(fn(b.toObject ? b.toObject() : b)).catch((e) => console.error("Mail error:", e.message));
  } catch (e) {
    console.error("Mail error:", e.message);
  }
};

// 1) new request: tell the admin, and tell the customer it was received
const newRequest = safe(async (b) => {
  const wa = `https://wa.me/88${String(b.phoneNumber || "").replace(/\D/g, "")}`;
  await sendMail({
    to: adminList(),
    subject: `New booking request: ${b.serviceName} (${tripDay(b.preferredDate)})`,
    text: `New request from ${b.userName} (${b.userEmail}, ${b.phoneNumber}) for ${b.serviceName} on ${tripDay(b.preferredDate)}, ${b.travelers} traveler(s), ${bdt(b.totalAmount)}. Open the admin dashboard to confirm.`,
    html: layout({
      title: "New booking request",
      intro: "A customer just sent a request. Please review it and confirm or reply.",
      rows: [
        row("Customer", esc(b.userName)),
        row("Email", esc(b.userEmail)),
        row("Phone", `${esc(b.phoneNumber)} &nbsp;<a href="${wa}" style="color:#1f8a84">WhatsApp</a>`),
        ...tripRows(b),
      ],
      button: { href: `${SITE_URL}/admin`, label: "Open admin dashboard" },
    }),
  });
  await sendMail({
    to: b.userEmail,
    subject: "We received your booking request",
    text: `Hi ${b.userName}, we received your request for ${b.serviceName} on ${tripDay(b.preferredDate)}. Our desk will reply within 24 hours. No payment is needed yet.`,
    html: layout({
      title: `Request received, ${firstName(b)}`,
      intro: "Thank you! Our travel desk will review your request and reply within 24 hours. <b>No payment is needed yet.</b>",
      rows: tripRows(b),
      note: `Once we approve it, you will have <b>${HOLD_HOURS} hours</b> to pay a ${ADVANCE_PERCENT}% advance (${esc(bdt(Math.ceil((b.totalAmount * ADVANCE_PERCENT) / 100)))}) to hold your date. You can change or cancel until ${LOCK_DAYS} days before the trip.`,
      button: myBookings,
    }),
  });
});

// 2) admin approved, advance needed within 72 h
const awaitingPayment = safe(async (b) => {
  await sendMail({
    to: b.userEmail,
    subject: `Approved: pay your ${ADVANCE_PERCENT}% advance to hold ${b.serviceName}`,
    text: `Your booking for ${b.serviceName} is approved. Please pay the advance of ${bdt(b.advanceAmount)} before ${dhakaTime(b.payDeadline)} or it will be cancelled.`,
    html: layout({
      title: "Your booking is approved",
      intro: `Good news, ${firstName(b)}! To hold your date, please pay the advance within <b>${HOLD_HOURS} hours</b>.`,
      rows: [...tripRows(b), row(`Advance (${ADVANCE_PERCENT}%)`, esc(bdt(b.advanceAmount))), row("Pay before", esc(dhakaTime(b.payDeadline)))],
      note: "If the advance is not paid in time, the booking is cancelled automatically.",
      button: { href: `${SITE_URL}/my-bookings/${b._id}/billing`, label: "Pay advance now" },
    }),
  });
});

// 3) reminder: 24 h left
const reminder = safe(async (b) => {
  await sendMail({
    to: b.userEmail,
    subject: `Reminder: advance for ${b.serviceName} is due soon`,
    text: `Your advance of ${bdt(b.advanceAmount)} for ${b.serviceName} is due before ${dhakaTime(b.payDeadline)}. After that the booking is cancelled automatically.`,
    html: layout({
      title: "Less than 24 hours left",
      intro: `Hi ${firstName(b)}, your advance has not been paid yet. After the deadline your booking is <b>cancelled automatically</b>.`,
      rows: [...tripRows(b), row("Advance due", esc(bdt(b.advanceAmount))), row("Pay before", esc(dhakaTime(b.payDeadline)))],
      button: { href: `${SITE_URL}/my-bookings/${b._id}/billing`, label: "Pay advance now" },
    }),
  });
});

// 4) confirmed (admin approved with no advance, or the advance was paid)
const confirmed = safe(async (b) => {
  await sendMail({
    to: b.userEmail,
    subject: `Confirmed: ${b.serviceName} on ${tripDay(b.preferredDate)}`,
    text: `Your booking for ${b.serviceName} on ${tripDay(b.preferredDate)} is confirmed.`,
    html: layout({
      title: "Your trip is confirmed",
      intro: `Great news, ${firstName(b)}! Your booking is confirmed.`,
      rows: [...tripRows(b), row("Paid so far", esc(bdt(b.paidAmount)))],
      note: `You can change or cancel until ${LOCK_DAYS} days before the trip. After that, please contact our desk.`,
      button: myBookings,
    }),
  });
});

// 5) cancelled (by admin, or automatically because the advance was not paid)
const cancelled = safe(async (b) => {
  const why =
    b.cancelReason === "advance_not_paid"
      ? `The ${ADVANCE_PERCENT}% advance was not paid within ${HOLD_HOURS} hours, so the booking was cancelled automatically. You are welcome to send a new request.`
      : "Our travel desk cancelled this booking. Please contact us if you have questions.";
  await sendMail({
    to: b.userEmail,
    subject: `Booking cancelled: ${b.serviceName}`,
    text: `Your booking for ${b.serviceName} was cancelled. ${why}`,
    html: layout({
      title: "Booking cancelled",
      intro: esc(why),
      rows: tripRows(b),
      note: Number(b.paidAmount) > 0 ? `You had paid ${esc(bdt(b.paidAmount))}. Our desk will contact you about it.` : "",
      button: myBookings,
    }),
  });
});

// 6) the customer cancelled or edited: tell the admin
const customerCancelled = safe(async (b) => {
  await sendMail({
    to: adminList(),
    subject: `Customer cancelled: ${b.serviceName}`,
    text: `${b.userName} cancelled ${b.serviceName} (${tripDay(b.preferredDate)}). Paid so far: ${bdt(b.paidAmount)}.`,
    html: layout({
      title: "A customer cancelled",
      intro: `${esc(b.userName)} cancelled their booking.`,
      rows: [row("Email", esc(b.userEmail)), row("Phone", esc(b.phoneNumber)), ...tripRows(b), row("Paid so far", esc(bdt(b.paidAmount)))],
      note: Number(b.paidAmount) > 0 ? "Money was already paid on this booking. A refund may need to be arranged." : "",
      button: { href: `${SITE_URL}/admin`, label: "Open admin dashboard" },
    }),
  });
});

const customerEdited = safe(async (b) => {
  await sendMail({
    to: adminList(),
    subject: `Customer edited a booking: ${b.serviceName}`,
    text: `${b.userName} changed their booking for ${b.serviceName}. It is back to pending and needs your approval.`,
    html: layout({
      title: "Booking edited, needs re-approval",
      intro: `${esc(b.userName)} changed their booking. It is now <b>pending</b> again.`,
      rows: [row("Email", esc(b.userEmail)), row("Phone", esc(b.phoneNumber)), ...tripRows(b)],
      button: { href: `${SITE_URL}/admin`, label: "Open admin dashboard" },
    }),
  });
});

module.exports = { newRequest, awaitingPayment, reminder, confirmed, cancelled, customerCancelled, customerEdited, enabled };

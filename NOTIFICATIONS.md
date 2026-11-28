# Booking e-mails

The server sends these e-mails (see `mailer.js`):

| When | To |
|---|---|
| New booking request | admin + customer ("received") |
| Admin approves, advance needed | customer (amount + 72 h deadline) |
| 24 h left to pay the advance | customer (reminder, sent once) |
| Confirmed (admin, or advance paid) | customer |
| Cancelled (admin, or advance not paid in 72 h) | customer |
| Customer cancels / edits a booking | admin |

Mail failures never break a booking; they are only logged.

## Recommended: Mailjet (links stay clickable)

Brevo rewrites every link through `sendibt2.com`, and that redirect is sometimes down ("This link is
temporarily unavailable"). Brevo cannot turn this off on the free plan. Mailjet can, per mail.

1. Create a free account at https://www.mailjet.com
2. **Account settings → Senders & domains → Add a sender address**: use your e-mail (Gmail works) and
   click the verification link they send you.
3. **Account settings → REST API → API Key Management (Master API Key)**: copy the **API Key** and **Secret Key**.
4. Render → **Environment**, add `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, and `MAIL_FROM` (the verified sender).
5. **Save, rebuild, and deploy**. Mailjet is used first when both Mailjet keys are set; you can leave the Brevo key in place.

## Alternative: Brevo (works, but links go through Brevo's redirect)

Render's free plan blocks SMTP, so mail goes through an HTTPS API.

1. Create a free account at https://www.brevo.com
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: use an e-mail you own
   (a Gmail works). Click the verification link they send you.
3. **SMTP & API → API Keys → Generate a new API key**. Copy it.
4. Render → your service → **Environment**, add:

| Key | Value |
|---|---|
| `BREVO_API_KEY` | the key from step 3 |
| `MAIL_FROM` | the sender e-mail you verified in step 2 |
| `MAIL_FROM_NAME` | `Sababa Tours` (optional) |
| `ADMIN_NOTIFY_EMAIL` | where new-request alerts go (optional; defaults to `ADMIN_EMAILS`) |
| `SITE_URL` | `https://sababa-tours.vercel.app` (optional; used in e-mail buttons) |

5. Save. Render redeploys. In **Logs** you will see `✉️ mail sent: ...` after a booking.
   With no key set you will see `✉️ (mail skipped: no provider configured)`; nothing breaks.

Tip: mails to a brand-new sender can land in Spam at first. Ask testers to mark "Not spam".

## WhatsApp
Automatic WhatsApp messages need the WhatsApp Business API (approval + cost), so the admin
alert e-mail contains a one-tap WhatsApp link to the customer's number instead.

## Other additions
- `GET /api/schedule/busy` (public): days that already have a confirmed / awaiting-payment trip. Dates only.
- Rate limit: 10 booking requests / hour / user, 30 edits+cancels / hour / user (in memory, no package needed).

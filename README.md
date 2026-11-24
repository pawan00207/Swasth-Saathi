# Swasth Saathi — Accessible Healthcare

Swasth Saathi helps patients and caregivers discover support schemes, manage Care Wallet treatment spending and verified bills, share single or bundled medical reports via revocable QR codes, find accessible routes, book teleconsultations, monitor hospital bed availability, and trigger multilingual SOS emergency alerts.

> **Safety:** Demo project, not a substitute for medical advice. Confirm scheme eligibility with the official scheme office and bed availability directly with the hospital. **For emergencies in India, call 108 or 112. SOS supplements, and does not replace, calling 108/112.**

## Project documentation

- [Project overview](./doc/PROJECT_OVERVIEW.md): architecture, modules, routes, data flows, configuration, and operating limits.
- [Product requirements (PRD)](./doc/PRD.md): users, product goals, functional and non-functional requirements, acceptance criteria, and roadmap.
- [Environment template](./.env.example): variable names only; supply real values in the ignored `.env.local`.

## Audit: What Existed vs. What Was Added / Upgraded

| Module | Previously Existing | Added / Upgraded |
|---|---|---|
| **Care Wallet (`/billing`, `/admin/invoices`, `/verify/[token]`)** | Basic invoice list, PDF/JSON download, optional SHA-256 fabric anchor, demo bills, basic Razorpay order/verify | Rebranded UI to **Care Wallet**; added `"Trust Seal"` / `"Trust Sealed"` badge keeping `"Anchor optional record hash"`; yearly spend/paid vs due/hospitals/scheme savings summary cards; monthly bar chart & hospital split; `service_catalog` Bill Clarity plain-English/Hindi explanations; GST % (`0/5/12/18`, default `0%`) in table & PDF; tamper-evident `bill_hash` & public `/verify/{token}` (`Authentic`/`Tampered`); `"Could a scheme help?"` `ESTIMATE` panel |
| **Razorpay Test Payment & Settlement** | Order creation + client verification only | Added `Due`/`Processing`/`Paid`/`Failed` + `"Retry payment"`; demo bill `"Test payment"` check; `POST /api/razorpay/webhook` (`X-Razorpay-Signature`, `payment.captured`/`payment.failed`/`order.paid`, idempotent settle + Realtime broadcast); additive `payments` & `audit_logs` tables; Official Receipt PDF (`"Download receipt"` with PAID stamp & QR); admin invoice history payment ID/receipt link |
| **Bed Availability & Staff Console (`/beds`, `/beds/admin`)** | Seed hospitals, basic bed count form, simple request modal, 1-field correction | Honest per-hospital badges (`"Live - updated X min ago"` <6h, amber `"Stale"` >6h, `"Demo"` only when no staff data); conditional removal of page-level `"Demo data only"` banner when staff data exists; Pediatric bed count & `staff_whatsapp` configuration; Request Bed modal with age, gender, validated WhatsApp phone, bed type, Critical/Urgent/Normal urgency, reason, attendant, optional My Reports attachment, consent, live Request ID tracker, 108/112 notice; multi-field Accessibility Correction form (yes/no/unknown + note + photo) with staff approval marking `"Staff-verified"`; ARIA focus-trapped modals (`Esc`, 44px touch targets) |
| **WhatsApp Chatbot (`/api/whatsapp/webhook`, `/api/whatsapp/test`)** | None | Swappable Twilio (`WHATSAPP_PROVIDER=twilio`) & Meta Cloud API (`WHATSAPP_PROVIDER=meta`) adapters; bed request alerts to patient + `hospitals.staff_whatsapp`; staff-only `ACCEPT <ID>`/`REJECT <ID>` updating bed requests & decrementing `bed_inventory`; patient `STATUS <ID>`, `HELP`, `STOP`, & Hindi commands (`स्थिति`, `मदद`, `रोको`); `YES`/`SEEN`/`OK` SOS opt-in & acknowledgement; masked phones & no medical details in `messages_log`; `"Send test WhatsApp"` on `/admin/setup-status` |
| **Multilingual UI & Multi-Script PDFs (`/locales/*`)** | Static English UI, Devanagari font only | `i18next` + 8 language packs (`en`, `hi`, `bn`, `mr`, `ta`, `te`, `gu`, `pa`); header language switcher persisting in `Profile.preferredLanguage`, cookie & `localStorage`; `Intl` currency/date/number formatting; bundled Noto Sans TTFs in `public/fonts/` for Devanagari, Bengali, Tamil, Telugu, Gujarati & Gurmukhi in `generatePdf`; optional Web Speech API voice input & read-aloud; `"Machine-assisted translation, please report errors"` + `"Suggest correction"` modal |
| **SOS Emergency (`/sos`, `/track/[token]`, `/e/[token]`)** | Static 108/112 link in footer/route | Global floating `"SOS"` button on every page; Call 108 / Call 112 first & largest; 5s countdown with Cancel + Drill mode (`TEST ALERT`); geolocation + manual fallback; live `/track/{token}` (2h expiry, revocable); nearest hospitals ranked by distance & bed availability + Ambulance Route + one-tap Request Bed + staff pre-alert; max 3 Emergency Contacts with WhatsApp `YES` opt-in & live `"Contact acknowledged"`; revocable `/e/{token}` Emergency QR Card & printable PDF; offline `sms:` fallback |
| **Multi-Report Bundle 1-QR (`/records`, `/r/bundle/[token]`)** | Single-report QR (`/r/{token}`) | Added multi-select checkbox flow to combine multiple uploaded reports into **1 combined revocable / PIN-protected QR** (`/r/bundle/{token}`) via `ReportBundleShareToken` & `/api/reports/bundle`, leaving single-report QR and Wallet Card PDF untouched |

## Local setup (npm)

Requirements: Node.js 20+ and `npm`.

1. Copy `.env.example` to `.env.local` and supply credentials locally (never commit `.env.local` or secrets).
2. Set `DATABASE_URL` (PostgreSQL / Prisma Postgres) and Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
3. Install, generate Prisma client, apply additive migrations, seed, and start:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000/admin/setup-status` to check provider connectivity (no secret values are exposed).

## Provider Configuration Guides

### 1. Supabase Email Authentication
1. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`), and the server-side `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) in `.env.local`.
2. Set `DATABASE_URL` for persistent patient profiles and cloud appointments.
3. In Supabase Authentication settings, enable the Email provider and configure the Site URL plus redirect allow-list for the app origin (for example, `http://localhost:3001/auth` during local development and your production `/auth` URL).
4. The `/auth` page supports sign-up, password sign-in, email confirmation, and password reset. Reset links return to `/auth`; users can then choose a new password.

### 2. Razorpay TEST Mode & Webhook
1. In the [Razorpay Dashboard](https://dashboard.razorpay.com/), toggle **Test Mode**.
2. Generate Test API Keys (`rzp_test_...`) and add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to `.env.local`.
3. Under **Account & Settings → Webhooks**, add webhook URL `https://<your-domain-or-ngrok>/api/razorpay/webhook`, set a secret (`RAZORPAY_WEBHOOK_SECRET`), and subscribe to `payment.captured`, `payment.failed`, and `order.paid`.
4. The Care Wallet and teleconsultation checkout both use the same test keys. Teleconsultation fees are determined from the selected doctor's server-side fee and verified into the patient's invoice.

### 3. Telegram Alerts
1. Create a Telegram bot with BotFather and add it to the group/chat that should receive alerts.
2. Obtain the destination chat ID from Telegram, then set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env.local`. Do not use a `NEXT_PUBLIC_` variable for either value. Set `TELEGRAM_SOS_CHAT_ID` or `TELEGRAM_EMERGENCY_CHAT_ID` to route SOS alerts and hospital pre-alerts to a separate chat; if neither is set, they use `TELEGRAM_CHAT_ID`.
3. Restart the app and use **Send test Telegram** on `/admin/setup-status`. Bed request alerts contain the request ID, hospital, bed type, status, and timestamp; SOS hospital pre-alerts include the SOS ID, hospital, bed type, and timestamp. These alerts exclude patient details.

### 4. WhatsApp Bot: Twilio Sandbox (Quick Start) & Meta Cloud API Swap
- **Twilio Sandbox (`WHATSAPP_PROVIDER=twilio`)**:
  1. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`, and `APP_BASE_URL=https://<your-ngrok-url>` in `.env.local`.
  2. Run `ngrok http 3000` locally, set Twilio Sandbox **When a message comes in** webhook to `https://<your-ngrok-url>/api/whatsapp/webhook` (`POST`).
  3. Join your sandbox number from WhatsApp, then test sending via `/admin/setup-status` (`Send test WhatsApp`).
- **Meta Cloud API (`WHATSAPP_PROVIDER=meta`)**:
  1. Switch `WHATSAPP_PROVIDER=meta` in `.env.local`.
  2. Set `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_VERIFY_TOKEN`, and `META_APP_SECRET`.
  3. Point Meta Webhook verification (`GET`) and callbacks (`POST`) to `https://<your-domain>/api/whatsapp/webhook`.

### 5. Adding a New Language
1. Create `/locales/<lang>.json` copying the key structure from `/locales/en.json`.
2. Add the language entry to `SUPPORTED_LANGUAGES` and `resources` in `/src/lib/i18n.js`.
3. Drop a corresponding Noto Sans TTF font file into `/public/fonts/` and map it in `/src/lib/generatePdf.js` if the language uses a new script.

## Manual test checklist

- **Care Wallet (`/billing`, `/verify/{token}`, `/admin/invoices`):** Check summary cards, monthly chart, hospital split, GST % column, Bill Clarity explanations, Trust Seal anchor, scheme `ESTIMATE` panel, Razorpay TEST checkout / webhook settlement, Receipt PDF (`Download receipt`), and tamper detection on `/verify/{token}`.
- **Teleconsult (`/consult`):** Book an appointment, pay the server-priced consultation fee through Razorpay TEST checkout, and verify that payment appears as an invoice in Care Wallet.
- **Beds & Accessibility (`/beds`, `/beds/admin`):** Verify per-hospital `Live`/`Stale`/`Demo` badges, staff bed update + `Pediatric` count + `staffWhatsapp`, Request Bed modal validation & live tracker, and Accessibility correction submission + staff approval (`Staff-verified`).
- **Bed request Telegram alerts:** With Telegram credentials configured, submit a bed request and verify the admin chat receives the request ID, hospital, bed type, status, and timestamp without patient details.
- **WhatsApp (`/admin/setup-status`):** Run `"Send test WhatsApp"`; test inbound `ACCEPT <ID>`, `REJECT <ID>`, `STATUS <ID>`, `HELP`, `STOP`, Hindi commands, `YES` opt-in, and `SEEN` SOS ack.
- **Multilingual:** Switch languages in header, verify persistence across reload, non-English machine-translation banner + `"Suggest correction"`, `Intl` currency/date formatting, and PDF download in Hindi/Bengali/Tamil/Telugu/Gujarati/Punjabi.
- **SOS Emergency (`/sos`, `/track/{token}`, `/e/{token}`):** Click floating SOS button, verify Call 108/112 prominence, test Drill (`TEST ALERT`) 5s countdown + Cancel + Trigger, test `"I'm safe"`, test `/track/{token}` expiry/revoke, and test Emergency QR Card `/e/{token}` + PDF.
- **Multi-Report Bundle QR (`/records`, `/r/bundle/{token}`):** Select multiple private reports, generate 1 combined QR, optionally PIN-protect it, open `/r/bundle/{token}`, and test revoke.
- **Existing features smoke:** Verify `/`, `/dashboard`, `/viewRecord`, `/schemes`, `/records/upload`, `/route`, `/consult`, `/consult/doctor`, `/appointments`, `/blockchain` work identically to before.

Run automated tests and build:

```bash
npm test
npm run build
```

## Live versus demo & Manual Configuration Required

- **LIVE when configured:** Prisma Postgres persistence, Supabase Auth & Storage, Supabase Realtime Broadcast (beds, requests, invoices, SOS), Razorpay TEST checkout + HMAC signature + webhook settlement, Twilio/Meta WhatsApp bot & masked message audit logs, multi-script Noto Sans PDFs, Care Wallet analytics, Emergency QR Card & Multi-report Bundle QR links.
- **DEMO fallback when unconfigured:** Bundled schemes, doctors, hospitals seed counts (`DEMO`), demo bills (`DEMO BILL`), local browser DWN/Fabric anchor log, and local Drill simulation for unauthenticated/DB-less previews.
- **Manual configuration required:** Supply `DATABASE_URL`, Supabase project keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), `RAZORPAY_KEY_ID` (`rzp_test_...`), `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and Twilio/Meta WhatsApp keys in `.env.local`; run `npm run db:migrate` & `npm run db:seed`; apply `supabase/storage.sql` and `supabase/realtime.sql`; assign `hospital_admin` / `doctor` roles via SQL; set `Hospital.staffWhatsapp` on hospital rows for live staff WhatsApp alerts.

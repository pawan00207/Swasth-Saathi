# Swasth Saathi — Accessible Healthcare

Swasth Saathi helps patients and caregivers discover support schemes, manage and share medical reports, find accessible care, book teleconsultations, and check hospital bed availability. It also provides tools for doctors and hospital staff to manage appointments, prescriptions, and invoices.

> **Safety:** Demo project, not a substitute for medical advice. Confirm scheme eligibility with the official portal and bed availability directly with the hospital.

## Project documentation

- [Project overview](./doc/PROJECT_OVERVIEW.md): architecture, modules, routes, data flows, configuration, and operating limits.
- [Product requirements (PRD)](./doc/PRD.md): users, product goals, functional and non-functional requirements, acceptance criteria, and roadmap.
- [Environment template](./.env.example): variable names only; supply real values in the ignored `.env.local`.

An accessibility-focused Next.js healthcare demo. Existing routes, Web5/DWN flows, and UI modules remain. Relational data now uses Prisma Postgres; Supabase is retained for Auth, private report-file Storage, and Realtime Broadcast notifications. Because Prisma uses a privileged database connection, every user-facing data API verifies the Supabase bearer token and enforces owner or hospital-role checks server-side. Bed, bed-request, and appointment updates use Realtime Broadcast with polling fallback whenever the required channel is disconnected.

## Audit and current state

| Module | Existing capability | Added/upgraded | Live-data limitations |
|---|---|---|---|
| Government schemes | Search, filters, eligibility explanation, saved schemes | data.gov.in adapter and per-user saved schemes in Prisma | Government catalogue requires a valid resource/key; bundled records are demo seed data |
| Medical reports + QR | Report UI and QR flow | Private Supabase Storage; Prisma metadata; random, hashed, expiring/revocable links; optional 4-6 digit PIN; five wrong attempts lock for 15 minutes; view log and signed downloads | Requires Supabase Auth/Storage and Prisma. No email/SMS OTP provider is configured; PIN is the supported second factor |
| Accessible routing | Leaflet map and route planning | ORS/Mapbox adapters, OSRM fallback, Overpass facilities, accessible attributes and correction reports, emergency call/Google Maps links | Mapbox/ORS keys are optional; accessibility and OSM/seed data must be confirmed with the hospital |
| Teleconsultation | Doctor directory, booking UI and room UI | Prisma doctor/appointment data, participant-checked JaaS token route, Realtime appointment status with polling fallback, prescription PDFs in private reports | Seed doctors are demos; real doctors need verified records and linked accounts. JaaS needs its private signing key |
| Bed availability | Seed hospitals and request UI | Prisma inventory and requests; staff role checks; audit log; 6-hour stale indicator; Realtime bed/request updates with 15-second admin, 15-second request and 30-second public polling fallbacks; accessibility verification | Seed counts are not hospital-confirmed. Staff must update inventory, or an official HMS feed must be integrated |
| Appointments and billing | Booking UI, PDF/JSON demo bills | Prisma booking/invoice workflow, hospital invoice creation/history/status, Razorpay TEST order verification, PDF/JSON invoices and verification QR | Payment requires valid TEST credentials; invoices and demo data are not official charges |
| Setup status | Not present | `/admin/setup-status` checks key presence and server-side provider connectivity without returning key values | A passing provider ping does not certify data quality or production readiness |

## Local setup

Requirements: Node.js 20.19+ and pnpm 8.15.9 (via Corepack).

1. Rotate the database password and Razorpay test secret previously pasted into chat. Do not copy those exposed values into this repository.
2. Create/use a Prisma Postgres database and set its newly rotated direct PostgreSQL connection string as `DATABASE_URL` in the ignored `.env.local`. Do not add a connection string to source control.
3. Configure Supabase Auth and Storage. Add the project URL, anon key, and service-role key to `.env.local`. Keep the service-role key server-only.
4. Configure any optional provider keys listed in [.env.example](./.env.example). Copy the file to `.env.local` and fill values locally.
5. From this app directory, run:

```powershell
corepack pnpm install
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev
```

Open `http://localhost:3000/admin/setup-status` to check configuration and provider connectivity. Never paste secrets into source files, screenshots, issue trackers, or chat.

### Prisma and Supabase setup details

- `prisma/schema.prisma` is the relational schema. The checked-in SQL migration under `prisma/migrations` creates tables and constraints. Run `db:migrate` only after setting `DATABASE_URL`.
- `prisma/seed.sql` inserts clearly marked demo hospitals, beds, doctors, and schemes. Seeded values are not live hospital or verified provider data.
- In the Supabase SQL editor run `supabase/storage.sql` to create the private `medical-reports` bucket and owner-scoped object policy, and `supabase/realtime.sql` to authorize private Broadcast subscriptions. In Supabase Realtime settings, disable **Allow public access** so all channels enforce their policies. The inventory topic is explicitly authorized for anonymous users because bed counts are public; bed-request and appointment topics require authentication. `supabase/schema.sql` is retained as a legacy Supabase relational schema; do not apply it to new Prisma installations.
- Supabase Auth remains the identity provider. Call `/api/profile` once after signing in to create a Prisma profile. Assign staff roles only from a trusted Prisma SQL session, never from the browser:

```sql
UPDATE "Profile" SET "role" = 'hospital_admin', "hospitalId" = '<hospital-id>'
WHERE "userId" = '<supabase-auth-user-uuid>';

UPDATE "Profile" SET "role" = 'doctor'
WHERE "userId" = '<supabase-auth-user-uuid>';

UPDATE "Doctor" SET "userId" = '<supabase-auth-user-uuid>'
WHERE "id" = '<doctor-id>';
```

For staff-verified accessibility, the assigned hospital admin must fill all four accessibility fields in `/beds/admin`; incomplete information remains unverified. Corrections submitted by users are pending review and do not silently change verified values.

## Environment variables

See [.env.example](./.env.example). Important values:

- `DATABASE_URL`: Prisma Postgres connection string (server-only).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: Supabase Auth and private Storage. Never expose the service-role key to the browser.
- `MAPBOX_ACCESS_TOKEN`, `OPENROUTESERVICE_API_KEY`, `OVERPASS_API_URL`: maps, traffic, accessible routing and nearby facilities.
- `DATA_GOV_IN_API_KEY`, `DATA_GOV_IN_RESOURCE_ID`: official scheme feed.
- `JAAS_APP_ID`, `JAAS_API_KEY_ID`, `JAAS_PRIVATE_KEY`: private JaaS rooms; API key ID alone is insufficient.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`: use TEST credentials only. The key ID must use the Razorpay test prefix.
- `HOSPITAL_BED_API_URL`, `HOSPITAL_BED_API_KEY`: optional verified hospital-system feed.
- `GOOGLE_GEMINI_API_KEY`, `DHRS_API_URL`, `DHRS_API_KEY`, `FABRIC_ANCHOR_ENABLED`: existing optional AI/DHRS/DWN adapters.

TomTom and Mappls variables are placeholders; they are not active routing adapters. Integration status is marked `DEMO DATA` only when required environment values are absent; configured-but-failing providers are shown as unavailable.

## Manual test checklist

- **Setup:** open `/admin/setup-status`; verify no secret values are shown; remove a key locally and confirm its integration changes to `DEMO DATA`; restore it and use Check again to test connectivity.
- **Schemes:** open `/schemes`; search/filter and test eligibility; save/remove while signed in; verify save persists after reload; test with data.gov.in configured and without it.
- **Reports:** sign in at `/auth`; upload a PDF/image at `/records/upload`; verify a private Storage object and Prisma metadata; create a 24h/7d/never link with a PIN; open `/r/{token}` without login; try four wrong PINs, confirm the fifth locks the link, then verify it unlocks after 15 minutes; confirm a correct PIN logs a view; revoke and confirm access stops; download the report and wallet-card/summary PDFs.
- **Routing/accessibility:** open `/route`; test ORS and Mapbox both configured and absent; use the fallback route; test nearby OSM facilities, accessible preferences, Google Maps link, and 108/112 buttons; on `/beds`, review accessibility source/date and submit a correction while signed in.
- **Teleconsultation:** book from `/consult` or `/appointments`; confirm appointment row in Prisma; verify status changes arrive through Realtime; assign a doctor role and doctor user ID using trusted SQL; confirm only the patient/assigned doctor can access the JaaS token route; complete as doctor and save a prescription PDF. Disconnect Realtime and verify the grey Live indicator and polling fallback.
- **Beds:** open `/beds`; update counts on `/beds/admin` and confirm availability changes arrive through Realtime; create a request while signed in and verify its status updates live; assign a hospital admin role; verify audit actor/time and stale amber state for data older than six hours; accept/reject a request and confirm the patient sees its new state. Disconnect Realtime and verify the grey Live indicator and polling fallback on public, staff, and request views.
- **Invoices:** assign a hospital admin role; open `/admin/invoices`; create an invoice for a valid signed-up patient UUID with multiple line items, GST, and discount; verify history/status and the patient’s `/billing` list; download PDF and JSON; use Razorpay TEST checkout; verify unpaid/paid state and QR verification route.
- **Existing routes/smoke:** visit `/`, `/dashboard`, `/viewRecord`, `/schemes`, `/records/upload`, `/records`, `/route`, `/consult`, `/consult/doctor`, `/appointments`, `/billing`, `/beds`, `/beds/admin`, `/admin/setup-status`, `/admin/invoices`, and `/blockchain`. Verify the original navigation and Web5/DWN fallback remain available.

Run automated checks from this directory:

```powershell
corepack pnpm test
corepack pnpm build
```

## Live versus demo

**Real when configured:** Prisma Postgres persistence, Supabase Auth, private report Storage, Realtime Broadcast for bed/bed-request/appointment changes, signed report links, provider connectivity checks, live calls to configured data.gov.in/Mapbox/ORS/Overpass/Razorpay/JaaS services, and staff-managed inventory. Polling remains active only while a relevant Realtime channel is disconnected.

**Still demo or externally dependent:** seeded schemes/doctors/hospitals/counts, unverified OSM accessibility data, DWN/Fabric demos, traffic/accessibility quality without paid/provider data, and any feature whose required provider is missing. A configured key is not proof that its source data is clinically or operationally authoritative.

**Manual configuration required:** rotate the exposed database/Razorpay secrets; set `DATABASE_URL`; create the Supabase project and configure Auth/Storage; run migrations and seed; add Mapbox/ORS/data.gov.in/JaaS/Razorpay TEST/HMS keys as desired; assign hospital and doctor roles from a trusted database session; onboard real facility/doctor data.

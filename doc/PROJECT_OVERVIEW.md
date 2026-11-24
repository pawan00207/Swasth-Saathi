# Swasth Saathi - Project Overview

Swasth Saathi is a mobile-responsive healthcare support application for India. It combines scheme discovery, medical record sharing, accessible routing, teleconsultation, bed availability, appointments, billing, and a general-purpose assistant.

The app is a demo/reference implementation. A configured API key is not proof that data is current, clinically appropriate, or verified by a hospital.

## Architecture

```text
Browser (Next.js / React)
  |-- Supabase Auth session (bearer token)
  |-- Next.js route handlers
       |-- verify identity and role/ownership
       |-- Prisma Client -> Prisma Postgres
       |-- Supabase service client -> private Storage / Realtime Broadcast
       |-- external APIs -> configured provider or documented fallback
```

### Main components

| Component | Responsibility |
|---|---|
| Next.js App Router | Feature pages, API route handlers, shared layout and metadata |
| React + Tailwind CSS | Responsive, accessible client interfaces |
| Supabase Auth | User identity and browser sessions |
| Supabase Storage | Private report files and signed downloads |
| Supabase Realtime | Private Broadcast channels for bed, bed-request, and appointment notifications |
| Prisma 7 + PostgreSQL | Relational application data, access profiles, audits, appointments, reports, and invoices |
| jsPDF + QR utilities | Shared PDF generation and verification/share codes |
| Leaflet | Route map display |

### Authorization and update flow

1. The browser obtains a Supabase Auth session and sends its bearer token to a protected API.
2. The API validates the token and checks the user's Prisma profile, ownership, or hospital/doctor role.
3. The API reads or writes Prisma Postgres. Prisma uses a privileged database connection; authorization is enforced in API code, not by Supabase RLS on those Prisma tables.
4. After a successful write, the API publishes minimal Broadcast metadata (record ID, status/count timestamp) to Supabase Realtime.
5. Relevant pages refresh their API data on a Broadcast event. If a required channel is not subscribed, polling remains active. A grey Live indicator means the view is using its polling fallback.

Never include patient names, phone numbers, report contents, or other PHI in Broadcast payloads. Apply `supabase/realtime.sql` and configure Supabase Realtime as instructed in the root README.

## Feature and route map

| Feature | Main routes | Data / behavior |
|---|---|---|
| Scheme catalogue and eligibility | `/schemes` | data.gov.in when configured; seeded fallback; authenticated saved schemes |
| Medical reports and secure sharing | `/records`, `/records/upload`, `/r/[token]`, `/records/view/[id]` | Private Storage, Prisma metadata, token expiry/revocation, optional PIN, PDFs |
| Accessible routing and nearby hospitals | `/route` | Mapbox/ORS where configured; OSRM/OSM and demo fallbacks; navigation and emergency call actions |
| Teleconsultation | `/consult`, `/consult/doctor` | Doctor directory, persisted appointments, participant-checked JaaS token, prescription PDF |
| Bed availability and staff tools | `/beds`, `/beds/admin` | Public inventory, authenticated requests, hospital-admin updates, audit log and Realtime |
| Appointments | `/appointments` | Prisma-backed booking and status changes; local demo behavior without Auth |
| Billing | `/admin/invoices`, `/billing`, `/billing/verify/[token]` | Hospital invoice workflow, patient history, Razorpay test flow, PDF/JSON and verification QR |
| Setup diagnostics | `/admin/setup-status` | Key presence and provider health without rendering key values |
| Saarthi AI | Shared shell assistant; `/api/saarthi` | General product/support guidance; not diagnosis or treatment |
| Existing DWN/blockchain flows | `/blockchain`, legacy record screens | Compatibility/demo paths; not a substitute for the private report workflow |

## Data ownership

- **Profile:** Supabase Auth user ID, display name, role, optional hospital assignment.
- **Schemes:** catalogue records and per-profile saved-scheme links.
- **Hospital operations:** hospital, bed inventory, bed requests, inventory audit entries, accessibility details/corrections.
- **Clinical coordination:** doctors and appointments; appointments connect patient and optional doctor/hospital.
- **Reports:** report metadata, private Storage path, share tokens, PIN state, view logs, and rate-limit records.
- **Billing:** invoices, line items, payment state, and verification tokens.

Use the Prisma schema and migrations as the source of truth for relational fields. Apply schema changes through migrations; do not point both Prisma and legacy Supabase schema setup at the same application data.

## External integrations and fallbacks

| Integration | Environment/configuration | Fallback or limitation |
|---|---|---|
| Prisma Postgres | `DATABASE_URL` | Persistence unavailable when missing/unreachable; demo/cached UI where implemented |
| Supabase Auth, Storage, Realtime | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Persistent account flows and private Storage need configuration; Realtime views fall back to polling |
| Government schemes | `DATA_GOV_IN_API_KEY`, `DATA_GOV_IN_RESOURCE_ID` | Seeded catalogue |
| Maps and accessible routes | `MAPBOX_ACCESS_TOKEN`, `OPENROUTESERVICE_API_KEY` | OSRM/seeded route behavior where available; provider quality is not guaranteed |
| Nearby hospitals | `OVERPASS_API_URL` | OSM results or local seed data; confirm by phone |
| Hospital bed feed | `HOSPITAL_BED_API_URL`, `HOSPITAL_BED_API_KEY` | Prisma staff inventory or clearly labelled demo seed data |
| JaaS video | `JAAS_APP_ID`, `JAAS_API_KEY_ID`, `JAAS_PRIVATE_KEY` | Demo-only behavior; do not discuss private health information in public rooms |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Test mode only; no production payment credentials in this project |
| AI and DHRS | `GOOGLE_GEMINI_API_KEY`, `DHRS_API_URL`, `DHRS_API_KEY` | General assistant and adapter fallbacks; do not use for diagnosis |
| Fabric/Web5 | `FABRIC_ANCHOR_ENABLED` and existing adapters | Demo/compatibility behavior; leave protocol identifiers unchanged without a migration |

The root [.env.example](../.env.example) lists variable names. Put actual credentials in the ignored `.env.local`; never commit them.

## Local development and validation

Follow the full [README setup](../README.md#local-setup) to configure Supabase, Prisma Postgres, migrations, seeds, and optional providers.

```powershell
corepack pnpm install
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev
```

Useful checks:

```powershell
corepack pnpm test
corepack pnpm build
```

Use the root README's manual test checklist for each module, including authorization checks, demo fallbacks, Realtime disconnect behavior, and document downloads.

## Demo/live interpretation

- **Live/persisted:** only when the corresponding database/provider is configured, reachable, and populated with valid operational data.
- **Seeded/demo:** bundled samples used for local evaluation; not confirmed scheme eligibility, doctor availability, or hospital capacity.
- **Unverified:** OSM, staff-unconfirmed, or user-reported accessibility and facility data.
- **Disconnected:** Realtime subscriptions are unavailable; affected views use the documented polling fallback.

## Branding and compatibility

The product name is **Swasth Saathi** and the package slug is `swasth-saathi`. Existing browser storage keys, Web5 protocol URLs, and older stored room identifiers retain their `healthx` naming where applicable so existing demo data and external identifiers are not silently orphaned. Migrate those identifiers only as a separate compatibility change.

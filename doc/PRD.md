# Swasth Saathi - Product Requirements Document

**Version:** 1.0

**Status:** Implementation-aligned baseline; external integrations remain configuration-dependent

**Last updated:** 2026-11-24

## 1. Product summary

Swasth Saathi is an accessibility-focused healthcare companion for people in India. It brings together government-support discovery, private medical-report sharing, accessible care navigation, teleconsultation, bed availability, appointments, and billing in one responsive web application.

The product is designed to make healthcare information and care coordination easier to find and use. It is not a clinical system, emergency dispatch service, government eligibility decision, or source of authoritative hospital capacity unless connected to a verified provider.

## 2. Problem and product vision

Patients and caregivers often need to move between separate services to find financial support, share records, locate accessible hospitals, book care, and understand availability or charges. The experience is especially difficult when a user has a disability, limited mobility, or limited access to reliable digital tools.

**Vision:** provide one accessible starting point for healthcare support and care coordination, while clearly distinguishing verified live integrations from demo and fallback data.

## 3. Goals

- Make schemes and care options searchable and understandable.
- Help users securely share reports without exposing medical data in QR codes.
- Support accessible and emergency-oriented route planning.
- Give patients, doctors, and hospital staff role-appropriate appointment and bed workflows.
- Make invoices and healthcare documents downloadable and verifiable.
- Keep core screens usable when optional providers are unavailable.
- Make the data source and current connection state visible.

## 4. Users and permissions

| User | Primary needs | Access model |
|---|---|---|
| Visitor or caregiver | Browse schemes, route options, and public bed counts | Public screens and explicitly public data |
| Patient | Save schemes, upload/share reports, request beds, book appointments, view bills | Supabase Auth identity; owner checks in server APIs |
| Doctor | View assigned appointments, update status, join consultation, save prescriptions | Authenticated account linked to a doctor profile |
| Hospital administrator | Update one hospital's inventory and review bed requests/inventory audit | Authenticated account with `hospital_admin` role and assigned hospital |
| Operator | Configure providers, database, seed data, and staff assignments | Trusted deployment and database access; no user-facing privilege escalation |

Roles and hospital assignments are stored in Prisma Postgres. Do not assign staff roles from the browser.

## 5. Scope

### In scope

- Scheme catalogue search, eligibility guidance, and saved schemes.
- Medical report upload, secure share links, QR access, optional PIN protection, revocation, and PDF downloads.
- Accessible and ambulance-oriented routing, nearby facility discovery, and emergency call/navigation actions.
- Doctor discovery, appointment booking, teleconsultation room access, and prescription PDFs.
- Public bed availability, staff inventory editing, bed requests, audit history, and update notifications.
- Hospital invoice administration, patient invoice history, PDF/JSON downloads, verification QR, and Razorpay test checkout.
- Setup-status diagnostics, accessible UI patterns, and clear demo/live status labels.

### Out of scope

- Diagnosing, prescribing, or replacing a clinician.
- Guaranteeing government scheme eligibility or hospital bed availability.
- Emergency dispatch or guaranteed ambulance routing.
- Production-mode payment processing in the demo.
- SMS/email OTP delivery until an OTP provider and delivery workflow are configured.
- Full replacement of a hospital management system or claims/billing system.
- Treating seeded, cached, or unverified OSM data as authoritative.

## 6. Main user journeys

1. **Find support:** search and filter schemes, enter profile criteria, review a match explanation, and save schemes to an account.
2. **Share a report:** upload a report, generate an expiring or revocable link, optionally protect it with a PIN, and share a QR containing only the secure URL.
3. **Reach care:** enter or share a location, choose ambulance/accessibility preferences, review route alternatives and nearby facilities, and open navigation or call emergency services.
4. **Book and consult:** select a doctor and slot, create an appointment, join the authorized consultation room, and retrieve the prescription PDF.
5. **Find/request a bed:** search public inventory, submit a request as a patient, and receive request status changes; authorized staff update inventory and process requests.
6. **Create and pay an invoice:** hospital staff create an itemized invoice; the patient views it, downloads PDF/JSON, and optionally checks out using Razorpay test credentials.

## 7. Functional requirements

### 7.1 Government schemes

- Provide search, filters, eligibility guidance, and save/unsave behavior.
- Accept age, income, state, disability, gender, occupation, and land-ownership inputs where the scheme data supports them.
- Show an explanation and a clear instruction to verify requirements with the official scheme portal.
- Prefer data.gov.in when configured; clearly identify bundled/cached demo data otherwise.
- Persist saved schemes per authenticated user in Prisma; any local demo fallback must remain visibly non-persistent.

**Acceptance:** a user can filter/search, inspect why a scheme is likely eligible or needs review, save/unsave it, and see an accurate source label after reload.

### 7.2 Medical reports and QR sharing

- Store private report files in Supabase Storage and metadata in Prisma.
- A QR code must contain only a random secure share URL, never report contents or patient details.
- Support expiry, revocation, view logging, and optional 4-6 digit PIN protection.
- Lock a PIN-protected link after five incorrect attempts for 15 minutes.
- Allow the owner to list reports and download, regenerate, protect, or revoke links.
- Generate report-related PDFs through the shared PDF utility; provide an accessible download path.

**Acceptance:** an unauthorized user cannot retrieve private files by guessing an object path; revoked/expired links stop working; correct PIN access is logged; QR contents contain no medical data.

### 7.3 Accessible and ambulance routing

- Provide route planning with accessible preferences and an ambulance-oriented mode.
- Use configured Mapbox/OpenRouteService integrations where supported and retain OSRM or cached/demo fallback behavior.
- Discover nearby hospitals through configured OpenStreetMap/Overpass data and expose source/verification caveats.
- Include a navigation handoff and visible 108/112 emergency call actions.
- Do not imply that map data confirms a hospital's current clinical capability or bed count.

**Acceptance:** provider failures are visible and do not silently present an invalid route as verified; fallback route and facility sources are identified.

### 7.4 Teleconsultation and appointments

- List doctors with available directory details and distinguish seeded/demo profiles.
- Require authenticated booking for persisted appointments.
- Enforce patient/assigned-doctor authorization for room-token access.
- Support booked, confirmed, completed, and cancelled appointment states with Realtime updates and polling fallback.
- Allow authorized doctors to save prescriptions as private PDF reports.

**Acceptance:** unrelated users cannot obtain a room token or mutate an appointment; disconnecting Realtime activates polling and changes the Live indicator to grey.

### 7.5 Bed availability and hospital staff

- Display ICU, Oxygen, General, and Ventilator availability with last-updated information.
- Allow only the assigned hospital administrator to change inventory for that hospital.
- Record who changed inventory, what changed, and when; mark inventory older than six hours as stale.
- Allow authenticated patients to submit bed requests and staff to accept/reject pending requests.
- Publish minimal Realtime Broadcast metadata after successful database mutations; never broadcast patient name, phone, urgency, or report content.
- Retain 30-second public and 15-second staff/request polling fallback while a relevant channel is disconnected.

**Acceptance:** staff role checks and audit data are enforced server-side; inventory and request changes reach connected users without a refresh; fallback refreshes data when disconnected.

### 7.6 Invoices and billing

- Allow hospital administrators to create itemized invoices with tax, discount, total, and payment status.
- Show invoice history to the relevant patient and hospital.
- Generate PDF invoices with a verification QR and provide JSON download.
- Use Razorpay test mode only unless a separate production readiness review authorizes otherwise.

**Acceptance:** a patient can only access their own invoices; the PDF and JSON totals match the stored invoice; payment status is updated only after server-side payment verification.

### 7.7 Assistant and setup diagnostics

- Saarthi AI may provide general navigation/support information, but must not diagnose or prescribe.
- `/admin/setup-status` reports configuration and provider health without disclosing secret values.
- A missing key is labelled as demo/unconfigured; a configured but failing provider is labelled unavailable rather than live.

## 8. Non-functional requirements

- **Privacy:** keep medical files private; require ownership/role checks on server APIs; do not put PHI in QR codes or Realtime payloads.
- **Authentication:** validate Supabase bearer tokens server-side. Prisma access is privileged, so authorization must be enforced by the application API.
- **Resilience:** external integrations need loading/error states, bounded retries where appropriate, and a clearly labelled fallback.
- **Accessibility:** responsive layouts, semantic controls, keyboard access, visible focus, screen-reader status, and high-contrast status colors.
- **Documents:** generated PDFs use the shared header/footer and Devanagari-capable font where supported.
- **Transparency:** distinguish live, cached, seeded, and unverified data; show timestamps for changing availability.
- **Safety:** display the medical disclaimer; provide emergency contact actions without claiming dispatch capability.

## 9. Data and integrations

Prisma Postgres stores profiles, schemes and saved schemes, hospitals, bed inventory/requests/audits, doctors, appointments, reports/share tokens/view logs, invoices, and accessibility corrections.

Supabase provides Auth, private report-file Storage, and Realtime Broadcast. Realtime notifications are sent after Prisma writes; the database tables themselves are not Supabase Postgres changefeeds. `supabase/realtime.sql` must be applied and the project's Realtime access setting configured as described in the README.

External integrations include data.gov.in, Mapbox, OpenRouteService, Overpass/OSM, JaaS, Razorpay test mode, and optional hospital-system, AI, and DHRS providers. Provider configuration does not prove that the returned data is authoritative.

## 10. Success measures

These are product targets, not claims about current production performance:

- Every module identifies demo/unverified data and has a documented fallback path.
- No report body, patient name, or phone number appears in a QR payload or Realtime notification.
- All patient-owned and role-protected API operations reject unauthorized access.
- Connected users receive persisted bed and appointment changes without manually refreshing.
- Disconnected users receive updates through the documented polling fallback.
- Users can complete the key flows with keyboard navigation and a screen reader.
- Automated tests and production build pass before release; manual module checklist is completed for each deployment.

## 11. Known constraints and launch dependencies

- Real provider behavior requires valid environment variables and provider-side setup.
- Real doctor and hospital records require trusted onboarding; seed data is not operationally verified.
- The project does not configure SMS/email OTP delivery; PIN is the supported second factor.
- JaaS requires its private signing key; public Jitsi rooms must not be used for PHI.
- Razorpay credentials must remain in test mode for this demo.
- Apply Prisma migrations/seed and Supabase Storage/Realtime SQL before testing persisted or live flows.
- Legacy localStorage keys and Web5 protocol identifiers are retained for compatibility; do not rename them without a data migration plan.

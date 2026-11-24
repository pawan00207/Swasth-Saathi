# ABDM Integration Plan

Date: 2026-11-25

## Scope

- **Goal:** Set up and validate ABDM integration for the existing Swasth Saathi healthcare application.
- **Role:** Both patient-facing PHR/HIU and healthcare provider HIP workflows, confirmed by user on 2026-11-25.
- **Modules:** `abdm-gateway`, `abdm-m1`, `abdm-m2`, `abdm-m3`, `abdm-m4`, `abdm-p1`, `abdm-p2`, `abdm-p3`, `abdm-p4`, `abdm-scan-and-register`, `abdm-scan-and-pay`, `abdm-record-share`, and `abdm-fhir`.
- **Skills:** The selected module's corresponding ABDM skill; `abdm-fhir` for FHIR generation and audit.
- **Existing routes to assess:** `/abdm`, `/api/abdm/aadhaar`, `/api/abdm/abha`, `/api/abdm/consent`, `/api/abdm/face-verify`, and `/api/abdm/status`. Additional routes are determined during each module's integration step.
- **Out of scope:** Unselected ABDM modules, production credentials or patient data in repository files, and unrelated application changes.

## Current assessment

Assessed on 2026-11-25:

- `/api/abdm/aadhaar` supports OTP requests and verification. Without a live gateway token, it falls back to a locally generated OTP challenge; this is not live UIDAI/ABDM verification.
- `/api/abdm/abha` looks up profiles but can return a cached/sample profile and historical care contexts when live lookup is unavailable.
- `/api/abdm/consent` can initiate a consent request, but falls back to a locally marked granted consent and sample record summaries.
- `/api/abdm/face-verify` uses optional Gemini image analysis and a local image heuristic; it is not an ABDM M1 operation.
- `/api/abdm/status` checks gateway configuration/connectivity and reports M1-M3 milestones.
- No dedicated route handlers were found for M2 record linking, M3 consent callbacks/data pulls, M4, P1/P3/P4, scan-and-register, scan-and-pay, patient record-share, or FHIR generation/audit.
- No ABDM variables are present in this workspace process environment, and `.env.local` is absent. Live gateway work requires `ABDM_CLIENT_ID` and `ABDM_CLIENT_SECRET`; both-role setup also needs valid sandbox `ABDM_CM_ID`, `ABDM_HIP_ID`, and `ABDM_HIU_ID` values. Keep them in local/hosting secrets, never this plan or `.env.example`.

## Steps

| Step | Status | Exit condition |
|---|---|---|
| Confirm scope and approve this plan | done | User selected all 13 modules and approved this plan on 2026-11-25. |
| Install selected ABDM skills and identify current documentation sources | done | 13 selected `SKILL.md` files and indexed references are installed under `.github/skills/`; `.vscode/mcp.json` registers `https://docs.abdm.gov.in/mcp`; `.env.example` has blank values only. Verified on 2026-11-25. |
| Assess current ABDM implementation and map module routes | done | Existing route behavior and missing module routes are documented in Current assessment above; checked on 2026-11-25. |
| Configure ABDM gateway | blocked | Waiting for ABDM sandbox credentials and role IDs to be available in the app's local or hosting environment. |
| Integrate M1 — ABHA | pending | ABHA create/verify flow is implemented or verified; focused tests pass. |
| Integrate M2 — records | pending | Record create/link flow is implemented or verified; focused tests pass. |
| Integrate M3 — consent-based data fetch | pending | Consent-authorized fetch flow is implemented or verified; focused tests pass. |
| Integrate M4 — facilities and professionals | pending | Registration flow is implemented or verified; focused tests pass. |
| Integrate P1 — PHR registration and login | pending | PHR registration/login flow is implemented or verified; focused tests pass. |
| Integrate P2 — consent management | pending | Consent management flow is implemented or verified; focused tests pass. |
| Integrate P3 — PHR subscriptions | pending | Subscription flow is implemented or verified; focused tests pass. |
| Integrate P4 — health lockers | pending | Health locker flow is implemented or verified; focused tests pass. |
| Integrate scan-and-register | pending | Scan-and-register flow is implemented or verified; focused tests pass. |
| Integrate scan-and-pay | pending | Scan-and-pay flow is implemented or verified; focused tests pass. |
| Integrate patient record share | pending | Patient record-share flow is implemented or verified; focused tests pass. |
| Generate and audit FHIR bundles | pending | FHIR generation and audit requirements are implemented or verified; focused tests pass. |
| Run functional tests and record results | pending | Selected module test cases pass or are explicitly blocked; run log is linked here. |

Progress: 3/17 steps done (18%).

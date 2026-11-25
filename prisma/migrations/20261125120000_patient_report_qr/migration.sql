ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "patientReference" TEXT;
CREATE INDEX IF NOT EXISTS "Report_ownerId_patientReference_idx" ON "Report" ("ownerId", "patientReference");

ALTER TABLE "report_bundle_share_tokens" ADD COLUMN IF NOT EXISTS "patient_reference" TEXT;
CREATE INDEX IF NOT EXISTS "report_bundle_share_tokens_owner_id_patient_reference_idx" ON "report_bundle_share_tokens" ("owner_id", "patient_reference");

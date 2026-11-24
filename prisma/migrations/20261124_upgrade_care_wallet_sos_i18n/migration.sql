-- Additive migration for Care Wallet, Razorpay Payments, AuditLog, WhatsApp MessageLog,
-- Bed Request enhancements, Accessibility Corrections, Emergency SOS, and Report Bundle QR.

ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "Hospital"
  ADD COLUMN IF NOT EXISTS "staffWhatsapp" TEXT,
  ADD COLUMN IF NOT EXISTS "staffUpdatedAt" TIMESTAMP(3);

ALTER TABLE "BedRequest"
  ADD COLUMN IF NOT EXISTS "patientAge" INTEGER,
  ADD COLUMN IF NOT EXISTS "patientGender" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "attendantName" TEXT,
  ADD COLUMN IF NOT EXISTS "attendantPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "attachedReportId" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappConsent" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "billHash" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappConsent" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AccessibilityCorrection"
  ADD COLUMN IF NOT EXISTS "ramp" TEXT,
  ADD COLUMN IF NOT EXISTS "elevator" TEXT,
  ADD COLUMN IF NOT EXISTS "wheelchairEntrance" TEXT,
  ADD COLUMN IF NOT EXISTS "accessibleParking" TEXT,
  ADD COLUMN IF NOT EXISTS "photoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "service_catalog" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description_en" TEXT NOT NULL,
  "description_hi" TEXT NOT NULL,
  "gst_rate" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "category" TEXT NOT NULL DEFAULT 'clinical',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "service_catalog_name_key" ON "service_catalog"("name");

CREATE TABLE IF NOT EXISTS "payments" (
  "id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "razorpay_order_id" TEXT,
  "razorpay_payment_id" TEXT,
  "status" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "method" TEXT,
  "raw_event" TEXT,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "payments_razorpay_payment_id_key" ON "payments"("razorpay_payment_id");
CREATE INDEX IF NOT EXISTS "payments_invoice_id_created_at_idx" ON "payments"("invoice_id", "created_at");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "action" TEXT NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

CREATE TABLE IF NOT EXISTS "messages_log" (
  "id" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "recipient_mask" TEXT NOT NULL,
  "message_type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "external_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "messages_log_created_at_idx" ON "messages_log"("created_at");

CREATE TABLE IF NOT EXISTS "emergency_profiles" (
  "user_id" TEXT NOT NULL,
  "full_name" TEXT NOT NULL DEFAULT '',
  "blood_group" TEXT NOT NULL DEFAULT '',
  "allergies" TEXT NOT NULL DEFAULT '',
  "conditions" TEXT NOT NULL DEFAULT '',
  "medicines" TEXT NOT NULL DEFAULT '',
  "preferred_language" TEXT NOT NULL DEFAULT 'en',
  "card_enabled" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "emergency_profiles_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "emergency_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "emergency_contacts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "whatsapp_phone" TEXT NOT NULL,
  "relation" TEXT NOT NULL DEFAULT 'Family',
  "opt_in_status" TEXT NOT NULL DEFAULT 'pending',
  "opt_in_sent_at" TIMESTAMP(3),
  "opted_in_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "emergency_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "emergency_contacts_user_id_idx" ON "emergency_contacts"("user_id");
CREATE INDEX IF NOT EXISTS "emergency_contacts_whatsapp_phone_idx" ON "emergency_contacts"("whatsapp_phone");

CREATE TABLE IF NOT EXISTS "sos_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "is_drill" BOOLEAN NOT NULL DEFAULT false,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "address_text" TEXT,
  "needed_bed_type" TEXT NOT NULL DEFAULT 'ICU',
  "hospital_id" TEXT,
  "tracking_token_hash" TEXT,
  "tracking_expires_at" TIMESTAMP(3),
  "tracking_revoked_at" TIMESTAMP(3),
  "acknowledged_by" TEXT,
  "acknowledged_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sos_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sos_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sos_events_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "sos_events_tracking_token_hash_key" ON "sos_events"("tracking_token_hash");
CREATE INDEX IF NOT EXISTS "sos_events_user_id_created_at_idx" ON "sos_events"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "emergency_card_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "emergency_card_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "emergency_card_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "emergency_card_tokens_token_hash_key" ON "emergency_card_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "emergency_card_tokens_user_id_idx" ON "emergency_card_tokens"("user_id");

CREATE TABLE IF NOT EXISTS "report_bundle_share_tokens" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "report_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "token_hash" TEXT NOT NULL,
  "pin_salt" TEXT,
  "pin_hash" TEXT,
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "wrong_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_bundle_share_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "report_bundle_share_tokens_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "report_bundle_share_tokens_token_hash_key" ON "report_bundle_share_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "report_bundle_share_tokens_owner_id_created_at_idx" ON "report_bundle_share_tokens"("owner_id", "created_at");

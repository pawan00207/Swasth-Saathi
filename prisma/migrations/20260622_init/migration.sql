-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'patient',
    "hospitalId" TEXT,
    "emergencyContact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'health',
    "state" TEXT NOT NULL DEFAULT 'All India',
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "incomeLimit" DECIMAL(65,30),
    "disabilityRequired" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "benefits" TEXT NOT NULL DEFAULT '',
    "documents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applyUrl" TEXT,
    "sourceUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedScheme" (
    "userId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedScheme_pkey" PRIMARY KEY ("userId","schemeId")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "speciality" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emergency" BOOLEAN NOT NULL DEFAULT false,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "ramp" BOOLEAN,
    "elevator" BOOLEAN,
    "wheelchairEntrance" BOOLEAN,
    "accessibleParking" BOOLEAN,
    "accessibilitySource" TEXT NOT NULL DEFAULT 'osm',
    "accessibilityLastVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedInventory" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "bedType" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BedInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedInventoryAudit" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BedInventoryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "bedType" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'routine',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BedRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "speciality" TEXT NOT NULL,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "registrationNumber" TEXT,
    "availabilitySlots" JSONB NOT NULL DEFAULT '[]',
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL DEFAULT '',
    "doctorId" TEXT,
    "hospitalId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'video',
    "status" TEXT NOT NULL DEFAULT 'booked',
    "roomName" TEXT,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "hospitalId" TEXT,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillVerificationToken" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "BillVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doctorName" TEXT,
    "notes" TEXT,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "shareProtectionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sharePinSalt" TEXT,
    "sharePinHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportShareToken" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "pinSalt" TEXT,
    "pinHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "wrongAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportShareToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportShareRateLimit" (
    "shareTokenId" TEXT NOT NULL,
    "minuteBucket" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReportShareRateLimit_pkey" PRIMARY KEY ("shareTokenId","minuteBucket")
);

-- CreateTable
CREATE TABLE "ReportView" (
    "id" TEXT NOT NULL,
    "shareTokenId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewerFingerprint" TEXT,

    CONSTRAINT "ReportView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessibilityCorrection" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "userId" TEXT,
    "field" TEXT NOT NULL,
    "reportedValue" BOOLEAN NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessibilityCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_name_city_key" ON "Hospital"("name", "city");

-- CreateIndex
CREATE UNIQUE INDEX "BedInventory_hospitalId_bedType_key" ON "BedInventory"("hospitalId", "bedType");

-- CreateIndex
CREATE INDEX "BedInventoryAudit_hospitalId_createdAt_idx" ON "BedInventoryAudit"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "BedRequest_hospitalId_createdAt_idx" ON "BedRequest"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "BedRequest_userId_createdAt_idx" ON "BedRequest"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_name_speciality_key" ON "Doctor"("name", "speciality");

-- CreateIndex
CREATE INDEX "Appointment_patientId_startsAt_idx" ON "Appointment"("patientId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_startsAt_idx" ON "Appointment"("doctorId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_billNumber_key" ON "Invoice"("billNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_razorpayOrderId_key" ON "Invoice"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "Invoice_patientId_createdAt_idx" ON "Invoice"("patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillVerificationToken_tokenHash_key" ON "BillVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "BillVerificationToken_ownerId_idx" ON "BillVerificationToken"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportShareToken_tokenHash_key" ON "ReportShareToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ReportShareToken_ownerId_createdAt_idx" ON "ReportShareToken"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportView_shareTokenId_viewedAt_idx" ON "ReportView"("shareTokenId", "viewedAt");

-- CreateIndex
CREATE INDEX "AccessibilityCorrection_hospitalId_status_createdAt_idx" ON "AccessibilityCorrection"("hospitalId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedScheme" ADD CONSTRAINT "SavedScheme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedScheme" ADD CONSTRAINT "SavedScheme_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedInventory" ADD CONSTRAINT "BedInventory_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedInventoryAudit" ADD CONSTRAINT "BedInventoryAudit_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedInventoryAudit" ADD CONSTRAINT "BedInventoryAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Profile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedRequest" ADD CONSTRAINT "BedRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedRequest" ADD CONSTRAINT "BedRequest_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillVerificationToken" ADD CONSTRAINT "BillVerificationToken_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportShareToken" ADD CONSTRAINT "ReportShareToken_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportShareToken" ADD CONSTRAINT "ReportShareToken_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportShareRateLimit" ADD CONSTRAINT "ReportShareRateLimit_shareTokenId_fkey" FOREIGN KEY ("shareTokenId") REFERENCES "ReportShareToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportView" ADD CONSTRAINT "ReportView_shareTokenId_fkey" FOREIGN KEY ("shareTokenId") REFERENCES "ReportShareToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessibilityCorrection" ADD CONSTRAINT "AccessibilityCorrection_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

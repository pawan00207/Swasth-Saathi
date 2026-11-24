import { createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { requireUser } from "../../../../../lib/api-auth";
import { getPrisma } from "../../../../../lib/prisma";
import { getSupabaseAdmin } from "../../../../../lib/supabase/server";

function pinMatches(pin, salt, hash) {
  const candidate = scryptSync(pin, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function GET(request, { params }) {
  const prisma = getPrisma();
  if (!prisma) return Response.json({ error: "Prisma Postgres is not configured." }, { status: 503 });
  const tokenHash = createHash("sha256").update(params.token).digest("hex");
  const now = new Date();
  const minuteBucket = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const suppliedPin = request.headers.get("x-report-pin") || "";

  const result = await prisma.$transaction(async (transaction) => {
    const share = await transaction.reportShareToken.findUnique({
      where: { tokenHash },
      include: { report: true },
    });
    if (!share || share.revokedAt || (share.expiresAt && share.expiresAt <= now)) return { state: "invalid" };
    const rate = await transaction.reportShareRateLimit.upsert({
      where: { shareTokenId_minuteBucket: { shareTokenId: share.id, minuteBucket } },
      create: { shareTokenId: share.id, minuteBucket, requestCount: 1 },
      update: { requestCount: { increment: 1 } },
    });
    if (rate.requestCount > 30) return { state: "rate-limited" };
    if (share.lockedUntil && share.lockedUntil > now) return { state: "locked", lockedUntil: share.lockedUntil };
    if (share.pinHash && !suppliedPin) return { state: "pin-required" };
    if (share.pinHash && !pinMatches(suppliedPin, share.pinSalt, share.pinHash)) {
      const attempts = share.lockedUntil && share.lockedUntil <= now ? 1 : share.wrongAttempts + 1;
      const locksUntil = attempts >= 5 ? new Date(now.getTime() + 15 * 60_000) : null;
      const updated = await transaction.reportShareToken.updateMany({
        where: { id: share.id, wrongAttempts: share.wrongAttempts, lockedUntil: share.lockedUntil },
        data: { wrongAttempts: locksUntil ? 0 : attempts, lockedUntil: locksUntil },
      });
      if (!updated.count) return { state: "concurrent-attempt" };
      return locksUntil
        ? { state: "locked", lockedUntil: locksUntil }
        : { state: "wrong-pin", remainingAttempts: 5 - attempts };
    }

    await transaction.reportShareToken.update({
      where: { id: share.id },
      data: { viewCount: { increment: 1 }, wrongAttempts: 0, lockedUntil: null },
    });
    const fingerprint = createHash("sha256")
      .update(`${request.headers.get("x-forwarded-for") || "unknown"}:${request.headers.get("user-agent") || "unknown"}`)
      .digest("hex");
    await transaction.reportView.create({ data: { shareTokenId: share.id, viewerFingerprint: fingerprint } });
    return { state: "ok", report: share.report };
  });

  if (result.state === "invalid") return Response.json({ error: "This report share link is invalid, expired, or revoked." }, { status: 404 });
  if (result.state === "rate-limited") return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  if (result.state === "locked") return Response.json({
    error: "This report link is locked after five incorrect PIN attempts. Try again in 15 minutes.",
    lockedUntil: result.lockedUntil,
  }, { status: 423 });
  if (result.state === "pin-required") return Response.json({ error: "Enter the 4-6 digit PIN shared by the report owner.", pinRequired: true }, { status: 401 });
  if (result.state === "wrong-pin") return Response.json({
    error: "Incorrect PIN.",
    pinRequired: true,
    remainingAttempts: result.remainingAttempts,
  }, { status: 403 });
  if (result.state === "concurrent-attempt") return Response.json({ error: "Another PIN attempt was processed. Try again." }, { status: 429 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "Private report storage is not configured." }, { status: 503 });
  const { data: signed, error: signedError } = await supabase.storage
    .from("medical-reports")
    .createSignedUrl(result.report.storagePath, 60);
  if (signedError) {
    console.error("Could not serve report share", signedError.message);
    return Response.json({ error: "Unable to load the shared report." }, { status: 500 });
  }
  return Response.json({
    report: {
      id: result.report.id,
      patientName: result.report.patientName,
      reportType: result.report.reportType,
      reportDate: result.report.reportDate.toISOString().slice(0, 10),
      doctorName: result.report.doctorName,
      notes: result.report.notes,
      mimeType: result.report.mimeType,
      downloadUrl: signed.signedUrl,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request, { params }) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const revoked = await context.prisma.reportShareToken.updateMany({
    where: { id: params.token, ownerId: context.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!revoked.count) return Response.json({ error: "Share link not found." }, { status: 404 });
  return Response.json({ revoked: true });
}

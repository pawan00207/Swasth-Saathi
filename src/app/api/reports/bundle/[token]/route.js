import { createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { requireUser } from "../../../../../lib/api-auth";
import { getPrisma } from "../../../../../lib/prisma";
import { getSupabaseAdmin } from "../../../../../lib/supabase/server";

const bundleRateLimits = new Map();

function pinMatches(pin, salt, hash) {
  const candidate = scryptSync(pin, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function GET(request, { params }) {
  const prisma = getPrisma();
  if (!prisma) return Response.json({ error: "Prisma Postgres is not configured." }, { status: 503 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const nowMs = Date.now();
  for (const [key, entry] of bundleRateLimits) {
    if (entry.resetAt <= nowMs) bundleRateLimits.delete(key);
  }
  const bucket = bundleRateLimits.get(ip);
  if (bucket && bucket.resetAt > nowMs && bucket.count >= 30) {
    return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }
  bundleRateLimits.set(
    ip,
    bucket && bucket.resetAt > nowMs ? { count: bucket.count + 1, resetAt: bucket.resetAt } : { count: 1, resetAt: nowMs + 60_000 },
  );

  const tokenHash = createHash("sha256").update(params.token).digest("hex");
  const now = new Date();
  const suppliedPin = request.headers.get("x-report-pin") || "";

  const result = await prisma.$transaction(async (transaction) => {
    const share = await transaction.reportBundleShareToken.findUnique({ where: { tokenHash } });
    if (!share || share.revokedAt || (share.expiresAt && share.expiresAt <= now)) return { state: "invalid" };
    if (share.lockedUntil && share.lockedUntil > now) return { state: "locked", lockedUntil: share.lockedUntil };
    if (share.pinHash && !suppliedPin) return { state: "pin-required" };
    if (share.pinHash && !pinMatches(suppliedPin, share.pinSalt, share.pinHash)) {
      const attempts = share.lockedUntil && share.lockedUntil <= now ? 1 : share.wrongAttempts + 1;
      const locksUntil = attempts >= 5 ? new Date(now.getTime() + 15 * 60_000) : null;
      await transaction.reportBundleShareToken.update({
        where: { id: share.id },
        data: { wrongAttempts: locksUntil ? 0 : attempts, lockedUntil: locksUntil },
      });
      return locksUntil
        ? { state: "locked", lockedUntil: locksUntil }
        : { state: "wrong-pin", remainingAttempts: 5 - attempts };
    }

    await transaction.reportBundleShareToken.update({
      where: { id: share.id },
      data: { viewCount: { increment: 1 }, wrongAttempts: 0, lockedUntil: null },
    });
    const reports = await transaction.report.findMany({
      where: { id: { in: share.reportIds }, ownerId: share.ownerId },
      orderBy: { reportDate: "desc" },
    });
    return { state: "ok", reports };
  });

  if (result.state === "invalid") return Response.json({ error: "This multi-report QR link is invalid, expired, or revoked." }, { status: 404 });
  if (result.state === "locked") return Response.json({ error: "This link is locked after five incorrect PIN attempts. Try again in 15 minutes.", lockedUntil: result.lockedUntil }, { status: 423 });
  if (result.state === "pin-required") return Response.json({ error: "Enter the 4-6 digit PIN shared by the report owner.", pinRequired: true }, { status: 401 });
  if (result.state === "wrong-pin") return Response.json({ error: "Incorrect PIN.", pinRequired: true, remainingAttempts: result.remainingAttempts }, { status: 403 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "Private report storage is not configured." }, { status: 503 });

  const reportsWithUrls = await Promise.all(result.reports.map(async (report) => {
    const { data: signed } = await supabase.storage
      .from("medical-reports")
      .createSignedUrl(report.storagePath, 60);
    return {
      id: report.id,
      patientName: report.patientName,
      reportType: report.reportType,
      reportDate: report.reportDate.toISOString().slice(0, 10),
      doctorName: report.doctorName,
      notes: report.notes,
      mimeType: report.mimeType,
      downloadUrl: signed?.signedUrl || null,
    };
  }));

  return Response.json({ reports: reportsWithUrls }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request, { params }) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const revoked = await context.prisma.reportBundleShareToken.updateMany({
    where: { id: params.token, ownerId: context.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!revoked.count) return Response.json({ error: "Bundle share link not found." }, { status: 404 });
  return Response.json({ revoked: true });
}

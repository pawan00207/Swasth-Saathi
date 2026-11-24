import { requireUser } from "../../../lib/api-auth";
import { normalizeLanguage } from "../../../lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const context = await requireUser(request, { allowSupabaseFallback: true });
  if (context.response) return context.response;
  const { profile, user } = context;
  const prefs = user?.user_metadata?.patient_preferences || {};

  return Response.json({
    profile: {
      userId: profile.userId,
      displayName: profile.displayName,
      role: profile.role,
      hospitalId: profile.hospitalId,
      emergencyContact: profile.emergencyContact || "",
      preferredLanguage: profile.preferredLanguage || prefs.preferredLanguage || "en",
      savedHospitals: Array.isArray(prefs.savedHospitals) ? prefs.savedHospitals : [],
      preferredCity: typeof prefs.preferredCity === "string" ? prefs.preferredCity : "",
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request) {
  const context = await requireUser(request, { allowSupabaseFallback: true });
  if (context.response) return context.response;
  const body = await request.json().catch(() => ({}));
  const data = {};
  if (body.emergencyContact !== undefined) {
    if (typeof body.emergencyContact !== "string" || body.emergencyContact.length > 80) {
      return Response.json({ error: "Emergency contact must be a text value of 80 characters or fewer." }, { status: 400 });
    }
    data.emergencyContact = body.emergencyContact.trim() || null;
  }
  if (body.preferredLanguage !== undefined) {
    if (typeof body.preferredLanguage !== "string") {
      return Response.json({ error: "Preferred language must be a valid language code." }, { status: 400 });
    }
    data.preferredLanguage = normalizeLanguage(body.preferredLanguage);
  }
  if (Object.keys(data).length === 0) {
    return Response.json({ error: "No valid profile fields provided." }, { status: 400 });
  }

  let updated = {
    emergencyContact: data.emergencyContact ?? context.profile.emergencyContact ?? null,
    preferredLanguage: data.preferredLanguage ?? context.profile.preferredLanguage ?? "en",
  };

  if (context.prisma) {
    try {
      const profile = await context.prisma.profile.update({
        where: { userId: context.user.id },
        data,
      });
      updated = {
        emergencyContact: profile.emergencyContact,
        preferredLanguage: profile.preferredLanguage,
      };
    } catch {
      // Fall back to Supabase REST update
    }
  }

  if (context.supabase) {
    await context.supabase
      .from("profiles")
      .upsert({
        id: context.user.id,
        display_name: context.profile.displayName || "",
        emergency_contact: updated.emergencyContact,
      }, { onConflict: "id" })
      .catch(() => {});
  }

  return Response.json(updated);
}

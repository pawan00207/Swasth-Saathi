import { getPrisma } from "./prisma";
import { getAuthenticatedUser, getSupabaseAdmin } from "./supabase/server";

export async function requireUser(request, { allowSupabaseFallback = false } = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { response: Response.json({ error: "Supabase Auth is not configured." }, { status: 503 }) };
  }
  const user = await getAuthenticatedUser(request, supabase);
  if (!user) return { response: Response.json({ error: "Sign in to continue." }, { status: 401 }) };

  const prisma = getPrisma();
  if (prisma) {
    try {
      const profile = await prisma.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, displayName: user.user_metadata?.display_name || "" },
        update: {},
      });
      return { prisma, supabase, user, profile };
    } catch (error) {
      if (!allowSupabaseFallback) {
        return { response: Response.json({ error: "Database temporarily unavailable." }, { status: 503 }) };
      }
      console.warn("Prisma unreachable in requireUser, using Supabase REST profile fallback", error?.name || "db error");
    }
  }

  if (!allowSupabaseFallback) {
    return { response: Response.json({ error: "Database is not configured." }, { status: 503 }) };
  }

  // Supabase REST profile lookup/upsert fallback when direct Postgres port 5432 is blocked
  let profile = {
    userId: user.id,
    displayName: user.user_metadata?.display_name || user.email || "",
    role: user.user_metadata?.role || "patient",
    hospitalId: user.user_metadata?.hospital_id || null,
    preferredLanguage: "en",
  };
  try {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, role, hospital_id, emergency_contact")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      profile = {
        userId: data.id,
        displayName: data.display_name || profile.displayName,
        role: data.role || "patient",
        hospitalId: data.hospital_id || null,
        emergencyContact: data.emergency_contact || "",
        preferredLanguage: "en",
      };
    }
  } catch {
    // Keep authenticated user metadata profile
  }

  return { prisma: null, supabase, user, profile };
}

import { getPrisma } from "./prisma";
import { getAuthenticatedUser, getSupabaseAdmin } from "./supabase/server";

export async function requireUser(request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { response: Response.json({ error: "Supabase Auth is not configured." }, { status: 503 }) };
  }
  const user = await getAuthenticatedUser(request, supabase);
  if (!user) return { response: Response.json({ error: "Sign in to continue." }, { status: 401 }) };
  const prisma = getPrisma();
  if (!prisma) {
    return { response: Response.json({ error: "Prisma Postgres is not configured." }, { status: 503 }) };
  }
  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, displayName: user.user_metadata?.display_name || "" },
    update: {},
  });
  return { prisma, user, profile };
}

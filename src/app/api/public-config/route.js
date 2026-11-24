import { getPublicBaseUrl } from "../../../lib/url";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  const razorpayConfigured = Boolean(keyId.startsWith("rzp_test_") && keySecret);

  return Response.json(
    {
      supabaseUrl,
      supabaseAnonKey,
      appBaseUrl: getPublicBaseUrl(request),
      razorpayConfigured,
      razorpayKeyId: razorpayConfigured ? keyId : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

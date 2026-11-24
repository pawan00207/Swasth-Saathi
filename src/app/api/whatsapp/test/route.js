import { getPrisma } from "../../../../lib/prisma";
import { isValidWhatsappPhone, maskPhone, normalizeWhatsappPhone } from "../../../../lib/audit";
import { getActiveWhatsAppProviderName, isWhatsAppConfigured, sendWhatsAppMessage } from "../../../../lib/whatsapp/provider";

export async function POST(request) {
  const { to } = await request.json().catch(() => ({}));
  const normalized = normalizeWhatsappPhone(to || "");
  if (!isValidWhatsappPhone(normalized)) {
    return Response.json({ error: "Provide a valid WhatsApp number with country code (e.g. +919876543210)." }, { status: 400 });
  }
  const provider = getActiveWhatsAppProviderName();
  if (!isWhatsAppConfigured(provider)) {
    return Response.json({
      ok: false,
      configured: false,
      provider,
      error: `WhatsApp (${provider}) credentials are not configured in .env.local.`,
    }, { status: 503 });
  }
  const prisma = getPrisma();
  const result = await sendWhatsAppMessage({
    to: normalized,
    body: "Swasth Saathi test message: WhatsApp notifications and SOS alerts are connected.",
    messageType: "test",
    prisma,
  });
  return Response.json({
    ok: result.ok,
    status: result.status,
    provider: result.provider,
    recipientMask: maskPhone(normalized),
  }, { status: result.ok ? 200 : 502 });
}

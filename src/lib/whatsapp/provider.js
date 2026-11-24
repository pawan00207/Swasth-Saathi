import { createHmac, timingSafeEqual } from "node:crypto";
import { maskPhone, normalizeWhatsappPhone } from "../audit";

const rateBuckets = new Map();

function checkRateLimit(recipientMask) {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
  const current = rateBuckets.get(recipientMask);
  if (current && current.resetAt > now && current.count >= 12) {
    return false;
  }
  rateBuckets.set(
    recipientMask,
    current && current.resetAt > now
      ? { count: current.count + 1, resetAt: current.resetAt }
      : { count: 1, resetAt: now + 60_000 },
  );
  return true;
}

export function getActiveWhatsAppProviderName() {
  const configured = (process.env.WHATSAPP_PROVIDER || "twilio").toLowerCase();
  return configured === "meta" ? "meta" : "twilio";
}

export function isWhatsAppConfigured(provider = getActiveWhatsAppProviderName()) {
  if (provider === "meta") {
    return Boolean(process.env.META_WHATSAPP_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID);
  }
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID
      && process.env.TWILIO_AUTH_TOKEN
      && process.env.TWILIO_WHATSAPP_FROM,
  );
}

async function sendViaTwilio({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromRaw = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !fromRaw) {
    return { ok: false, status: "unconfigured", externalId: null };
  }
  const from = fromRaw.startsWith("whatsapp:") ? fromRaw : `whatsapp:${normalizeWhatsappPhone(fromRaw)}`;
  const target = `whatsapp:${normalizeWhatsappPhone(to)}`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams({ From: from, To: target, Body: body });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(`Twilio API returned ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return { ok: true, status: data.status || "sent", externalId: data.sid || null };
}

async function sendViaMeta({ to, body }) {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { ok: false, status: "unconfigured", externalId: null };
  }
  const recipient = normalizeWhatsappPhone(to).replace(/^\+/, "");
  const response = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipient,
      type: "text",
      text: { body },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(`Meta Cloud API returned ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return { ok: true, status: "sent", externalId: data.messages?.[0]?.id || null };
}

async function logMessage(prisma, { direction, provider, recipientMask, messageType, status, externalId = null }) {
  if (!prisma) return;
  try {
    await prisma.messageLog.create({
      data: {
        direction,
        provider,
        recipientMask,
        messageType,
        status,
        externalId,
      },
    });
  } catch (error) {
    console.warn("Could not write messages_log", error?.message || "db error");
  }
}

export async function recordInboundMessageLog(prisma, { provider, fromPhone, messageType, status = "received", externalId = null }) {
  return logMessage(prisma, {
    direction: "inbound",
    provider,
    recipientMask: maskPhone(fromPhone),
    messageType,
    status,
    externalId,
  });
}

export async function sendWhatsAppMessage({ to, body, messageType = "notification", prisma = null }) {
  const provider = getActiveWhatsAppProviderName();
  const normalizedTo = normalizeWhatsappPhone(to);
  const recipientMask = maskPhone(normalizedTo);
  if (!normalizedTo) {
    return { ok: false, status: "invalid-recipient", provider };
  }
  if (!checkRateLimit(recipientMask)) {
    await logMessage(prisma, { direction: "outbound", provider, recipientMask, messageType, status: "rate-limited" });
    return { ok: false, status: "rate-limited", provider };
  }
  if (!isWhatsAppConfigured(provider)) {
    await logMessage(prisma, { direction: "outbound", provider, recipientMask, messageType, status: "demo-skipped" });
    return { ok: false, status: "unconfigured", provider };
  }

  const maxAttempts = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = provider === "meta"
        ? await sendViaMeta({ to: normalizedTo, body })
        : await sendViaTwilio({ to: normalizedTo, body });
      await logMessage(prisma, {
        direction: "outbound",
        provider,
        recipientMask,
        messageType,
        status: result.status,
        externalId: result.externalId,
      });
      return { ...result, provider };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }
  console.warn("WhatsApp send failed after retries", { provider, recipientMask, status: lastError?.status || "error" });
  await logMessage(prisma, { direction: "outbound", provider, recipientMask, messageType, status: "failed" });
  return { ok: false, status: "failed", provider };
}

export function verifyTwilioSignature({ url, params, signature, authToken }) {
  if (!authToken || !signature || !url) return false;
  const sortedKeys = Object.keys(params || {}).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + String(params[key] ?? "");
  }
  const expected = createHmac("sha1", authToken).update(data).digest();
  const received = Buffer.from(String(signature), "utf8");
  const expectedB64 = Buffer.from(expected.toString("base64"), "utf8");
  return received.length === expectedB64.length && timingSafeEqual(received, expectedB64);
}

export function verifyMetaSignature({ rawBody, signatureHeader, appSecret }) {
  if (!appSecret || !signatureHeader) return false;
  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) return false;
  const hex = signatureHeader.slice(prefix.length);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const received = /^[a-f0-9]{64}$/i.test(hex) ? Buffer.from(hex, "hex") : Buffer.alloc(0);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

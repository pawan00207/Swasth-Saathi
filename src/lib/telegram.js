const DEDUPE_TTL_MS = 60_000;

function getDedupeStore() {
  if (!globalThis.__swasthTelegramDedupe) {
    globalThis.__swasthTelegramDedupe = new Map();
  }
  return globalThis.__swasthTelegramDedupe;
}

function pruneDedupeStore(store, now = Date.now()) {
  for (const [key, expiresAt] of store.entries()) {
    if (expiresAt <= now) {
      store.delete(key);
    }
  }
}

export function getTelegramConfig() {
  return {
    botToken: (process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    chatId: (process.env.TELEGRAM_CHAT_ID || "").trim(),
    emergencyChatId: (
      process.env.TELEGRAM_EMERGENCY_CHAT_ID ||
      process.env.TELEGRAM_SOS_CHAT_ID ||
      process.env.TELEGRAM_CHAT_ID ||
      ""
    ).trim(),
  };
}

export function isTelegramConfigured({ emergency = false } = {}) {
  const cfg = getTelegramConfig();
  const targetChatId = emergency ? cfg.emergencyChatId : cfg.chatId;
  return Boolean(cfg.botToken && targetChatId);
}

export function maskChatId(chatId) {
  const raw = String(chatId || "").trim();
  if (!raw) return "****";
  if (raw.length <= 4) return "****";
  return `****${raw.slice(-4)}`;
}

async function logTelegramMessage(prisma, { recipientMask, messageType, status, externalId = null }) {
  if (!prisma) return;
  try {
    await prisma.messageLog.create({
      data: {
        direction: "outbound",
        provider: "telegram",
        recipientMask,
        messageType,
        status,
        externalId: externalId ? String(externalId) : null,
      },
    });
  } catch (error) {
    console.warn("Could not write Telegram message log:", error?.name || "db error");
  }
}

export async function sendTelegramMessage({
  text,
  chatId = null,
  emergency = false,
  messageType = "notification",
  dedupeKey = null,
  dedupeTtlMs = DEDUPE_TTL_MS,
  prisma = null,
}) {
  const cfg = getTelegramConfig();
  const targetChatId = String(chatId || (emergency ? cfg.emergencyChatId : cfg.chatId) || "").trim();
  const recipientMask = maskChatId(targetChatId);
  const cleanText = String(text || "").trim();

  if (!cleanText) {
    return {
      ok: false,
      configured: isTelegramConfigured({ emergency }),
      status: "invalid-message",
      provider: "telegram",
      recipientMask,
    };
  }

  if (!cfg.botToken || !targetChatId) {
    await logTelegramMessage(prisma, {
      recipientMask,
      messageType,
      status: "unconfigured",
    });
    return {
      ok: false,
      configured: false,
      status: "unconfigured",
      provider: "telegram",
      recipientMask,
    };
  }

  if (dedupeKey) {
    const store = getDedupeStore();
    const now = Date.now();
    pruneDedupeStore(store, now);
    const existingExpiry = store.get(dedupeKey);
    if (existingExpiry && existingExpiry > now) {
      return {
        ok: true,
        configured: true,
        deduplicated: true,
        status: "deduplicated",
        provider: "telegram",
        recipientMask,
      };
    }
    store.set(dedupeKey, now + dedupeTtlMs);
  }

  const endpoint = `https://api.telegram.org/bot${encodeURIComponent(cfg.botToken)}/sendMessage`;
  const maxAttempts = 2;
  let lastStatus = null;
  let lastErrorCode = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: cleanText,
          disable_web_page_preview: true,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });

      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.ok) {
        const messageId = payload?.result?.message_id ?? null;
        await logTelegramMessage(prisma, {
          recipientMask,
          messageType,
          status: "sent",
          externalId: messageId,
        });
        return {
          ok: true,
          configured: true,
          deduplicated: false,
          status: "sent",
          provider: "telegram",
          recipientMask,
          messageId,
        };
      }

      lastStatus = response.status;
      lastErrorCode = payload?.error_code || response.status;
      if (response.status >= 400 && response.status < 500) {
        break;
      }
    } catch (error) {
      lastStatus = 0;
      lastErrorCode = error?.name || "network-error";
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  console.warn("Telegram notification delivery failed", {
    messageType,
    recipientMask,
    status: lastStatus,
    errorCode: lastErrorCode,
  });

  await logTelegramMessage(prisma, {
    recipientMask,
    messageType,
    status: "failed",
  });

  return {
    ok: false,
    configured: true,
    deduplicated: false,
    status: "failed",
    provider: "telegram",
    recipientMask,
  };
}

export function formatBedRequestTelegramMessage({ bedRequest, hospitalName }) {
  const timestamp = bedRequest.createdAt instanceof Date
    ? bedRequest.createdAt.toISOString()
    : String(bedRequest.createdAt || bedRequest.updatedAt || new Date().toISOString());

  return [
    "🏥 New Hospital Bed Request",
    `Request ID: ${bedRequest.id}`,
    `Hospital: ${hospitalName || bedRequest.hospital?.name || bedRequest.hospitalId}`,
    `Bed Type: ${bedRequest.bedType}`,
    `Status: ${String(bedRequest.status || "pending").toUpperCase()}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
}

export async function notifyBedRequestTelegram({ bedRequest, hospitalName, prisma = null, dedupeKey = null }) {
  if (!bedRequest?.id) {
    return { ok: false, configured: isTelegramConfigured(), status: "invalid-request", provider: "telegram" };
  }
  const text = formatBedRequestTelegramMessage({ bedRequest, hospitalName });
  return sendTelegramMessage({
    text,
    messageType: "bed_request_telegram",
    dedupeKey: dedupeKey || `bed_request:${bedRequest.id}`,
    prisma,
  });
}

export function formatSosAlertTelegramMessage({ sosEvent, locationShared = false }) {
  const timestamp = sosEvent.createdAt instanceof Date
    ? sosEvent.createdAt.toISOString()
    : String(sosEvent.createdAt || new Date().toISOString());

  const header = sosEvent.isDrill
    ? "🚨 EMERGENCY SOS ALERT (TEST DRILL)"
    : "🚨 EMERGENCY SOS ALERT";

  const lines = [
    header,
    `SOS ID: ${sosEvent.id}`,
    `Alert Status: ${String(sosEvent.status || "sent").toUpperCase()}`,
    `Timestamp: ${timestamp}`,
  ];

  if (locationShared) {
    const hasCoords = Number.isFinite(Number(sosEvent.latitude)) && Number.isFinite(Number(sosEvent.longitude));
    const hasAddress = typeof sosEvent.addressText === "string" && sosEvent.addressText.trim().length > 0;
    if (hasCoords) {
      lines.push(`Location: https://www.google.com/maps?q=${sosEvent.latitude},${sosEvent.longitude}`);
    }
    if (hasAddress) {
      lines.push(`Landmark: ${sosEvent.addressText.trim()}`);
    }
    if (!hasCoords && !hasAddress) {
      lines.push("Location: Shared (coordinates unavailable)");
    }
  } else {
    lines.push("Location: Not shared by patient");
  }

  return lines.join("\n");
}

export async function notifySosAlertTelegram({
  sosEvent,
  locationShared = false,
  prisma = null,
  dedupeKey = null,
}) {
  if (!sosEvent?.id) {
    return { ok: false, configured: isTelegramConfigured({ emergency: true }), status: "invalid-sos", provider: "telegram" };
  }
  const text = formatSosAlertTelegramMessage({ sosEvent, locationShared });
  return sendTelegramMessage({
    text,
    emergency: true,
    messageType: "sos_alert_telegram",
    dedupeKey: dedupeKey || `sos:${sosEvent.id}`,
    prisma,
  });
}

export function formatSosHospitalPreAlertTelegramMessage({ sosEvent, hospitalName, bedType }) {
  const timestamp = sosEvent.createdAt instanceof Date
    ? sosEvent.createdAt.toISOString()
    : String(sosEvent.createdAt || new Date().toISOString());
  const header = sosEvent.isDrill
    ? "🚨 TEST HOSPITAL PRE-ALERT"
    : "🚨 EMERGENCY HOSPITAL PRE-ALERT";

  return [
    header,
    `SOS ID: ${sosEvent.id}`,
    `Hospital: ${hospitalName}`,
    `Bed Type: ${bedType}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
}

export async function notifySosHospitalPreAlertTelegram({
  sosEvent,
  hospitalName,
  hospitalId,
  bedType,
  prisma = null,
}) {
  if (!sosEvent?.id || !hospitalName || !hospitalId || !bedType) {
    return {
      ok: false,
      configured: isTelegramConfigured({ emergency: true }),
      status: "invalid-prealert",
      provider: "telegram",
    };
  }

  return sendTelegramMessage({
    text: formatSosHospitalPreAlertTelegramMessage({ sosEvent, hospitalName, bedType }),
    emergency: true,
    messageType: "sos_hospital_prealert_telegram",
    dedupeKey: `sos-prealert:${sosEvent.id}:${hospitalId}`,
    dedupeTtlMs: 2 * 60 * 60 * 1000,
    prisma,
  });
}

export function formatPaymentSettlementTelegramMessage({
  billNumber,
  hospitalName,
  amountInr,
  paymentId,
  status = "PAID",
  timestamp = new Date().toISOString(),
}) {
  return [
    "💳 Care Wallet Hospital Settlement",
    `Invoice: ${billNumber}`,
    `Hospital: ${hospitalName || "Partner Hospital"}`,
    `Amount: Rs. ${Number(amountInr || 0).toFixed(2)}`,
    `Status: ${String(status).toUpperCase()}`,
    ...(paymentId ? [`Payment Ref: ${paymentId}`] : []),
    `Timestamp: ${timestamp}`,
  ].join("\n");
}

export async function notifyPaymentSettlementTelegram({
  billNumber,
  hospitalName,
  amountInr,
  paymentId = "",
  prisma = null,
  dedupeKey = null,
}) {
  if (!billNumber) {
    return { ok: false, configured: isTelegramConfigured(), status: "invalid-payment", provider: "telegram" };
  }
  const text = formatPaymentSettlementTelegramMessage({
    billNumber,
    hospitalName,
    amountInr,
    paymentId,
  });
  return sendTelegramMessage({
    text,
    messageType: "payment_settlement_telegram",
    dedupeKey: dedupeKey || `payment:${paymentId || billNumber}`,
    prisma,
  });
}

export function clearTelegramDedupeForTests() {
  getDedupeStore().clear();
}

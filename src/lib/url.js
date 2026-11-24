const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
const HOST_HEADER_PATTERN = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/;

export function isLocalhostOrigin(value) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return LOCAL_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return true;
  }
}

function sanitizeHost(rawHost) {
  if (!rawHost) return "";
  const first = String(rawHost).split(",")[0].trim();
  if (!first || !HOST_HEADER_PATTERN.test(first)) return "";
  return first;
}

function sanitizeProto(rawProto, host) {
  const first = String(rawProto || "").split(",")[0].trim().toLowerCase();
  if (first === "http" || first === "https") return first;
  const hostname = String(host || "").split(":")[0].toLowerCase();
  return LOCAL_HOSTS.has(hostname) ? "http" : "https";
}

function parseOrigin(rawUrl) {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(String(rawUrl).trim());
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.origin;
    }
  } catch {
    // Ignore invalid URL
  }
  return "";
}
function parseForwardedHeader(headerValue) {
  if (!headerValue) return "";
  const parts = String(headerValue).split(",")[0].split(";");
  let host = "";
  let proto = "";
  for (const part of parts) {
    const [k, v] = part.split("=").map((s) => (s || "").trim().replace(/^"|"$/g, ""));
    if (k?.toLowerCase() === "host") host = sanitizeHost(v);
    if (k?.toLowerCase() === "proto") proto = v?.toLowerCase();
  }
  if (!host) return "";
  return `${sanitizeProto(proto, host)}://${host}`;
}

export function getPublicBaseUrl(request) {
  const envOrigin = parseOrigin(process.env.APP_BASE_URL)
    || parseOrigin(process.env.NEXT_PUBLIC_APP_URL)
    || parseOrigin(process.env.PUBLIC_URL);
  if (envOrigin && !isLocalhostOrigin(envOrigin)) {
    return envOrigin;
  }

  if (request?.headers) {
    const forwardedHost = sanitizeHost(request.headers.get("x-forwarded-host"));
    if (forwardedHost) {
      const proto = sanitizeProto(request.headers.get("x-forwarded-proto"), forwardedHost);
      const origin = `${proto}://${forwardedHost}`;
      if (!isLocalhostOrigin(origin)) return origin;
    }

    const rfcForwarded = parseForwardedHeader(request.headers.get("forwarded"));
    if (rfcForwarded && !isLocalhostOrigin(rfcForwarded)) {
      return rfcForwarded;
    }

    const origHost = sanitizeHost(request.headers.get("x-original-host"));
    if (origHost) {
      const proto = sanitizeProto(request.headers.get("x-forwarded-proto"), origHost);
      const origin = `${proto}://${origHost}`;
      if (!isLocalhostOrigin(origin)) return origin;
    }

    const headerOrigin = parseOrigin(request.headers.get("origin"));
    if (headerOrigin && !isLocalhostOrigin(headerOrigin)) {
      return headerOrigin;
    }

    const refererOrigin = parseOrigin(request.headers.get("referer"));
    if (refererOrigin && !isLocalhostOrigin(refererOrigin)) {
      return refererOrigin;
    }

    const hostHeader = sanitizeHost(request.headers.get("host"));
    if (hostHeader) {
      const proto = sanitizeProto(request.headers.get("x-forwarded-proto"), hostHeader);
      const origin = `${proto}://${hostHeader}`;
      if (!isLocalhostOrigin(origin)) return origin;
    }
  }

  if (envOrigin) return envOrigin;
  if (request?.url) {
    const fallback = parseOrigin(request.url);
    if (fallback) return fallback;
  }
  return "";
}

export function resolveClientPublicOrigin(configuredBaseUrl) {
  const cfgOrigin = parseOrigin(configuredBaseUrl);
  if (typeof window !== "undefined") {
    const winOrigin = parseOrigin(window.location.origin);
    if (cfgOrigin && !isLocalhostOrigin(cfgOrigin)) return cfgOrigin;
    if (winOrigin && !isLocalhostOrigin(winOrigin)) return winOrigin;
    return cfgOrigin || winOrigin || "";
  }
  return cfgOrigin;
}

export function sanitizeExternalPortalUrl(rawUrl) {
  if (typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    // Reject malformed URLs
  }
  return "";
}

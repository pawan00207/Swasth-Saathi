export function getPublicAppBaseUrl(request, configuredUrl = process.env.APP_BASE_URL) {
  const candidate = configuredUrl?.trim() || request.url;
  if (!URL.canParse(candidate)) return null;

  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname === "::1"
    || hostname.startsWith("127.")
  ) {
    return null;
  }

  return url.origin;
}

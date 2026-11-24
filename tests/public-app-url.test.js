import { describe, expect, it } from "vitest";
import { getPublicAppBaseUrl } from "../src/lib/public-app-url.js";

describe("public report share URL", () => {
  it("uses the configured host and removes any path", () => {
    const request = { url: "http://localhost:3000/api/reports/share" };
    expect(getPublicAppBaseUrl(request, "https://health.example.org/app/")).toBe("https://health.example.org");
  });

  it("uses a non-loopback request origin when no host is configured", () => {
    const request = { url: "https://health.example.org/api/reports/share" };
    expect(getPublicAppBaseUrl(request, "")).toBe("https://health.example.org");
  });

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
    "not-a-url",
  ])("rejects loopback or invalid host %s", (host) => {
    const request = { url: "https://health.example.org/api/reports/share" };
    expect(getPublicAppBaseUrl(request, host)).toBeNull();
  });
});

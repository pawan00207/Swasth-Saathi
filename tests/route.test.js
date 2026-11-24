import { describe, expect, it } from "vitest";
import { POST } from "../src/app/api/route/route";

describe("route API input validation", () => {
  it("rejects a request without origin and destination", async () => {
    const request = new Request("http://localhost/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: "", destination: "" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Origin and destination are required." });
  });

  it("rejects out-of-range coordinates rather than silently geocoding a substitute", async () => {
    const request = new Request("http://localhost/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: "India Gate, New Delhi",
        destination: "AIIMS New Delhi",
        originCoordinates: [120, 77],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Coordinates must be valid latitude/longitude pairs." });
  });
});

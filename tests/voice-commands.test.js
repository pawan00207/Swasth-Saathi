import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "../src/lib/voiceCommands";
import { filterHospitals } from "../src/features/beds/filterHospitals";
import hospitalsSeed from "../src/features/beds/data/hospitals.json";

describe("voice command navigation & hospital search", () => {
  it("routes health service voice commands to the correct pages", () => {
    expect(parseVoiceCommand("Open Care Wallet").path).toBe("/billing");
    expect(parseVoiceCommand("Show government schemes").path).toBe("/schemes");
    expect(parseVoiceCommand("Book an appointment").path).toBe("/appointments");
    expect(parseVoiceCommand("Start teleconsult with doctor").path).toBe("/consult");
    expect(parseVoiceCommand("Show my medical reports").path).toBe("/records");
    expect(parseVoiceCommand("Upload QR report").path).toBe("/records/upload");
    expect(parseVoiceCommand("Open SOS emergency").path).toBe("/sos");
    expect(parseVoiceCommand("Open ABDM ABHA").path).toBe("/abdm");
    expect(parseVoiceCommand("Verify on blockchain").path).toBe("/blockchain");
  });

  it("extracts city, bed filters, and hospital name for hospital search commands", () => {
    const icuDelhi = parseVoiceCommand("Find ICU beds in Delhi");
    expect(icuDelhi.type).toBe("search_hospitals");
    expect(icuDelhi.path).toBe("/beds");
    expect(icuDelhi.city).toBe("Delhi");
    expect(icuDelhi.filters.icu).toBe(true);
    expect(icuDelhi.url).toContain("/beds?");
    expect(icuDelhi.url).toContain("city=Delhi");
    expect(icuDelhi.url).toContain("icu=1");

    const aiims = parseVoiceCommand("Search AIIMS hospital");
    expect(aiims.type).toBe("search_hospitals");
    expect(aiims.query).toBe("AIIMS");
    expect(aiims.url).toContain("q=AIIMS");

    const govtOxygen = parseVoiceCommand("Government hospitals with oxygen in Mumbai");
    expect(govtOxygen.type).toBe("search_hospitals");
    expect(govtOxygen.city).toBe("Mumbai");
    expect(govtOxygen.filters.oxygen).toBe(true);
    expect(govtOxygen.filters.price).toBe("Government");
  });

  it("parses accessible route commands for hospitals and nearby search", () => {
    const routeSafdarjung = parseVoiceCommand("Route to Safdarjung Hospital");
    expect(routeSafdarjung.type).toBe("route_hospital");
    expect(routeSafdarjung.path).toBe("/route");
    expect(routeSafdarjung.destination).toBe("Safdarjung Hospital");
    expect(routeSafdarjung.url).toContain("destination=Safdarjung+Hospital");

    const nearby = parseVoiceCommand("Find nearby hospitals");
    expect(nearby.type).toBe("route_hospital");
    expect(nearby.action).toBe("nearby");
  });

  it("filters hospitals accurately by spoken query and city substring", () => {
    const aiimsResults = filterHospitals(hospitalsSeed, { query: "AIIMS" });
    expect(aiimsResults.some((h) => h.id === "aiims-delhi")).toBe(true);
    expect(aiimsResults.length).toBe(1);

    const delhiIcu = filterHospitals(hospitalsSeed, { city: "Delhi", icu: true });
    expect(delhiIcu.map((h) => h.id)).toEqual(["aiims-delhi", "safdarjung"]);
  });
});

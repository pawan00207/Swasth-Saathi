import { describe, it, expect } from "vitest";
import { matchScheme } from "../src/features/schemes/eligibility";

describe("scheme eligibility matching", () => {
  it("returns eligible when disability and landless profile match", () => {
    const scheme = { eligibility: { disabilities:["mobility"], incomeLimit:300000, states:["All"], minAge:18, gender:"All", landless:true, occupation:"All" } };
    expect(matchScheme(scheme, { disability:"mobility", income:"200000", landless:"landless", state:"", age:"30", gender:"All", occupation:"All" })).toBe("eligible");
  });
  it("returns check documents when profile conflicts", () => {
    const scheme = { eligibility: { disabilities:["visual"], incomeLimit:250000, states:["All"], minAge:18, gender:"All", landless:null, occupation:"All" } };
    expect(matchScheme(scheme, { disability:"mobility", income:"500000", landless:"", state:"", age:"10", gender:"All", occupation:"All" })).toBe("check");
  });
});

import { describe, it, expect } from "vitest";
import { filterHospitals } from "../src/features/beds/filterHospitals";

describe("bed filtering", () => {
  const hospitals = [
    {id:"a",city:"Delhi",icu:2,oxygen:4,ventilator:1,pediatric:1,priceRange:"Government",distance:3},
    {id:"b",city:"Mumbai",icu:0,oxygen:8,ventilator:3,pediatric:0,priceRange:"Private",distance:8},
  ];
  it("filters ICU and government hospitals", () => {
    expect(filterHospitals(hospitals,{icu:true,price:"Government"}).map((h)=>h.id)).toEqual(["a"]);
  });
  it("sorts remaining hospitals by distance", () => {
    expect(filterHospitals(hospitals,{oxygen:true}).map((h)=>h.id)).toEqual(["a","b"]);
  });
});

export function matchScheme(scheme, profile) {
  const e = scheme.eligibility;
  if (profile.age && e.minAge && Number(profile.age) < e.minAge) return "check";
  if (profile.income && e.incomeLimit && Number(profile.income) > e.incomeLimit) return "check";
  if (profile.disability && profile.disability !== "none" && e.disabilities?.length && !e.disabilities.includes(profile.disability)) return "check";
  if (e.landless !== null && profile.landless !== "" && e.landless !== (profile.landless === "landless")) return "check";
  if (profile.state && e.states?.length && !e.states.includes("All") && !e.states.includes(profile.state)) return "check";
  if (profile.gender && e.gender !== "All" && profile.gender !== e.gender) return "check";
  if (profile.occupation && profile.occupation !== "All" && e.occupation !== "All" && profile.occupation !== e.occupation) return "check";
  if (e.disabilities?.length || e.incomeLimit || e.landless !== null) return "eligible";
  return "likely";
}

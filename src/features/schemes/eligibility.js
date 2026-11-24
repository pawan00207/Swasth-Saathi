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

export function explainSchemeMatch(scheme, profile) {
  const eligibility = scheme.eligibility || {};
  const reasons = [];
  if (profile.age && eligibility.minAge && Number(profile.age) < eligibility.minAge) reasons.push(`Minimum age is ${eligibility.minAge}`);
  if (profile.age && eligibility.maxAge && Number(profile.age) > eligibility.maxAge) reasons.push(`Maximum age is ${eligibility.maxAge}`);
  if (profile.income && eligibility.incomeLimit && Number(profile.income) > eligibility.incomeLimit) reasons.push(`Income must not exceed Rs. ${eligibility.incomeLimit}`);
  if (profile.disability && profile.disability !== "none" && eligibility.disabilities?.length && !eligibility.disabilities.includes(profile.disability)) reasons.push("Disability category does not match the listed criteria");
  if (eligibility.disabilities?.length && (!profile.disability || profile.disability === "none")) reasons.push("Disability certificate/category needs confirmation");
  if (profile.state && eligibility.states?.length && !eligibility.states.includes("All") && !eligibility.states.includes(profile.state)) reasons.push(`Available state: ${eligibility.states.join(", ")}`);
  if (profile.gender && profile.gender !== "All" && eligibility.gender && eligibility.gender !== "All" && profile.gender !== eligibility.gender) reasons.push(`Listed for ${eligibility.gender}`);
  if (eligibility.landless !== null && profile.landless && eligibility.landless !== (profile.landless === "landless")) reasons.push(eligibility.landless ? "Landless applicants are required" : "Land ownership is required");
  if (profile.occupation && profile.occupation !== "All" && eligibility.occupation && eligibility.occupation !== "All" && profile.occupation !== eligibility.occupation) reasons.push(`Occupation criteria specify ${eligibility.occupation}`);

  const status = reasons.length
    ? "check"
    : matchScheme(scheme, profile) === "eligible" ? "eligible" : "likely";
  return {
    status,
    reason: reasons.length ? reasons.join(". ") : status === "eligible"
      ? "Your entered details match the available criteria; verify documents with the official portal."
      : "Some eligibility details are not specified; confirm them with the official portal.",
  };
}

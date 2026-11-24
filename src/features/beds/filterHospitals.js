export function filterHospitals(hospitals, filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  const city = String(filters.city || "").trim().toLowerCase();
  const price = String(filters.price || "").trim().toLowerCase();

  return hospitals
    .filter((h) => {
      if (query) {
        const haystack = [h.name, h.city, h.state, h.address, h.priceRange]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (city && !String(h.city || "").toLowerCase().includes(city)) return false;
      if (filters.icu && Number(h.icu) <= 0) return false;
      if (filters.oxygen && Number(h.oxygen) <= 0) return false;
      if (filters.ventilator && Number(h.ventilator) <= 0) return false;
      if (filters.pediatric && Number(h.pediatric) <= 0) return false;
      if (price && String(h.priceRange || "").toLowerCase() !== price) return false;
      if (filters.maxDistance && Number(h.distance) > Number(filters.maxDistance)) return false;
      return true;
    })
    .sort((a, b) => Number(a.distance) - Number(b.distance));
}

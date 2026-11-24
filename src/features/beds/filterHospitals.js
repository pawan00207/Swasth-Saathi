export function filterHospitals(hospitals, filters={}) {
  return hospitals.filter((h)=>{
    if(filters.city && h.city.toLowerCase()!==filters.city.toLowerCase()) return false;
    if(filters.icu && h.icu<=0) return false;
    if(filters.oxygen && h.oxygen<=0) return false;
    if(filters.ventilator && h.ventilator<=0) return false;
    if(filters.pediatric && h.pediatric<=0) return false;
    if(filters.price && filters.price==="Government" && h.priceRange!=="Government") return false;
    if(filters.maxDistance && h.distance>Number(filters.maxDistance)) return false;
    return true;
  }).sort((a,b)=>a.distance-b.distance);
}

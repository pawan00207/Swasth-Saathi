import seed from "../../../../features/beds/data/hospitals.json";
export async function GET(request){
  const {searchParams}=new URL(request.url);
  const lat=Number(searchParams.get("lat")),lng=Number(searchParams.get("lng"));
  const withDistance=seed.map((h)=>({...h,distance:lat&&lng?Math.round(Math.hypot(h.lat-lat,h.lng-lng)*111*10)/10:h.distance}));
  return Response.json({hospitals:withDistance.sort((a,b)=>a.distance-b.distance)});
}

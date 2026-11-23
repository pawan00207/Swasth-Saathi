import seed from "../../../../../features/beds/data/hospitals.json";
let hospitals=[...seed];
export async function PUT(request,{params}) {
  const body=await request.json();
  hospitals=hospitals.map((h)=>h.id===params.id?{...h,...body,lastUpdated:new Date().toISOString()}:h);
  return Response.json({hospital:hospitals.find((h)=>h.id===params.id)||body});
}

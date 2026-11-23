import seed from "../../../features/beds/data/hospitals.json";
let hospitals=[...seed];
export async function GET(request){
  const {searchParams}=new URL(request.url);
  const city=searchParams.get("city");
  const bedApiUrl=process.env.HOSPITAL_BED_API_URL;
  let upstreamStatus=null;
  if(bedApiUrl){
    try{
      const upstream=await fetch(bedApiUrl,{
        headers:process.env.HOSPITAL_BED_API_KEY?{Authorization:`Bearer ${process.env.HOSPITAL_BED_API_KEY}`}:{},
        cache:"no-store",
      });
      upstreamStatus=upstream.status;
      if(upstream.ok){
        const data=await upstream.json();
        const liveHospitals=Array.isArray(data)?data:(data.hospitals||[]);
        if(liveHospitals.length){
          return Response.json({source:"live-hms",hospitals:city?liveHospitals.filter((h)=>h.city?.toLowerCase()===city.toLowerCase()):liveHospitals,updatedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
        }
      }
    }catch(error){console.error("Live hospital bed API unavailable",error);upstreamStatus="unreachable";}
  }
  return Response.json({source:"seeded-demo",upstreamStatus,hospitals:city?hospitals.filter((h)=>h.city.toLowerCase()===city.toLowerCase()):hospitals,updatedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
}

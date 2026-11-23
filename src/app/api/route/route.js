export async function POST(request) {
  const body=await request.json();
  const key=process.env.OPENROUTESERVICE_API_KEY;
  if(key){
    try{
      const response=await fetch("https://api.openrouteservice.org/v2/directions/wheelchair/geojson",{method:"POST",headers:{Authorization:key,"Content-Type":"application/json"},body:JSON.stringify({coordinates:[[77.2295,28.6129],[77.2100,28.5672]]})});
      if(response.ok){const data=await response.json();const summary=data.features?.[0]?.properties?.summary;const coords=data.features?.[0]?.geometry?.coordinates?.map(([lng,lat])=>[lat,lng])||[];return Response.json({mock:false,distance:(summary?.distance/1000||0).toFixed(1),duration:Math.round((summary?.duration||0)/60),steps:["Follow the wheelchair-accessible route from the start point","Continue to the selected entrance","Confirm lift and ramp availability at reception"],warnings:["Verify ramp/entrance availability before travel","Wheelchair profile availability depends on OpenStreetMap mapping"],coordinates:coords});}
    }catch(error){console.error("OpenRouteService error",error);}
  }
  return Response.json({mock:true,distance:"6.8",duration:"18",steps:["Start from the demo origin","Proceed along wide, paved roads","Use the AIIMS/central hospital accessible entrance","Check in at the accessible help desk"],warnings:["Mock route - not navigable directions","Temporary ramps or lift closures are unknown","Confirm step-free entrance with the hospital"],coordinates:[[28.6129,77.2295],[28.5920,77.2200],[28.5672,77.2100]]});
}

"use client";
import { useEffect } from "react";
import L from "leaflet";

export default function RouteMap({route}) {
  useEffect(()=>{
    const map=L.map("healthx-route-map").setView([28.575,77.21],12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
    const coords=route.coordinates?.length?route.coordinates:[[28.6129,77.2295],[28.5672,77.2100]];
    L.polyline(coords,{color:"#115e59",weight:5}).addTo(map);
    L.marker(coords[0]).addTo(map).bindPopup("Origin");
    L.marker(coords[coords.length-1]).addTo(map).bindPopup("Destination");
    map.fitBounds(L.latLngBounds(coords));
    return()=>map.remove();
  },[route]);
  return <div id="healthx-route-map" className="h-[420px] rounded border" aria-label="Map showing the planned route"/>;
}

import hospitals from "../../../features/accessible-routing/hospitals.json";

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Routing provider returned ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function geocode(query) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (token) {
    const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "1");
    url.searchParams.set("access_token", token);
    const data = await fetchJson(url);
    const coordinates = data.features?.[0]?.geometry?.coordinates;
    if (coordinates?.length === 2) return coordinates;
  }
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  const data = await fetchJson(url, { headers: { "User-Agent": "SwasthSaathiHealthcareDemo/1.0" } });
  if (!data[0]) throw new Error(`Could not locate "${query}"`);
  return [Number(data[0].lon), Number(data[0].lat)];
}

function validCoordinatePair(value) {
  return Array.isArray(value) &&
    value.length === 2 &&
    value.every((coordinate) => Number.isFinite(Number(coordinate))) &&
    Math.abs(Number(value[0])) <= 90 &&
    Math.abs(Number(value[1])) <= 180;
}

function mapboxRoutes(data) {
  return (data.routes || []).map((route) => ({
    distance: Number((route.distance / 1000).toFixed(1)),
    duration: Math.round(route.duration / 60),
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    steps: route.legs?.flatMap((leg) => leg.steps || []).map((step) => step.maneuver?.instruction).filter(Boolean) || [],
  }));
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const origin = typeof body.origin === "string" ? body.origin.trim().slice(0, 200) : "";
  const destination = typeof body.destination === "string" ? body.destination.trim().slice(0, 200) : "";
  const mode = body.mode === "ambulance" ? "ambulance" : "accessibility";
  const needs = Array.isArray(body.needs) ? body.needs.filter((item) => typeof item === "string") : [];
  if (!origin || !destination) return Response.json({ error: "Origin and destination are required." }, { status: 400 });
  if ((body.originCoordinates != null && !validCoordinatePair(body.originCoordinates)) ||
      (body.destinationCoordinates != null && !validCoordinatePair(body.destinationCoordinates))) {
    return Response.json({ error: "Coordinates must be valid latitude/longitude pairs." }, { status: 400 });
  }

  const hospital = hospitals.find((item) => item.name.toLowerCase() === destination.toLowerCase());
  let originCoordinates;
  try {
    originCoordinates = validCoordinatePair(body.originCoordinates)
      ? [Number(body.originCoordinates[1]), Number(body.originCoordinates[0])]
      : await geocode(origin);
    const destinationCoordinates = validCoordinatePair(body.destinationCoordinates)
      ? [Number(body.destinationCoordinates[1]), Number(body.destinationCoordinates[0])]
      : hospital
        ? [hospital.lng, hospital.lat]
        : await geocode(destination);

    if (mode === "ambulance" && process.env.MAPBOX_ACCESS_TOKEN) {
      const coordinates = [originCoordinates, destinationCoordinates].map((point) => point.join(",")).join(";");
      const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}`);
      url.searchParams.set("alternatives", "true");
      url.searchParams.set("overview", "full");
      url.searchParams.set("geometries", "geojson");
      url.searchParams.set("steps", "true");
      url.searchParams.set("access_token", process.env.MAPBOX_ACCESS_TOKEN);
      const alternatives = mapboxRoutes(await fetchJson(url));
      if (alternatives.length) return Response.json({
        source: "mapbox-driving-traffic",
        mock: false,
        mode,
        alternatives,
        ...alternatives[0],
        warnings: ["Traffic-based ETA is an estimate; emergency services may need different routing."],
      });
    }

    if (mode === "accessibility" && process.env.OPENROUTESERVICE_API_KEY) {
      const data = await fetchJson("https://api.openrouteservice.org/v2/directions/wheelchair/geojson", {
        method: "POST",
        headers: { Authorization: process.env.OPENROUTESERVICE_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: [originCoordinates, destinationCoordinates],
          instructions: true,
          options: needs.some((item) => item === "Avoid steps" || item === "Avoid stairs")
            ? { avoid_features: ["steps"] }
            : undefined,
        }),
      });
      const feature = data.features?.[0];
      if (feature) {
        const summary = feature.properties?.summary || {};
        const route = {
          distance: Number((summary.distance / 1000).toFixed(1)),
          duration: Math.round(summary.duration / 60),
          coordinates: feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          steps: feature.properties?.segments?.flatMap((segment) => segment.steps || []).map((step) => step.instruction).filter(Boolean),
        };
        return Response.json({
          source: "openrouteservice-wheelchair",
          mock: false,
          mode,
          alternatives: [route],
          ...route,
          warnings: [
            "Wheelchair routing relies on available map data; confirm step-free entrances and temporary closures.",
            ...(needs.includes("Avoid high-traffic roads") ? ["Live traffic avoidance is unavailable in wheelchair mode."] : []),
            ...(needs.includes("Prefer smooth roads") ? ["Smooth-surface preferences are not guaranteed by map tagging."] : []),
          ],
        });
      }
    }

    const coordinates = [originCoordinates, destinationCoordinates].map((point) => point.join(",")).join(";");
    const url = new URL(`https://router.project-osrm.org/route/v1/driving/${coordinates}`);
    url.searchParams.set("alternatives", "true");
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("steps", "true");
    const data = await fetchJson(url);
    const alternatives = (data.routes || []).map((route) => ({
      distance: Number((route.distance / 1000).toFixed(1)),
      duration: Math.round(route.duration / 60),
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      steps: route.legs?.flatMap((leg) => leg.steps || []).map((step) => step.name).filter(Boolean),
    }));
    if (alternatives.length) return Response.json({
      source: "osrm",
      mock: false,
      mode,
      alternatives,
      ...alternatives[0],
      warnings: mode === "ambulance"
        ? ["OSRM does not include live traffic; verify conditions with emergency services."]
        : ["OSRM driving route is not wheelchair-aware; use only as a map preview."],
    });
  } catch (error) {
    console.error("Could not calculate live hospital route", error);
  }

  const demoHospital = hospital || hospitals[0];
  return Response.json({
    source: "seeded-demo",
    mock: true,
    mode,
    distance: "6.8",
    duration: "18",
    alternatives: [],
    steps: ["Live geocoding or routing is unavailable.", "Do not use this sample route for emergency navigation."],
    warnings: ["Demo-only route; not navigable directions.", "Call emergency services for urgent care.", "Confirm step-free entrance and current hospital availability directly."],
    coordinates: [[demoHospital.lat + 0.045, demoHospital.lng + 0.02], [demoHospital.lat, demoHospital.lng]],
  });
}

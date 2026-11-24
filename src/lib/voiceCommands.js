export const VOICE_SERVICE_ROUTES = [
  {
    id: "beds",
    label: "Bed Availability & Hospital Search",
    path: "/beds",
    keywords: ["bed", "beds", "bed availability", "hospital", "hospitals", "icu", "oxygen", "ventilator", "pediatric", "अस्पताल", "बेड"],
    example: "Find ICU beds in Delhi",
  },
  {
    id: "route",
    label: "Accessible Hospital Route",
    path: "/route",
    keywords: ["route", "directions", "navigate", "map", "wheelchair route", "accessible route", "nearby hospitals", "रास्ता", "मार्ग"],
    example: "Route to AIIMS New Delhi",
  },
  {
    id: "schemes",
    label: "Government Health Schemes",
    path: "/schemes",
    keywords: ["scheme", "schemes", "pmjay", "pm-jay", "ayushman", "myscheme", "subsidy", "eligibility", "yojana", "योजना"],
    example: "Open health schemes",
  },
  {
    id: "records",
    label: "My Health Reports",
    path: "/records",
    keywords: ["my reports", "reports", "records", "medical records", "health records", "lab report", "रिपोर्ट"],
    example: "Show my reports",
  },
  {
    id: "records-upload",
    label: "QR Reports & Upload",
    path: "/records/upload",
    keywords: ["upload report", "qr report", "qr reports", "add report", "new report", "generate qr", "रिपोर्ट अपलोड"],
    example: "Upload QR report",
  },
  {
    id: "appointments",
    label: "Appointments",
    path: "/appointments",
    keywords: ["appointment", "appointments", "book appointment", "schedule visit", "opd", "अपॉइंटमेंट"],
    example: "Open appointments",
  },
  {
    id: "billing",
    label: "Care Wallet & Billing",
    path: "/billing",
    keywords: ["billing", "care wallet", "wallet", "bill", "bills", "invoice", "invoices", "payment", "pay bill", "बिल", "केयर वॉलेट"],
    example: "Open Care Wallet",
  },
  {
    id: "consult",
    label: "Teleconsult",
    path: "/consult",
    keywords: ["teleconsult", "consult", "consultation", "doctor", "video call", "talk to doctor", "डॉक्टर", "टेलीकंसल्ट"],
    example: "Start teleconsult",
  },
  {
    id: "sos",
    label: "SOS & Emergency Profile",
    path: "/sos",
    keywords: ["sos", "emergency", "ambulance", "urgent help", "emergency card", "इमरजेंसी", "आपातकाल", "एम्बुलेंस"],
    example: "Open SOS emergency",
  },
  {
    id: "patient",
    label: "Patient Health Hub",
    path: "/patient",
    keywords: ["patient hub", "patient dashboard", "my dashboard", "medical history", "saved hospitals", "मरीज डैशबोर्ड"],
    example: "Open patient hub",
  },
  {
    id: "abdm",
    label: "ABDM / ABHA & KYC",
    path: "/abdm",
    keywords: ["abdm", "abha", "health id", "digital mission", "aadhaar", "aadhar", "face verification", "kyc"],
    example: "Open ABDM ABHA",
  },
  {
    id: "blockchain",
    label: "Blockchain Verification",
    path: "/blockchain",
    keywords: ["blockchain", "verify hash", "trust seal", "ब्लॉकचेन"],
    example: "Open blockchain verification",
  },
  {
    id: "auth",
    label: "Account & Sign In",
    path: "/auth",
    keywords: ["account", "profile", "sign in", "login", "register", "खाता"],
    example: "Open account",
  },
  {
    id: "home",
    label: "Home",
    path: "/",
    keywords: ["home", "main page", "start page", "dashboard", "होम"],
    example: "Go home",
  },
];

const KNOWN_CITIES = [
  { pattern: /\b(new delhi|delhi|दिल्ली)\b/i, value: "Delhi" },
  { pattern: /\b(mumbai|bombay|मुंबई)\b/i, value: "Mumbai" },
  { pattern: /\b(chennai|madras|चेन्नई)\b/i, value: "Chennai" },
  { pattern: /\b(bengaluru|bangalore|बेंगलुरु)\b/i, value: "Bengaluru" },
  { pattern: /\b(gurugram|gurgaon|गुरुग्राम)\b/i, value: "Gurugram" },
  { pattern: /\b(chandigarh|चंडीगढ़)\b/i, value: "Chandigarh" },
  { pattern: /\b(ahmedabad|अहमदाबाद)\b/i, value: "Ahmedabad" },
  { pattern: /\b(pune|पुणे)\b/i, value: "Pune" },
  { pattern: /\b(hyderabad|हैदराबाद)\b/i, value: "Hyderabad" },
  { pattern: /\b(kolkata|कलकत्ता|कोलकाता)\b/i, value: "Kolkata" },
  { pattern: /\b(lucknow|लखनऊ)\b/i, value: "Lucknow" },
  { pattern: /\b(jaipur|जयपुर)\b/i, value: "Jaipur" },
];

const KNOWN_HOSPITAL_ALIASES = [
  { pattern: /\b(aiims|all india institute)\b/i, query: "AIIMS", destination: "AIIMS New Delhi" },
  { pattern: /\b(safdarjung|सफदरजंग)\b/i, query: "Safdarjung", destination: "Safdarjung Hospital" },
  { pattern: /\b(fortis)\b/i, query: "Fortis", destination: "Fortis Memorial Research Institute" },
  { pattern: /\b(apollo)\b/i, query: "Apollo", destination: "Apollo Hospitals Chennai" },
  { pattern: /\b(kilpauk)\b/i, query: "Kilpauk", destination: "Government Kilpauk Medical College" },
  { pattern: /\b(nimhans)\b/i, query: "NIMHANS", destination: "NIMHANS" },
  { pattern: /\b(manipal)\b/i, query: "Manipal", destination: "Manipal Hospital Bengaluru" },
  { pattern: /\b(pgimer|pgi)\b/i, query: "PGIMER", destination: "PGIMER Chandigarh" },
  { pattern: /\b(civil hospital)\b/i, query: "Civil Hospital", destination: "Civil Hospital Ahmedabad" },
  { pattern: /\b(kem)\b/i, query: "KEM", destination: "KEM Hospital Mumbai" },
  { pattern: /\b(ruby hall)\b/i, query: "Ruby Hall", destination: "Ruby Hall Clinic" },
];

function extractCity(text) {
  for (const entry of KNOWN_CITIES) {
    if (entry.pattern.test(text)) {
      return entry.value;
    }
  }
  const inMatch = text.match(/\b(?:in|near|around|at)\s+([a-z][a-z\s]{2,24})$/i);
  if (inMatch) {
    const candidate = inMatch[1]
      .replace(/\b(hospitals?|beds?|icu|oxygen|ventilator|pediatric|me|please)\b/gi, "")
      .trim();
    if (candidate.length >= 3) {
      return candidate.replace(/\b\w/g, (ch) => ch.toUpperCase());
    }
  }
  return "";
}

function buildBedsUrl({ query = "", city = "", filters = {} }) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (city) params.set("city", city);
  if (filters.icu) params.set("icu", "1");
  if (filters.oxygen) params.set("oxygen", "1");
  if (filters.ventilator) params.set("ventilator", "1");
  if (filters.pediatric) params.set("pediatric", "1");
  if (filters.price) params.set("price", filters.price);
  const qs = params.toString();
  return qs ? `/beds?${qs}` : "/beds";
}

function cleanHospitalQuery(rawText, city) {
  let cleaned = rawText
    .replace(/\b(please|can you|could you|i want to|i need to|show me|find me|search for|search|find|show|open|go to|look up|check|get|list|all)\b/gi, " ")
    .replace(/\b(hospitals?|clinics?|medical centers?|beds?|bed availability|availability|available|with|near me|nearby|in|at|near|around|for)\b/gi, " ")
    .replace(/\b(icu|intensive care|oxygen|ventilator|pediatric|child|government|govt|sarkari|private)\b/gi, " ")
    .replace(/[?!.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (city) {
    const cityRegex = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    cleaned = cleaned.replace(cityRegex, "").replace(/\s+/g, " ").trim();
  }
  return cleaned;
}

export function parseVoiceCommand(rawTranscript) {
  const transcript = String(rawTranscript || "").trim();
  const normalized = transcript.toLowerCase();

  if (!normalized) {
    return {
      type: "unknown",
      transcript,
      spokenSummary: "I did not catch that. Please try speaking a service or hospital name.",
    };
  }

  // 1. Filter reset
  if (/\b(clear|reset)\s+(all\s+)?(filters?|search|hospitals?)\b/i.test(normalized)) {
    return {
      type: "clear_filters",
      path: "/beds",
      url: "/beds",
      transcript,
      spokenSummary: "Cleared hospital search filters.",
    };
  }

  // 2. Route / directions to hospital
  const wantsRoute = /\b(route|directions?|navigate|way to|how to reach|accessible route|रास्ता|मार्ग)\b/i.test(normalized);
  const wantsNearbyRoute = /\bnearby hospitals?\b/i.test(normalized);
  if (wantsRoute || wantsNearbyRoute) {
    const knownHospital = KNOWN_HOSPITAL_ALIASES.find((item) => item.pattern.test(normalized));
    let destination = knownHospital?.destination || "";
    if (!destination && !wantsNearbyRoute) {
      const destMatch = transcript.match(/\b(?:to|for|toward|towards)\s+(.+)$/i);
      if (destMatch?.[1]) {
        destination = destMatch[1].replace(/[?!.,]+$/g, "").trim();
      }
    }
    const params = new URLSearchParams();
    if (destination) params.set("destination", destination);
    if (wantsNearbyRoute) params.set("action", "nearby");
    const qs = params.toString();
    const url = qs ? `/route?${qs}` : "/route";
    return {
      type: "route_hospital",
      path: "/route",
      url,
      destination,
      action: wantsNearbyRoute ? "nearby" : "plan",
      transcript,
      spokenSummary: destination
        ? `Planning accessible route to ${destination}.`
        : wantsNearbyRoute
          ? "Opening Accessible Route to find nearby hospitals."
          : "Opening Accessible Hospital Routing.",
    };
  }

  // 3. Hospital & Bed Search intent
  const knownHospital = KNOWN_HOSPITAL_ALIASES.find((item) => item.pattern.test(normalized));
  const city = extractCity(transcript);
  const filters = {
    icu: /\b(icu|intensive care)\b/i.test(normalized),
    oxygen: /\b(oxygen)\b/i.test(normalized),
    ventilator: /\b(ventilator|vent)\b/i.test(normalized),
    pediatric: /\b(pediatric|paediatric|picu|child)\b/i.test(normalized),
    price: /\b(government|govt|sarkari)\b/i.test(normalized)
      ? "Government"
      : /\b(private)\b/i.test(normalized)
        ? "Private"
        : "",
  };
  const hasBedFilter = filters.icu || filters.oxygen || filters.ventilator || filters.pediatric || Boolean(filters.price);
  const mentionsHospitalOrBed = /\b(hospitals?|beds?|bed availability|clinic|medical center|अस्पताल|बेड)\b/i.test(normalized);
  const mentionsOtherService = /\b(scheme|schemes|pmjay|ayushman|report|reports|record|records|upload|qr|appointment|wallet|billing|invoice|teleconsult|consult|doctor|sos|emergency|ambulance|abdm|abha|blockchain|account|login)\b/i.test(normalized);

  if ((mentionsHospitalOrBed || knownHospital || hasBedFilter) && !(mentionsOtherService && !mentionsHospitalOrBed && !knownHospital)) {
    const query = knownHospital?.query || cleanHospitalQuery(transcript, city);
    const hasSearchCriteria = Boolean(query || city || hasBedFilter);
    const url = buildBedsUrl({ query, city, filters });
    const parts = [];
    if (filters.icu) parts.push("ICU");
    if (filters.oxygen) parts.push("Oxygen");
    if (filters.ventilator) parts.push("Ventilator");
    if (filters.pediatric) parts.push("Pediatric");
    if (filters.price) parts.push(filters.price);
    if (query) parts.push(query);
    if (city) parts.push(`in ${city}`);

    return {
      type: hasSearchCriteria ? "search_hospitals" : "navigate",
      path: "/beds",
      url,
      label: "Bed Availability & Hospital Search",
      query,
      city,
      filters,
      transcript,
      spokenSummary: hasSearchCriteria
        ? `Searching hospitals for ${parts.join(" ")}.`
        : "Opening Hospital Bed Availability.",
    };
  }

  // 4. General Health Service Navigation
  // Sort keyword checks so more specific multi-word phrases (e.g. "upload report", "my reports") match first
  const priorityOrder = [
    "records-upload",
    "records",
    "billing",
    "schemes",
    "appointments",
    "consult",
    "sos",
    "abdm",
    "blockchain",
    "auth",
    "route",
    "beds",
    "home",
  ];

  for (const id of priorityOrder) {
    const service = VOICE_SERVICE_ROUTES.find((item) => item.id === id);
    if (!service) continue;
    const matched = service.keywords.some((kw) => {
      if (/[^\x00-\x7F]/.test(kw)) {
        return normalized.includes(kw.toLowerCase());
      }
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escaped}\\b`, "i").test(normalized);
    });
    if (matched) {
      return {
        type: "navigate",
        path: service.path,
        url: service.path,
        label: service.label,
        transcript,
        spokenSummary: `Opening ${service.label}.`,
      };
    }
  }

  // 5. Fallback: if user says "search <something>" or "find <something>", search hospitals
  const genericSearch = transcript.match(/^(?:search|find|look for)\s+(.+)$/i);
  if (genericSearch?.[1]) {
    const query = cleanHospitalQuery(genericSearch[1], city);
    const url = buildBedsUrl({ query: query || genericSearch[1].trim(), city, filters });
    return {
      type: "search_hospitals",
      path: "/beds",
      url,
      label: "Hospital Search",
      query: query || genericSearch[1].trim(),
      city,
      filters,
      transcript,
      spokenSummary: `Searching hospitals for ${query || genericSearch[1].trim()}.`,
    };
  }

  return {
    type: "unknown",
    transcript,
    spokenSummary: `Command "${transcript}" was not recognized. Try "Open Care Wallet", "Show schemes", or "Find ICU beds in Delhi".`,
  };
}

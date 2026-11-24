export const DEFAULT_SERVICE_CATALOG = [
  {
    name: "Cardiology consultation",
    descriptionEn: "Specialist heart check-up and treatment plan with a cardiologist.",
    descriptionHi: "हृदय रोग विशेषज्ञ द्वारा जांच और उपचार योजना।",
    gstRate: 0,
    category: "clinical",
  },
  {
    name: "Pediatric consultation",
    descriptionEn: "Doctor check-up for infants, children, and adolescents.",
    descriptionHi: "शिशुओं और बच्चों के लिए बाल रोग विशेषज्ञ परामर्श।",
    gstRate: 0,
    category: "clinical",
  },
  {
    name: "Neurology consultation",
    descriptionEn: "Specialist evaluation for brain, spine, and nerve symptoms.",
    descriptionHi: "मस्तिष्क और नसों से जुड़े लक्षणों की विशेषज्ञ जांच।",
    gstRate: 0,
    category: "clinical",
  },
  {
    name: "General medicine consultation",
    descriptionEn: "Primary physician visit for fever, infections, and routine care.",
    descriptionHi: "सामान्य बुखार, संक्रमण और प्राथमिक स्वास्थ्य जांच।",
    gstRate: 0,
    category: "clinical",
  },
  {
    name: "Orthopedic consultation",
    descriptionEn: "Bone, joint, and mobility specialist consultation.",
    descriptionHi: "हड्डी, जोड़ और चलने-फिरने की समस्या का परामर्श।",
    gstRate: 0,
    category: "clinical",
  },
  {
    name: "ECG and laboratory tests",
    descriptionEn: "Heart rhythm tracing and diagnostic blood/urine lab panels.",
    descriptionHi: "हृदय की ईसीजी जांच और रक्त/मूत्र प्रयोगशाला परीक्षण।",
    gstRate: 0,
    category: "diagnostics",
  },
  {
    name: "Blood investigations",
    descriptionEn: "Routine blood panel to check hemoglobin, sugar, and organ markers.",
    descriptionHi: "हीमोग्लोबिन, शुगर और अंगों की जांच के लिए रक्त परीक्षण।",
    gstRate: 0,
    category: "diagnostics",
  },
  {
    name: "MRI scan",
    descriptionEn: "Detailed magnetic imaging scan of internal organs or brain.",
    descriptionHi: "मस्तिष्क या आंतरिक अंगों की विस्तृत एमआरआई जांच।",
    gstRate: 0,
    category: "diagnostics",
  },
  {
    name: "X-ray",
    descriptionEn: "Quick imaging scan for bones, chest, or joints.",
    descriptionHi: "हड्डियों, छाती या जोड़ों का एक्स-रे परीक्षण।",
    gstRate: 0,
    category: "diagnostics",
  },
  {
    name: "Physiotherapy session",
    descriptionEn: "Guided rehabilitation exercises to restore movement and strength.",
    descriptionHi: "शक्ति और गति वापस लाने के लिए फिजियोथेरेपी सत्र।",
    gstRate: 0,
    category: "clinical",
  },
  {
    name: "Pharmacy",
    descriptionEn: "Prescribed hospital medicines dispensed for treatment.",
    descriptionHi: "उपचार के लिए निर्धारित अस्पताल की दवाइयां।",
    gstRate: 12,
    category: "pharmacy",
  },
  {
    name: "Medicines",
    descriptionEn: "Prescribed tablets, syrups, or medical supplies.",
    descriptionHi: "डॉक्टर द्वारा लिखी गई दवाइयां और चिकित्सा सामग्री।",
    gstRate: 12,
    category: "pharmacy",
  },
];

export function explainLineItem(description, catalog = DEFAULT_SERVICE_CATALOG, lang = "en") {
  const needle = String(description || "").trim().toLowerCase();
  if (!needle) return "";
  const exact = catalog.find((entry) => entry.name.toLowerCase() === needle);
  const partial = exact || catalog.find((entry) => needle.includes(entry.name.toLowerCase()) || entry.name.toLowerCase().includes(needle));
  if (!partial) return description;
  return lang === "hi" ? (partial.descriptionHi || partial.descriptionEn) : partial.descriptionEn;
}

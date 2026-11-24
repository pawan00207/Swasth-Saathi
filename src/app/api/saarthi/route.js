export async function POST(request) {
  const { message } = await request.json();
  if (!message || typeof message !== "string") {
    return Response.json({ error: "Please enter a healthcare question." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({
      reply: "Saarthi AI is in demo mode. Add GOOGLE_GEMINI_API_KEY to enable live AI answers. For urgent medical concerns, contact emergency services.",
    });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "You are Saarthi AI for Swasth Saathi, an Indian accessible healthcare platform. Give concise, practical, inclusive information about schemes, disability support, hospital access, teleconsultation and medical reports. Never diagnose or prescribe. Direct emergencies to 112 or 108.",
          }],
        },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini API error", data.error?.message || response.status);
      const lowerMessage = String(data.error?.message || "").toLowerCase();
      const guidance = lowerMessage.includes("billing")
        ? "The connected Gemini project needs billing enabled before live answers can be generated."
        : "The connected Gemini API could not answer this request.";
      return Response.json({
        reply: `Saarthi AI is using fallback guidance. ${guidance} For scheme or bed questions, use the matching page. For urgent concerns, contact 112 or 108.`,
        source: "demo-fallback",
      });
    }
    const reply = data.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("\n");
    return Response.json({
      reply: reply || "I could not generate a response. Please rephrase your question.",
    });
  } catch (error) {
    console.error("Saarthi AI request failed", error);
    return Response.json({ error: "Saarthi AI is temporarily unavailable." }, { status: 502 });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Please enter a valid healthcare question." }, { status: 400 });
  }

  const message = body?.message;
  if (!message || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Please enter a healthcare question." }, { status: 400 });
  }

  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
  const groqKey = (process.env.GROQ_API_KEY || "").trim();
  const contents = message.trim().slice(0, 2000);
  const systemInstruction = "You are Saarthi AI for Swasth Saathi, an Indian accessible healthcare platform integrated with ABDM/ABHA, PM-JAY schemes, Care Wallet billing, hospital bed availability, teleconsultation, and SOS emergency services. Give concise, practical, inclusive answers (under 150 words). Never diagnose or prescribe medication. Direct medical emergencies to 112 or 108.";

  if (geminiKey) {
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ parts: [{ text: contents }] }],
          }),
        },
      );
      const result = response.ok ? await response.json() : {};
      // Honor a provider safety decision without retrying the same input elsewhere.
      if (result.promptFeedback?.blockReason ||
          result.candidates?.some(({ finishReason }) => ["SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"].includes(finishReason))) {
        return Response.json({ error: "Saarthi AI could not answer that request. Try asking about a service." }, { status: 422 });
      }
      const reply = result.candidates?.[0]?.content?.parts
        ?.filter((part) => !part.thought)
        .map((part) => part.text || "").join("").trim();
      if (reply) return Response.json({ reply, model, source: "live-gemini" });
    } catch {
      console.warn("Saarthi AI: Gemini request failed.");
    }
  }

  if (groqKey) {
    const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: contents },
          ],
          max_completion_tokens: 1000,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        const reply = result.choices?.[0]?.message?.content?.trim();
        if (reply) return Response.json({ reply, model, source: "live-groq" });
      }
    } catch {
      console.warn("Saarthi AI: Groq request failed.");
    }
  }

  return Response.json(
    { error: "Saarthi AI is unavailable right now. Try again shortly or open the schemes, beds, or ABDM page." },
    { status: geminiKey || groqKey ? 502 : 503 },
  );
}

import { GoogleGenAI } from "@google/genai";

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

  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return Response.json(
      { error: "Gemini API key is not configured on the server yet. Add GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY in Settings > Secrets." },
      { status: 503 },
    );
  }

  const configuredModel = (process.env.GEMINI_MODEL || "").trim();
  const model = configuredModel && !configuredModel.startsWith("gemini-2.0") && !configuredModel.startsWith("gemini-1.5")
    ? configuredModel
    : "gemini-4-hydrogen";

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const response = await ai.models.generateContent({
      model,
      contents: message.trim().slice(0, 2000),
      config: {
        systemInstruction:
          "You are Saarthi AI for Swasth Saathi, an Indian accessible healthcare platform integrated with ABDM/ABHA, PM-JAY schemes, Care Wallet billing, hospital bed availability, teleconsultation, and SOS emergency services. Give concise, practical, inclusive answers (under 150 words). Never diagnose or prescribe medication. Direct medical emergencies to 112 or 108.",
      },
    });

    const reply = response.text?.trim();
    if (!reply) {
      return Response.json({ error: "No response was returned by Gemini." }, { status: 502 });
    }

    return Response.json({ reply, model, source: "live-gemini" });
  } catch (error) {
    console.error("Saarthi AI request failed", error?.message || error);
    const status = Number(error?.status) === 403 || Number(error?.status) === 400 ? 502 : 502;
    return Response.json(
      { error: "Saarthi AI could not reach Gemini right now. Please try again shortly or use the scheme, bed, or ABDM pages." },
      { status },
    );
  }
}

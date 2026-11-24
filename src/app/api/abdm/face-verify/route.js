import { randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { evaluateSelfieBiometrics, parseSelfieDataUrl } from "../../../../lib/abdm/verification";

export const dynamic = "force-dynamic";

async function runGeminiFacePresenceCheck(base64, mimeType) {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64, mimeType } },
            {
              text: "Analyze this selfie for KYC liveness verification. Reply strictly as compact JSON with keys: faceDetected (boolean), clearLighting (boolean), singlePerson (boolean), confidence (number 0-100), summary (short string under 12 words).",
            },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });
    const text = response?.text || "";
    const parsed = JSON.parse(text);
    if (typeof parsed?.faceDetected === "boolean") {
      return {
        provider: "gemini-vision-kyc",
        faceDetected: parsed.faceDetected,
        clearLighting: Boolean(parsed.clearLighting),
        singlePerson: parsed.singlePerson !== false,
        confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 92,
        summary: String(parsed.summary || "Live face detected"),
      };
    }
  } catch {
    // Fall back to deterministic server-side biometric analyzer
  }
  return null;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const abhaIdentifier = typeof body?.abhaIdentifier === "string" ? body.abhaIdentifier.trim().slice(0, 100) : "";
  const parsedImage = parseSelfieDataUrl(body?.imageDataUrl);
  if (!parsedImage.ok) {
    return Response.json({ verified: false, error: parsedImage.reason }, { status: 400 });
  }

  const bio = evaluateSelfieBiometrics(parsedImage.buffer, abhaIdentifier);
  if (!bio.livenessPassed) {
    return Response.json(
      {
        verified: false,
        livenessStatus: "LOW_DETAIL_FRAME",
        confidenceScore: bio.confidenceScore,
        error: "Image frame lacks sufficient lighting or detail. Capture a well-lit live selfie.",
      },
      { status: 422 },
    );
  }

  const aiCheck = await runGeminiFacePresenceCheck(parsedImage.base64, parsedImage.mimeType);
  if (aiCheck && !aiCheck.faceDetected) {
    return Response.json(
      {
        verified: false,
        livenessStatus: "NO_FACE_DETECTED",
        confidenceScore: aiCheck.confidence,
        error: `Face verification could not detect a clear face: ${aiCheck.summary}`,
      },
      { status: 422 },
    );
  }

  const finalConfidence = aiCheck
    ? Number(Math.max(bio.confidenceScore, Math.min(99.5, aiCheck.confidence)).toFixed(1))
    : bio.confidenceScore;

  return Response.json(
    {
      verified: true,
      verificationId: `FACE-${randomUUID().slice(0, 8).toUpperCase()}`,
      abhaIdentifier: abhaIdentifier || "linked-abha",
      livenessStatus: "LIVE_FACE_VERIFIED",
      confidenceScore: finalConfidence,
      biometricDigest: bio.biometricHash,
      verifierEngine: aiCheck ? aiCheck.provider : "server-biometric-liveness",
      summary: aiCheck?.summary || "Live facial liveness & lighting check passed",
      verifiedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

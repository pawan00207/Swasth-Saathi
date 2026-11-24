import { sign } from "node:crypto";
import { requireUser } from "../../../../lib/api-auth";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;

  const appId = process.env.JAAS_APP_ID;
  const keyId = process.env.JAAS_API_KEY_ID;
  const privateKey = process.env.JAAS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !keyId || !privateKey) {
    return Response.json({ error: "Private JaaS room access is not configured." }, { status: 503 });
  }

  const { appointmentId } = await request.json();
  if (!appointmentId) return Response.json({ error: "Appointment ID is required." }, { status: 400 });
  const appointment = await context.prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { doctor: { select: { userId: true } } },
  });
  if (!appointment || !appointment.roomName || appointment.status === "cancelled") {
    return Response.json({ error: "Active appointment not found." }, { status: 404 });
  }

  let moderator = false;
  if (appointment.patientId !== context.user.id) {
    if (appointment.doctor?.userId !== context.user.id || context.profile.role !== "doctor") {
      return Response.json({ error: "You are not a participant in this appointment." }, { status: 403 });
    }
    moderator = true;
  }

  const now = Math.floor(Date.now() / 1000);
  const startsAt = Math.floor(appointment.startsAt.getTime() / 1000);
  if (now < startsAt - 3600 || now > startsAt + 7200) {
    return Response.json({ error: "The secure room is available one hour before through two hours after the appointment." }, { status: 403 });
  }
  const header = encode({ alg: "RS256", typ: "JWT", kid: keyId.includes("/") ? keyId : `${appId}/${keyId}` });
  const payload = encode({
    aud: "jitsi",
    iss: "chat",
    sub: appId,
    room: appointment.roomName,
    iat: now,
    nbf: now - 5,
    exp: now + 900,
    context: {
      user: {
        id: context.user.id,
        name: context.user.user_metadata?.display_name || context.user.email || "Appointment participant",
        email: context.user.email,
        moderator,
      },
      features: {
        livestreaming: false,
        recording: false,
        transcription: false,
        "outbound-call": false,
        "sip-outbound-call": false,
      },
    },
  });
  const signingInput = `${header}.${payload}`;
  let signature;
  try {
    signature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
  } catch (signError) {
    console.error("Could not sign JaaS room token", signError);
    return Response.json({ error: "Secure room token generation failed." }, { status: 500 });
  }
  return Response.json({ appId, room: appointment.roomName, token: `${signingInput}.${signature}` }, {
    headers: { "Cache-Control": "no-store" },
  });
}

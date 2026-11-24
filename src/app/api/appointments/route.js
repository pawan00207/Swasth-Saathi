import { randomUUID } from "node:crypto";
import { requireUser } from "../../../lib/api-auth";
import { publishRealtime } from "../../../lib/realtime-server";

function mapAppointment(appointment) {
  return {
    ...appointment,
    patient_id: appointment.patientId,
    patient_name: appointment.patientName,
    doctor_id: appointment.doctorId,
    starts_at: appointment.startsAt.toISOString(),
    room_name: appointment.roomName,
    doctors: appointment.doctor ? {
      name: appointment.doctor.name,
      speciality: appointment.doctor.speciality,
    } : null,
  };
}

export async function GET(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const where = context.profile.role === "doctor"
    ? { doctor: { userId: context.user.id } }
    : context.profile.role === "hospital_admin" && context.profile.hospitalId
      ? { hospitalId: context.profile.hospitalId }
      : { patientId: context.user.id };
  const appointments = await context.prisma.appointment.findMany({
    where,
    include: { doctor: { select: { name: true, speciality: true } } },
    orderBy: { startsAt: "desc" },
  });
  return Response.json({ appointments: appointments.map(mapAppointment) });
}

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const body = await request.json();
  const startsAt = new Date(body.startsAt);
  if (
    typeof body.doctorId !== "string"
    || Number.isNaN(startsAt.getTime())
    || startsAt <= new Date()
    || !["video", "audio", "chat", "in_person"].includes(body.mode)
    || typeof body.patientName !== "string"
    || !body.patientName.trim()
  ) {
    return Response.json({ error: "Choose a doctor, future appointment time, mode, and patient name." }, { status: 400 });
  }
  const doctor = await context.prisma.doctor.findUnique({ where: { id: body.doctorId } });
  if (!doctor) return Response.json({ error: "Doctor is not available in the active directory." }, { status: 404 });
  const appointment = await context.prisma.appointment.create({
    data: {
      patientId: context.user.id,
      patientName: body.patientName.trim().slice(0, 120),
      doctorId: doctor.id,
      startsAt,
      mode: body.mode,
      status: "booked",
      roomName: `healthx-${randomUUID()}`,
      demo: doctor.demo,
    },
    include: { doctor: { select: { name: true, speciality: true } } },
  });
  const updatedAt = appointment.updatedAt.toISOString();
  await Promise.all([
    publishRealtime(`patient-appointments-${appointment.patientId}`, "updated", { appointmentId: appointment.id, status: appointment.status, updatedAt }),
    ...(doctor.userId ? [
      publishRealtime(`doctor-appointments-${doctor.userId}`, "updated", { appointmentId: appointment.id, status: appointment.status, updatedAt }),
    ] : []),
    publishRealtime(`appointment-${appointment.id}`, "updated", { appointmentId: appointment.id, status: appointment.status, updatedAt }),
  ]);
  return Response.json({ appointment: mapAppointment(appointment) }, { status: 201 });
}

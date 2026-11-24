import { requireUser } from "../../../../../lib/api-auth";
import { publishRealtime } from "../../../../../lib/realtime-server";

const allowedStatuses = ["confirmed", "completed", "cancelled"];

export async function PATCH(request, { params }) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const { status } = await request.json();
  if (!allowedStatuses.includes(status)) return Response.json({ error: "Invalid appointment status." }, { status: 400 });
  const appointment = await context.prisma.appointment.findUnique({
    where: { id: params.id },
    include: { doctor: { select: { userId: true } } },
  });
  if (!appointment) return Response.json({ error: "Appointment not found." }, { status: 404 });
  const isPatient = appointment.patientId === context.user.id;
  const isDoctor = appointment.doctor?.userId === context.user.id && context.profile.role === "doctor";
  if (!isPatient && !isDoctor) return Response.json({ error: "You cannot update this appointment." }, { status: 403 });
  if (isPatient && status !== "cancelled") return Response.json({ error: "Patients may only cancel their own appointments." }, { status: 403 });
  if (appointment.status === "completed" || appointment.status === "cancelled") {
    return Response.json({ error: "This appointment can no longer be changed." }, { status: 409 });
  }
  const updated = await context.prisma.appointment.update({
    where: { id: appointment.id },
    data: { status },
  });
  const updatedAt = updated.updatedAt.toISOString();
  await Promise.all([
    publishRealtime(`patient-appointments-${appointment.patientId}`, "updated", { appointmentId: updated.id, status: updated.status, updatedAt }),
    ...(appointment.doctor?.userId ? [
      publishRealtime(`doctor-appointments-${appointment.doctor.userId}`, "updated", { appointmentId: updated.id, status: updated.status, updatedAt }),
    ] : []),
    publishRealtime(`appointment-${updated.id}`, "updated", { appointmentId: updated.id, status: updated.status, updatedAt }),
  ]);
  return Response.json({ appointment: updated });
}

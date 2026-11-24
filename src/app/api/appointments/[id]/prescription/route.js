import { randomUUID } from "node:crypto";
import { requireUser } from "../../../../../lib/api-auth";
import { getSupabaseAdmin } from "../../../../../lib/supabase/server";

export async function POST(request, { params }) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "Prescription storage is not configured." }, { status: 503 });

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function" || file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "Upload a PDF prescription no larger than 10 MB." }, { status: 400 });
  }
  const appointment = await context.prisma.appointment.findUnique({
    where: { id: params.id },
    include: { doctor: { select: { userId: true, name: true } } },
  });
  if (!appointment || !appointment.doctorId) {
    return Response.json({ error: "Active appointment not found." }, { status: 404 });
  }
  if (appointment.status !== "completed") return Response.json({ error: "Prescriptions can be added after the appointment is completed." }, { status: 409 });
  if (appointment.doctor?.userId !== context.user.id || context.profile.role !== "doctor") {
    return Response.json({ error: "Only the assigned doctor can add a prescription." }, { status: 403 });
  }
  const storagePath = `${appointment.patientId}/${randomUUID()}.pdf`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: storageError } = await supabase.storage.from("medical-reports")
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  if (storageError) {
    console.error("Could not save prescription PDF", storageError);
    return Response.json({ error: "Could not save prescription PDF." }, { status: 500 });
  }

  try {
    await context.prisma.profile.upsert({
      where: { userId: appointment.patientId },
      create: { userId: appointment.patientId, displayName: appointment.patientName || "Patient" },
      update: {},
    });
    const report = await context.prisma.report.create({
      data: {
        ownerId: appointment.patientId,
        patientName: appointment.patientName || "Patient",
        reportType: "Prescription",
        reportDate: new Date(),
        doctorName: appointment.doctor.name,
        notes: `Prescription from appointment ${appointment.id}`,
        storagePath,
        mimeType: "application/pdf",
      },
      select: { id: true },
    });
    return Response.json({ reportId: report.id }, { status: 201 });
  } catch (reportError) {
    const { error: cleanupError } = await supabase.storage.from("medical-reports").remove([storagePath]);
    if (cleanupError) console.error("Could not remove orphaned prescription PDF", cleanupError);
    console.error("Could not save prescription metadata", reportError.name || "database error");
    return Response.json({ error: "Could not save prescription to the patient's reports." }, { status: 500 });
  }
}

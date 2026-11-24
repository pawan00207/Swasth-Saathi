import { requireUser } from "../../../../lib/api-auth";
import { normalizeLanguage } from "../../../../lib/i18n";
import { listSessionBedRequests } from "../../../../lib/hospital-inventory";

export const dynamic = "force-dynamic";

function sanitizeHospitalPreferenceList(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const id = typeof item.id === "string" ? item.id.trim().slice(0, 80) : "";
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 140) : "";
    const city = typeof item.city === "string" ? item.city.trim().slice(0, 80) : "";
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      city,
      addedAt: typeof item.addedAt === "string" ? item.addedAt.slice(0, 40) : new Date().toISOString(),
    });
    if (out.length >= 20) break;
  }
  return out;
}

function sanitizeAccessibilityNeeds(input) {
  const src = input && typeof input === "object" ? input : {};
  return {
    ramp: Boolean(src.ramp),
    elevator: Boolean(src.elevator),
    wheelchairEntrance: Boolean(src.wheelchairEntrance),
    accessibleParking: Boolean(src.accessibleParking),
  };
}

export async function GET(request) {
  const context = await requireUser(request, { allowSupabaseFallback: true });
  if (context.response) return context.response;

  const { user, profile, supabase, prisma } = context;
  const rawPrefs = user?.user_metadata?.patient_preferences || {};

  let reports = [];
  let bedRequests = [];
  let appointments = [];
  let sosEvents = [];
  let recentBills = [];
  let emergencyProfile = null;
  let savedSchemeIds = [];

  if (prisma) {
    try {
      const [dbReports, dbBeds, dbAppointments, dbSos, dbInvoices, dbEmergency, dbSavedSchemes] = await Promise.all([
        prisma.report.findMany({
          where: { ownerId: user.id },
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
        prisma.bedRequest.findMany({
          where: { userId: user.id },
          include: { hospital: { select: { id: true, name: true, city: true } } },
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
        prisma.appointment.findMany({
          where: { patientId: user.id },
          include: {
            doctor: { select: { name: true, speciality: true } },
            hospital: { select: { name: true, city: true } },
          },
          orderBy: { startsAt: "desc" },
          take: 25,
        }),
        prisma.sosEvent.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 15,
        }),
        prisma.invoice.findMany({
          where: { patientId: user.id },
          include: { hospital: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 15,
        }),
        prisma.emergencyProfile.findUnique({ where: { userId: user.id } }),
        prisma.savedScheme.findMany({ where: { userId: user.id }, select: { schemeId: true } }),
      ]);

      reports = dbReports.map((r) => ({
        id: r.id,
        patientName: r.patientName,
        reportType: r.reportType,
        reportDate: r.reportDate.toISOString().slice(0, 10),
        doctorName: r.doctorName || "",
        notes: r.notes || "",
        storagePath: r.storagePath,
        createdAt: r.createdAt.toISOString(),
        source: "supabase-vault",
      }));

      bedRequests = dbBeds.map((b) => ({
        id: b.id,
        hospitalId: b.hospitalId,
        hospitalName: b.hospital?.name || "Hospital",
        city: b.hospital?.city || "",
        bedType: b.bedType,
        urgency: b.urgency,
        status: b.status,
        patientName: b.patientName,
        createdAt: b.createdAt.toISOString(),
      }));

      appointments = dbAppointments.map((a) => ({
        id: a.id,
        doctorName: a.doctor?.name || "Teleconsult Specialist",
        speciality: a.doctor?.speciality || "General Medicine",
        hospitalName: a.hospital?.name || "",
        mode: a.mode,
        status: a.status,
        startsAt: a.startsAt.toISOString(),
      }));

      sosEvents = dbSos.map((s) => ({
        id: s.id,
        status: s.status,
        isDrill: s.isDrill,
        neededBedType: s.neededBedType,
        addressText: s.addressText || "",
        createdAt: s.createdAt.toISOString(),
      }));

      recentBills = dbInvoices.map((inv) => ({
        id: inv.id,
        billNumber: inv.billNumber,
        hospitalName: inv.hospital?.name || "Hospital",
        total: Number(inv.total),
        paymentStatus: inv.paymentStatus,
        paidAt: inv.paidAt?.toISOString() || null,
        createdAt: inv.createdAt.toISOString(),
      }));

      if (dbEmergency) {
        emergencyProfile = {
          fullName: dbEmergency.fullName,
          bloodGroup: dbEmergency.bloodGroup,
          allergies: dbEmergency.allergies,
          conditions: dbEmergency.conditions,
          medicines: dbEmergency.medicines,
        };
      }
      savedSchemeIds = dbSavedSchemes.map((s) => s.schemeId);
    } catch {
      // Fall back to Supabase HTTPS REST below when direct Postgres port is unreachable
    }
  }

  if (supabase && (reports.length === 0 || bedRequests.length === 0 || appointments.length === 0)) {
    const [sbReports, sbBeds, sbAppts, sbSos, sbBills, sbSaved] = await Promise.all([
      reports.length === 0
        ? supabase.from("reports").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(25)
        : Promise.resolve({ data: null }),
      bedRequests.length === 0
        ? supabase.from("bed_requests").select("*, hospitals(name, city)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(25)
        : Promise.resolve({ data: null }),
      appointments.length === 0
        ? supabase.from("appointments").select("*, doctors(name, speciality), hospitals(name, city)").eq("patient_id", user.id).order("starts_at", { ascending: false }).limit(25)
        : Promise.resolve({ data: null }),
      sosEvents.length === 0
        ? supabase.from("sos_events").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(15)
        : Promise.resolve({ data: null }),
      recentBills.length === 0
        ? supabase.from("bills").select("*, hospitals(name)").eq("patient_id", user.id).order("created_at", { ascending: false }).limit(15)
        : Promise.resolve({ data: null }),
      savedSchemeIds.length === 0
        ? supabase.from("saved_schemes").select("scheme_id").eq("user_id", user.id)
        : Promise.resolve({ data: null }),
    ]);

    if (Array.isArray(sbReports?.data) && sbReports.data.length > 0) {
      reports = sbReports.data.map((r) => ({
        id: r.id,
        patientName: r.patient_name,
        reportType: r.report_type,
        reportDate: String(r.report_date || r.created_at || "").slice(0, 10),
        doctorName: r.doctor_name || "",
        notes: r.notes || "",
        storagePath: r.storage_path || "",
        createdAt: r.created_at,
        source: "supabase-db",
      }));
    }

    if (Array.isArray(sbBeds?.data) && sbBeds.data.length > 0) {
      bedRequests = sbBeds.data.map((b) => ({
        id: b.id,
        hospitalId: b.hospital_id,
        hospitalName: b.hospitals?.name || "Hospital",
        city: b.hospitals?.city || "",
        bedType: b.bed_type,
        urgency: b.urgency,
        status: b.status,
        patientName: b.patient_name,
        createdAt: b.created_at,
      }));
    }

    if (Array.isArray(sbAppts?.data) && sbAppts.data.length > 0) {
      appointments = sbAppts.data.map((a) => ({
        id: a.id,
        doctorName: a.doctors?.name || "Teleconsult Specialist",
        speciality: a.doctors?.speciality || "General Medicine",
        hospitalName: a.hospitals?.name || "",
        mode: a.mode,
        status: a.status,
        startsAt: a.starts_at,
      }));
    }

    if (Array.isArray(sbSos?.data) && sbSos.data.length > 0) {
      sosEvents = sbSos.data.map((s) => ({
        id: s.id,
        status: s.status,
        isDrill: Boolean(s.is_drill),
        neededBedType: s.needed_bed_type || "ICU",
        addressText: s.address_text || "",
        createdAt: s.created_at,
      }));
    }

    if (Array.isArray(sbBills?.data) && sbBills.data.length > 0) {
      recentBills = sbBills.data.map((inv) => ({
        id: inv.id,
        billNumber: inv.bill_number,
        hospitalName: inv.hospitals?.name || "Hospital",
        total: Number(inv.total || 0),
        paymentStatus: inv.payment_status || "pending",
        paidAt: inv.paid_at || null,
        createdAt: inv.created_at,
      }));
    }

    if (Array.isArray(sbSaved?.data) && sbSaved.data.length > 0) {
      savedSchemeIds = sbSaved.data.map((s) => s.scheme_id);
    }
  }

  // Merge any recent session-created bed requests owned by this user
  const sessionBeds = listSessionBedRequests({ userId: user.id });
  for (const sb of sessionBeds) {
    if (!bedRequests.some((b) => b.id === sb.id)) {
      bedRequests.unshift({
        id: sb.id,
        hospitalId: sb.hospitalId,
        hospitalName: sb.hospital?.name || "Hospital",
        city: sb.hospital?.city || "",
        bedType: sb.bedType,
        urgency: sb.urgency,
        status: sb.status,
        patientName: sb.patientName,
        createdAt: sb.createdAt,
      });
    }
  }

  return Response.json(
    {
      patient: {
        userId: user.id,
        email: user.email || "",
        displayName: profile.displayName || user.user_metadata?.display_name || user.email || "Patient",
        emergencyContact: profile.emergencyContact || rawPrefs.emergencyContact || "",
        preferredLanguage: profile.preferredLanguage || rawPrefs.preferredLanguage || "en",
      },
      medicalHistory: {
        emergencyProfile: emergencyProfile || rawPrefs.emergencyMedicalSummary || null,
        reports,
        savedSchemeCount: savedSchemeIds.length,
        savedSchemeIds,
      },
      savedPreferences: {
        preferredCity: typeof rawPrefs.preferredCity === "string" ? rawPrefs.preferredCity : "",
        accessibilityNeeds: sanitizeAccessibilityNeeds(rawPrefs.accessibilityNeeds),
        savedHospitals: sanitizeHospitalPreferenceList(rawPrefs.savedHospitals),
      },
      serviceHistory: {
        bedRequests,
        appointments,
        sosEvents,
        recentBills,
      },
      dataSource: prisma ? "supabase+prisma" : "supabase-rest",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request) {
  const context = await requireUser(request, { allowSupabaseFallback: true });
  if (context.response) return context.response;

  const body = await request.json().catch(() => ({}));
  const existingPrefs = context.user?.user_metadata?.patient_preferences || {};

  const nextPrefs = {
    preferredCity: body.preferredCity !== undefined
      ? String(body.preferredCity || "").trim().slice(0, 80)
      : (existingPrefs.preferredCity || ""),
    accessibilityNeeds: body.accessibilityNeeds !== undefined
      ? sanitizeAccessibilityNeeds(body.accessibilityNeeds)
      : sanitizeAccessibilityNeeds(existingPrefs.accessibilityNeeds),
    savedHospitals: body.savedHospitals !== undefined
      ? sanitizeHospitalPreferenceList(body.savedHospitals)
      : sanitizeHospitalPreferenceList(existingPrefs.savedHospitals),
    preferredLanguage: body.preferredLanguage !== undefined
      ? normalizeLanguage(body.preferredLanguage)
      : (existingPrefs.preferredLanguage || context.profile.preferredLanguage || "en"),
    emergencyContact: body.emergencyContact !== undefined
      ? String(body.emergencyContact || "").trim().slice(0, 80)
      : (existingPrefs.emergencyContact || context.profile.emergencyContact || ""),
    updatedAt: new Date().toISOString(),
  };

  const displayName = body.displayName !== undefined
    ? String(body.displayName || "").trim().slice(0, 120)
    : context.profile.displayName;

  if (context.supabase?.auth?.admin) {
    const { error } = await context.supabase.auth.admin.updateUserById(context.user.id, {
      user_metadata: {
        ...(context.user.user_metadata || {}),
        display_name: displayName,
        patient_preferences: nextPrefs,
      },
    });
    if (error) {
      return Response.json({ error: "Could not save preferences to Supabase." }, { status: 502 });
    }
  }

  if (context.prisma) {
    await context.prisma.profile.update({
      where: { userId: context.user.id },
      data: {
        displayName: displayName || context.profile.displayName,
        emergencyContact: nextPrefs.emergencyContact || null,
        preferredLanguage: nextPrefs.preferredLanguage,
      },
    }).catch(() => {});
  }

  if (context.supabase) {
    await context.supabase
      .from("profiles")
      .upsert({
        id: context.user.id,
        display_name: displayName || context.profile.displayName || "",
        emergency_contact: nextPrefs.emergencyContact || null,
      }, { onConflict: "id" })
      .catch(() => {});
  }

  return Response.json({
    savedPreferences: {
      preferredCity: nextPrefs.preferredCity,
      accessibilityNeeds: nextPrefs.accessibilityNeeds,
      savedHospitals: nextPrefs.savedHospitals,
    },
    patient: {
      displayName,
      emergencyContact: nextPrefs.emergencyContact,
      preferredLanguage: nextPrefs.preferredLanguage,
    },
  });
}

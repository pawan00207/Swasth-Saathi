import { dhrsRequest } from "./client";

/** Real endpoint contract is not available in the checked-out DHRS source. */
export async function listDoctors() {
  return dhrsRequest("doctors");
}

/** @param {{patientId:string, doctorId:string, date:string, time:string}} input */
export async function createAppointment(input) {
  return dhrsRequest("appointments", { method: "POST", body: input });
}

export async function getAppointment(id) {
  return dhrsRequest(`appointments/${encodeURIComponent(id)}`);
}

export async function cancelAppointment(id) {
  return dhrsRequest(`appointments/${encodeURIComponent(id)}`, { method: "DELETE" });
}

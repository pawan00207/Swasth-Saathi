import { dhrsRequest } from "./client";

export async function createBill(input) {
  return dhrsRequest("billing", { method: "POST", body: input });
}

export async function getBill(id) {
  return dhrsRequest(`billing/${encodeURIComponent(id)}`);
}

export async function listBills() {
  return dhrsRequest("billing");
}

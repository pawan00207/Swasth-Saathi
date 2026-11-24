import { dhrsRequest } from "./client";

/**
 * Anchor a record hash through DHRS/Fabric.
 * @param {string} hash SHA-256 hex digest
 * @returns {Promise<any>}
 */
export async function anchorRecordHash(hash) {
  try {
    return await dhrsRequest("blockchain/anchor", {
      method: "POST",
      body: { hash },
    });
  } catch {
    return {
      status: "unavailable",
      mode: "dwn-only",
      hash,
      error: "Fabric unavailable — the record remains in DWN-only mode.",
    };
  }
}

/**
 * Verify a record hash through DHRS/Fabric.
 * @param {string} hash SHA-256 hex digest
 * @returns {Promise<any>}
 */
export async function verifyRecordHash(hash) {
  try {
    return await dhrsRequest(`blockchain/verify/${encodeURIComponent(hash)}`);
  } catch {
    return {
      status: "unavailable",
      mode: "dwn-only",
      hash,
      verified: false,
      error: "Fabric unavailable — verification remains DWN-only.",
    };
  }
}

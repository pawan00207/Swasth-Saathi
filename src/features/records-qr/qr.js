import QRCode from "qrcode";

export function getRecordDownloadUrl(recordId, origin = "") {
  const cleanOrigin = String(origin || "").replace(/\/$/, "");
  return `${cleanOrigin}/api/reports/download/${encodeURIComponent(recordId)}`;
}

export function getRecordViewUrl(recordId, origin = "") {
  const cleanOrigin = String(origin || "").replace(/\/$/, "");
  return `${cleanOrigin}/records/view/${encodeURIComponent(recordId)}`;
}

export async function createRecordQr(recordId, origin = "") {
  return QRCode.toDataURL(getRecordDownloadUrl(recordId, origin));
}

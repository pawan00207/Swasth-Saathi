import QRCode from "qrcode";

export async function createRecordQr(recordId, origin = "") {
  const path = `/records/view/${encodeURIComponent(recordId)}`;
  return QRCode.toDataURL(`${origin}${path}`);
}

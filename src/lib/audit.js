import { createHash } from "node:crypto";

export async function writeAuditLog(prisma, { entityType, entityId, actorId = null, action, details = {} }) {
  if (!prisma) return null;
  try {
    return await prisma.auditLog.create({
      data: {
        entityType: String(entityType),
        entityId: String(entityId),
        actorId: actorId ? String(actorId) : null,
        action: String(action),
        details,
      },
    });
  } catch (error) {
    console.warn("Audit log write skipped", error?.message || "db error");
    return null;
  }
}

export function computeInvoiceHash(invoice) {
  const payload = {
    billNumber: invoice.billNumber || invoice.bill_number || "",
    hospitalId: invoice.hospitalId || invoice.hospital_id || "",
    subtotal: Number(invoice.subtotal || 0).toFixed(2),
    tax: Number(invoice.tax || 0).toFixed(2),
    discount: Number(invoice.discount || 0).toFixed(2),
    total: Number(invoice.total || 0).toFixed(2),
    items: (invoice.items || invoice.bill_items || [])
      .map((item) => ({
        description: String(item.description || ""),
        quantity: Number(item.quantity || 1).toFixed(2),
        unitPrice: Number(item.unitPrice ?? item.unit_price ?? 0).toFixed(2),
        taxRate: Number(item.taxRate ?? item.tax_rate ?? 0).toFixed(2),
      }))
      .sort((a, b) => a.description.localeCompare(b.description)),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `****${digits.slice(-4)}`;
}

export function normalizeWhatsappPhone(phone) {
  const raw = String(phone || "").replace(/^whatsapp:/i, "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return `+${cleaned}`;
}

export function isValidWhatsappPhone(phone) {
  const normalized = normalizeWhatsappPhone(phone);
  return /^\+[1-9]\d{7,14}$/.test(normalized);
}

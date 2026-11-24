import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/api-auth", () => ({
  requireUser: vi.fn(),
}));

import { requireUser } from "../src/lib/api-auth";
import { POST } from "../src/app/api/appointments/[id]/payment/route";

describe("Appointment consultation payment order", () => {
  const originalEnv = {
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  };
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = originalFetch;
    if (originalEnv.RAZORPAY_KEY_ID === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = originalEnv.RAZORPAY_KEY_ID;
    if (originalEnv.RAZORPAY_KEY_SECRET === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalEnv.RAZORPAY_KEY_SECRET;
  });

  it("uses the appointment doctor's server-side fee and creates a linked invoice order", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_example";
    process.env.RAZORPAY_KEY_SECRET = "test-secret";
    const prisma = {
      appointment: {
        findFirst: vi.fn().mockResolvedValue({
          id: "apt-123",
          patientId: "patient-1",
          hospitalId: null,
          status: "booked",
          doctor: { name: "Dr Test", fee: "500.00" },
        }),
      },
      invoice: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "invoice-1", patientId: "patient-1", total: "500", paymentStatus: "pending" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      payment: { create: vi.fn().mockResolvedValue({}) },
    };
    requireUser.mockResolvedValue({
      prisma,
      user: { id: "patient-1" },
      profile: { role: "patient" },
    });
    globalThis.fetch = vi.fn(async (_url, options) => ({
      ok: true,
      json: async () => ({ id: "order-1", currency: "INR", sentAmount: JSON.parse(options.body).amount }),
    }));

    const response = await POST(
      new Request("http://localhost/api/appointments/apt-123/payment", { method: "POST" }),
      { params: { id: "apt-123" } },
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ orderId: "order-1", billId: "invoice-1", amount: 50000, total: 500 });
    expect(prisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ total: 500, billNumber: "APT-apt-123" }),
    }));
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body).amount).toBe(50000);
  });

  it("does not create an order for an appointment owned by another user", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_example";
    process.env.RAZORPAY_KEY_SECRET = "test-secret";
    requireUser.mockResolvedValue({
      prisma: { appointment: { findFirst: vi.fn().mockResolvedValue(null) } },
      user: { id: "patient-1" },
    });
    globalThis.fetch = vi.fn();

    const response = await POST(
      new Request("http://localhost/api/appointments/apt-other/payment", { method: "POST" }),
      { params: { id: "apt-other" } },
    );

    expect(response.status).toBe(404);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

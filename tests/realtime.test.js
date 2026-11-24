import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("../src/lib/supabase/server", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

import { publishRealtime } from "../src/lib/realtime-server";

describe("Realtime publisher", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends a private broadcast through HTTP without joining a persistent channel", async () => {
    const channel = { send: vi.fn().mockResolvedValue("ok") };
    const supabase = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn().mockResolvedValue("ok"),
    };
    mocks.getSupabaseAdmin.mockReturnValue(supabase);

    await expect(publishRealtime("appointment-123", "updated", { appointmentId: "123", status: "confirmed" }))
      .resolves.toBe(true);

    expect(supabase.channel).toHaveBeenCalledWith("appointment-123", { config: { private: true } });
    expect(channel.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "updated",
      payload: { appointmentId: "123", status: "confirmed" },
    });
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("reports an unavailable publisher so callers can retain fallback behavior", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(null);

    await expect(publishRealtime("bed-inventory-live", "updated", {})).resolves.toBe(false);
  });
});

import { getSupabaseAdmin } from "./supabase/server";

export async function publishRealtime(topic, event, payload, { private: isPrivate = true } = {}) {
  let supabase;
  let channel;
  try {
    supabase = getSupabaseAdmin();
    if (!supabase) return false;
    channel = supabase.channel(topic, { config: { private: isPrivate } });
    const result = await channel.send({ type: "broadcast", event, payload });
    if (result !== "ok") {
      console.warn(`Supabase Realtime broadcast failed for ${topic}: ${result}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Supabase Realtime broadcast failed for ${topic}`, error.name || "provider error");
    return false;
  } finally {
    if (supabase && channel) {
      try {
        await supabase.removeChannel(channel);
      } catch (error) {
        console.warn(`Could not clean up Supabase Realtime channel ${topic}`, error.name || "provider error");
      }
    }
  }
}

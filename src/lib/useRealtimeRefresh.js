"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "./supabase/browser";

export function useRealtimeRefresh(topics, refresh, fallbackIntervalMs) {
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  const refreshRef = useRef(refresh);
  const topicKey = JSON.stringify(
    topics
      .filter(Boolean)
      .map((topic) => typeof topic === "string" ? { name: topic, private: true } : topic)
      .sort((left, right) => left.name.localeCompare(right.name)),
  );

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let active = true;
    const statuses = new Map();
    const channels = [];
    const supabase = getSupabaseBrowser();
    const topicList = JSON.parse(topicKey);

    function updateConnection() {
      const isConnected = topicList.length > 0 && topicList.every((topic) => statuses.get(topic.name) === true);
      connectedRef.current = isConnected;
      setConnected(isConnected);
    }

    if (supabase) {
      for (const topic of topicList) {
        statuses.set(topic.name, false);
        const channel = supabase.channel(topic.name, { config: { private: topic.private } })
          .on("broadcast", { event: "*" }, () => {
            if (active) triggerRefresh();
          })
          .subscribe((status) => {
            if (!active) return;
            statuses.set(topic.name, status === "SUBSCRIBED");
            updateConnection();
            if (status === "SUBSCRIBED") triggerRefresh();
          });
        channels.push(channel);
      }
    }

    function triggerRefresh() {
      Promise.resolve(refreshRef.current()).catch((error) => {
        console.error("Could not refresh data from Realtime or polling fallback", error);
      });
    }

    const interval = topicList.length
      ? setInterval(() => {
        if (active && !connectedRef.current) triggerRefresh();
      }, fallbackIntervalMs)
      : null;

    return () => {
      active = false;
      if (interval) clearInterval(interval);
      connectedRef.current = false;
      setConnected(false);
      if (supabase) channels.forEach((channel) => {
        supabase.removeChannel(channel).catch((error) => {
          console.warn("Could not clean up Supabase Realtime subscription", error.name || "provider error");
        });
      });
    };
  }, [topicKey, fallbackIntervalMs]);

  return connected;
}

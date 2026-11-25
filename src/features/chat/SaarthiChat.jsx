"use client";

import { useState } from "react";

export default function SaarthiChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Namaste! I am Saarthi AI. Ask about schemes, hospital access, reports, or booking support." },
  ]);
  const [loading, setLoading] = useState(false);

  async function send(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((items) => [...items, { role: "user", text }]);
    setLoading(true);
    try {
      const response = await fetch("/api/saarthi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Saarthi AI is unavailable.");
      setMessages((items) => [...items, { role: "assistant", text: data.reply }]);
    } catch (error) {
      setMessages((items) => [
        ...items,
        { role: "assistant", text: error.message || "Saarthi AI could not respond right now. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="site-utility-action fixed bottom-5 right-5 z-40 min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-teal-900 shadow-md hover:bg-teal-50"
        aria-expanded={open}
        aria-controls="saarthi-chat"
      >
        Saarthi AI
      </button>
      {open && (
        <section
          id="saarthi-chat"
          aria-label="Saarthi AI chatbot"
          className="fixed bottom-20 right-5 z-40 flex h-[min(420px,calc(100dvh-104px))] w-[min(380px,calc(100vw-40px))] flex-col rounded-xl border border-slate-300 bg-white shadow-lg"
        >
          <div className="rounded-t-xl border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-teal-950">Saarthi AI</div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.map((message, index) => (
              <p
                key={`${message.role}-${index}`}
                className={`rounded-lg px-3 py-2 text-sm ${message.role === "user" ? "ml-8 bg-teal-100" : "mr-8 bg-slate-100"}`}
              >
                {message.text}
              </p>
            ))}
            {loading && <p className="mr-8 rounded-lg bg-slate-100 px-3 py-2 text-sm">Saarthi AI is thinking...</p>}
          </div>
          <form onSubmit={send} className="flex gap-2 border-t p-3">
            <label className="sr-only" htmlFor="saarthi-message">Message Saarthi AI</label>
            <input
              id="saarthi-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="min-w-0 flex-1 rounded border px-3 py-2"
              placeholder="Ask about healthcare support"
            />
            <button className="rounded bg-teal-800 px-4 py-2 text-white" disabled={loading}>Send</button>
          </form>
        </section>
      )}
    </>
  );
}

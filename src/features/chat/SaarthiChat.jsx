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
        { role: "assistant", text: `Live demo guidance is active. ${error.message}` },
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
        className="fixed bottom-5 right-5 z-40 rounded-full bg-teal-800 px-5 py-3 font-bold text-white shadow-lg focus:outline-none focus:ring-4 focus:ring-teal-300"
        aria-expanded={open}
        aria-controls="saarthi-chat"
      >
        Saarthi AI
      </button>
      {open && (
        <section
          id="saarthi-chat"
          aria-label="Saarthi AI chatbot"
          className="fixed bottom-20 right-5 z-40 flex h-[420px] w-[min(380px,calc(100vw-40px))] flex-col rounded-lg border border-slate-300 bg-white shadow-xl"
        >
          <div className="rounded-t-lg bg-teal-950 px-4 py-3 font-bold text-white">Saarthi AI</div>
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

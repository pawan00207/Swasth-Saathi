"use client";

import { useEffect, useRef, useState } from "react";

const careOptions = [
  {
    heading: "Emergency help now",
    description: "For serious signs such as trouble breathing, chest pain, or someone being unconscious.",
    href: "tel:112",
    action: "Call 112 in India",
    color: "border-red-300 bg-red-50 text-red-950",
  },
  {
    heading: "Speak to a clinician",
    description: "If symptoms are getting worse, keep coming back, or you are unsure how soon you need care.",
    href: "/consult",
    action: "View consultations",
    color: "border-amber-300 bg-amber-50 text-amber-950",
  },
  {
    heading: "Prepare for a visit",
    description: "Write down when symptoms started and what changed. If you are under 18, tell a parent or trusted adult.",
    color: "border-teal-300 bg-teal-50 text-teal-950",
  },
];

function CareOptions() {
  return (
    <section aria-label="Care options by urgency">
      <h3 className="font-bold text-teal-950">Care options by urgency</h3>
      <ol className="mt-2 space-y-2">
        {careOptions.map(({ heading, description, href, action, color }) => (
          <li key={heading} className={`rounded-lg border-l-4 p-3 ${color}`}>
            <h4 className="font-semibold">{heading}</h4>
            <p className="mt-1">{description}</p>
            {href && <a className="mt-1 inline-flex min-h-9 items-center font-semibold underline" href={href}>{action}</a>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function SaarthiChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Namaste! I am Saarthi AI. Ask about schemes, hospital access, reports, or booking support." },
  ]);
  const [loading, setLoading] = useState(false);

  const logRef = useRef(null);

  useEffect(() => {
    const log = logRef.current;
    const latest = log?.lastElementChild;
    if (latest) log.scrollTop += latest.getBoundingClientRect().top - log.getBoundingClientRect().top - 12;
  }, [open, messages, loading]);

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
      setMessages((items) => [...items, { role: "assistant", text: data.reply, kind: data.kind, action: data.action, steps: data.steps }]);
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
          className="fixed bottom-20 right-5 z-40 flex h-[min(540px,calc(100dvh-104px))] w-[min(440px,calc(100vw-40px))] flex-col rounded-xl border border-slate-300 bg-white shadow-lg"
        >
          <div className="rounded-t-xl border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-teal-950">Saarthi AI</div>
          <div ref={logRef} className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`}
                className={`break-words rounded-lg px-3 py-2 text-sm ${message.role === "user" ? "ml-8 bg-teal-100" : "bg-slate-100"}`}>
                {message.steps?.length ? (
                  <section aria-label="Symptom-specific next steps">
                    <h3 className="font-bold text-teal-950">{message.text} · what to do next</h3>
                    <ol className="mt-2 list-decimal space-y-2 pl-5">
                      {message.steps.map((step) => <li key={step}>{step}</li>)}
                    </ol>
                    <div className="mt-2 flex flex-wrap gap-x-4">
                      <a className="inline-flex min-h-9 items-center font-semibold text-red-900 underline" href="tel:112">Emergency: call 112 in India</a>
                      <a className="inline-flex min-h-9 items-center font-semibold text-teal-900 underline" href="/consult">View consultations</a>
                    </div>
                  </section>
                ) : message.kind === "care" ? (
                  <><p className="mb-3">{message.text}</p><CareOptions /></>
                ) : message.action ? (
                  <a className="inline-flex min-h-9 items-center font-semibold text-teal-900 underline" href={message.action.href}>
                    {message.action.label}
                  </a>
                ) : <p>{message.text}</p>}
              </div>
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
              placeholder="Ask about symptoms or services"
            />
            <button className="rounded bg-teal-800 px-4 py-2 text-white" disabled={loading}>Send</button>
          </form>
        </section>
      )}
    </>
  );
}

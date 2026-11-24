"use client";

import { useCallback, useState } from "react";
import { Mic, MicOff, Navigation, Search, Volume2, VolumeX, X } from "lucide-react";
import { useI18n } from "./I18nProvider";
import { useVoice } from "../lib/useVoice";
import { parseVoiceCommand, VOICE_SERVICE_ROUTES } from "../lib/voiceCommands";

const QUICK_EXAMPLES = [
  "Find ICU beds in Delhi",
  "Search AIIMS hospital",
  "Open Care Wallet",
  "Show health schemes",
  "Route to Safdarjung Hospital",
  "Open SOS emergency",
];

export default function VoiceCommandBar({ variant = "header", onNavigate }) {
  const { language, t } = useI18n();
  const voice = useVoice(language);
  const [panelOpen, setPanelOpen] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [spokenReplyEnabled, setSpokenReplyEnabled] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const label = useCallback(
    (key, fallback) => {
      const value = t(key);
      return value === key ? fallback : value;
    },
    [t],
  );

  const navigateTo = useCallback(
    (url) => {
      if (!url) return;
      if (typeof onNavigate === "function") {
        onNavigate(url);
      } else if (typeof window !== "undefined") {
        window.location.assign(url);
      }
    },
    [onNavigate],
  );

  const executeCommand = useCallback(
    (rawText) => {
      const command = parseVoiceCommand(rawText);
      setFeedback(command);

      if (spokenReplyEnabled && voice.ttsSupported && command.spokenSummary) {
        voice.speak(command.spokenSummary);
      }

      if (command.type === "unknown") {
        setPanelOpen(true);
        return;
      }

      if (typeof window !== "undefined") {
        if (command.type === "search_hospitals" || command.type === "clear_filters") {
          window.dispatchEvent(new CustomEvent("swasth:voice-hospital-search", { detail: command }));
        } else if (command.type === "route_hospital") {
          window.dispatchEvent(new CustomEvent("swasth:voice-route-hospital", { detail: command }));
        }
      }

      if (command.url) {
        navigateTo(command.url);
      }
    },
    [navigateTo, spokenReplyEnabled, voice],
  );

  const startVoiceCapture = useCallback(() => {
    setPanelOpen(true);
    if (voice.listening) {
      voice.stopListening();
      return;
    }
    voice.clearError();
    voice.listen(
      (transcript) => {
        setManualInput(transcript);
        executeCommand(transcript);
      },
      () => {
        setPanelOpen(true);
      },
      { interim: true },
    );
  }, [executeCommand, voice]);

  function handleManualSubmit(event) {
    event.preventDefault();
    const text = manualInput.trim();
    if (!text) return;
    executeCommand(text);
  }

  const micButtonLabel = voice.listening
    ? label("voice.listening", "Listening...")
    : label("voice.voiceCommand", "Voice Command");

  if (variant === "floating") {
    return (
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        {panelOpen && (
          <section
            aria-label="Voice navigation and hospital search"
            className="w-[min(360px,calc(100vw-32px))] rounded-xl border border-teal-700 bg-white p-4 text-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm text-teal-950">
                {label("voice.panelTitle", "Voice Navigation & Hospital Search")}
              </strong>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Close voice assistant"
                className="rounded p-1 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <VoicePanelBody
              voice={voice}
              manualInput={manualInput}
              setManualInput={setManualInput}
              handleManualSubmit={handleManualSubmit}
              startVoiceCapture={startVoiceCapture}
              executeCommand={executeCommand}
              feedback={feedback}
              spokenReplyEnabled={spokenReplyEnabled}
              setSpokenReplyEnabled={setSpokenReplyEnabled}
              label={label}
            />
          </section>
        )}
        <button
          type="button"
          onClick={startVoiceCapture}
          aria-pressed={voice.listening}
          aria-label={micButtonLabel}
          className={`flex min-h-[52px] items-center gap-2 rounded-full border-2 border-white px-5 py-3 text-sm font-extrabold text-white shadow-xl focus:outline-none focus:ring-4 focus:ring-teal-300 ${
            voice.listening ? "animate-pulse bg-rose-700 hover:bg-rose-800" : "bg-teal-800 hover:bg-teal-900"
          }`}
        >
          {voice.listening ? <MicOff className="h-5 w-5" aria-hidden="true" /> : <Mic className="h-5 w-5" aria-hidden="true" />}
          <span>{micButtonLabel}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={startVoiceCapture}
        aria-pressed={voice.listening}
        aria-expanded={panelOpen}
        aria-controls="header-voice-command-panel"
        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded border px-3 py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-white ${
          voice.listening
            ? "animate-pulse border-rose-200 bg-rose-700 text-white"
            : "border-teal-200 bg-teal-900 text-white hover:bg-teal-800"
        }`}
      >
        {voice.listening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
        <span>{micButtonLabel}</span>
      </button>

      <button
        type="button"
        onClick={() => setPanelOpen((open) => !open)}
        aria-expanded={panelOpen}
        aria-controls="header-voice-command-panel"
        aria-label={label("voice.togglePanel", "Toggle voice command options")}
        className="inline-flex min-h-[36px] items-center rounded border border-teal-300 bg-teal-950 px-2.5 py-1 text-xs font-semibold text-teal-50 hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-white"
      >
        {panelOpen ? label("voice.hide", "Hide") : label("voice.commands", "Commands")}
      </button>

      {panelOpen && (
        <section
          id="header-voice-command-panel"
          aria-label="Voice navigation and hospital search"
          className="fixed left-1/2 top-24 z-50 w-[min(540px,calc(100vw-24px))] -translate-x-1/2 rounded-xl border-2 border-teal-700 bg-white p-4 text-slate-900 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-teal-800" aria-hidden="true" />
              <strong className="text-sm text-teal-950">
                {label("voice.panelTitle", "Voice Navigation & Hospital Search")}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="Close voice command panel"
              className="rounded p-1 text-slate-600 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <VoicePanelBody
            voice={voice}
            manualInput={manualInput}
            setManualInput={setManualInput}
            handleManualSubmit={handleManualSubmit}
            startVoiceCapture={startVoiceCapture}
            executeCommand={executeCommand}
            feedback={feedback}
            spokenReplyEnabled={spokenReplyEnabled}
            setSpokenReplyEnabled={setSpokenReplyEnabled}
            label={label}
          />
        </section>
      )}
    </div>
  );
}

function VoicePanelBody({
  voice,
  manualInput,
  setManualInput,
  handleManualSubmit,
  startVoiceCapture,
  executeCommand,
  feedback,
  spokenReplyEnabled,
  setSpokenReplyEnabled,
  label,
}) {
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={startVoiceCapture}
          className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 py-2 font-bold text-white ${
            voice.listening ? "bg-rose-700 hover:bg-rose-800" : "bg-teal-800 hover:bg-teal-900"
          }`}
        >
          {voice.listening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
          <span>
            {voice.listening
              ? label("voice.stopListening", "Stop Listening")
              : label("voice.tapToSpeak", "Tap & Speak Command")}
          </span>
        </button>

        {voice.ttsSupported && (
          <button
            type="button"
            onClick={() => setSpokenReplyEnabled((v) => !v)}
            aria-pressed={spokenReplyEnabled}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100"
          >
            {spokenReplyEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-teal-800" aria-hidden="true" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            )}
            <span>{spokenReplyEnabled ? "Spoken replies on" : "Spoken replies muted"}</span>
          </button>
        )}
      </div>

      {!voice.supported && (
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
          Browser SpeechRecognition API is unavailable in this browser. You can still type or tap a command below.
        </p>
      )}

      {(voice.listening || voice.interimTranscript) && (
        <p role="status" aria-live="polite" className="rounded border border-teal-300 bg-teal-50 p-2 text-xs font-semibold text-teal-950">
          {voice.interimTranscript
            ? `Listening: "${voice.interimTranscript}"`
            : "Listening now... say a health service or hospital search."}
        </p>
      )}

      {voice.error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-xs font-semibold text-red-900">
          {voice.error}
        </p>
      )}

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded border p-2.5 text-xs ${
            feedback.type === "unknown"
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-green-300 bg-green-50 text-green-950"
          }`}
        >
          <p className="font-bold">
            {feedback.type === "search_hospitals" ? (
              <Search className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Navigation className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            )}
            {feedback.spokenSummary}
          </p>
          {feedback.transcript && (
            <p className="mt-0.5 text-[11px] opacity-80">Heard: &ldquo;{feedback.transcript}&rdquo;</p>
          )}
        </div>
      )}

      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <label htmlFor="voice-command-fallback-input" className="sr-only">
          Type a voice command
        </label>
        <input
          id="voice-command-fallback-input"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder='Try "Find ICU beds in Delhi" or "Open Care Wallet"'
          className="min-h-[40px] min-w-0 flex-1 rounded border border-slate-400 px-3 py-1.5 text-xs"
        />
        <button
          type="submit"
          className="min-h-[40px] rounded bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
        >
          Run
        </button>
      </form>

      <div>
        <p className="text-xs font-semibold text-slate-600">
          {label("voice.trySaying", "Try saying or tapping:")}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {QUICK_EXAMPLES.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => {
                setManualInput(cmd);
                executeCommand(cmd);
              }}
              className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-teal-50 hover:text-teal-950"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>

      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-teal-900">
          Supported health services ({VOICE_SERVICE_ROUTES.length})
        </summary>
        <ul className="mt-1.5 grid grid-cols-2 gap-1">
          {VOICE_SERVICE_ROUTES.map((svc) => (
            <li key={svc.id} className="truncate">
              <strong>{svc.label}:</strong> &ldquo;{svc.example}&rdquo;
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

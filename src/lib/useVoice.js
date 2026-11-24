"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getIntlLocale } from "./i18n";

function mapRecognitionError(code) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was denied. Please allow microphone access in your browser settings.";
    case "no-speech":
      return "No speech detected. Please tap the microphone and speak clearly.";
    case "audio-capture":
      return "No microphone was found on this device.";
    case "network":
      return "Speech recognition network error. Check your connection and try again.";
    case "aborted":
      return "";
    default:
      return code ? `Voice capture unavailable (${code}).` : "Voice capture unavailable.";
  }
}

export function useVoice(language = "en") {
  const [supported, setSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(Rec));
    setTtsSupported(Boolean(window.speechSynthesis));
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  const clearError = useCallback(() => setError(""), []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore stop errors
    }
    setListening(false);
  }, []);

  const listen = useCallback(
    (onTranscript, onError, options = {}) => {
      if (typeof window === "undefined") return false;
      const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec) {
        const msg = "Speech recognition is not supported in this browser. Use Chrome, Edge, or Safari, or type a command below.";
        setError(msg);
        onError?.(msg);
        return false;
      }

      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore previous instance stop
      }

      setError("");
      setInterimTranscript("");

      const recognition = new Rec();
      recognition.lang = options.lang || getIntlLocale(language);
      recognition.interimResults = Boolean(options.interim);
      recognition.continuous = Boolean(options.continuous);
      recognition.maxAlternatives = 1;

      let finalEmitted = false;
      let latestTranscript = "";

      recognition.onstart = () => {
        setListening(true);
      };

      recognition.onend = () => {
        setListening(false);
        if (!finalEmitted && latestTranscript.trim()) {
          finalEmitted = true;
          const clean = latestTranscript.trim();
          setLastTranscript(clean);
          setInterimTranscript("");
          onTranscript?.(clean);
        }
      };

      recognition.onerror = (event) => {
        setListening(false);
        const message = mapRecognitionError(event?.error);
        if (message) {
          setError(message);
          onError?.(message);
        }
      };

      recognition.onresult = (event) => {
        let interim = "";
        let finalText = "";
        const results = event?.results || [];
        for (let i = 0; i < results.length; i += 1) {
          const item = results[i];
          const text = item?.[0]?.transcript || "";
          if (item?.isFinal) {
            finalText += `${text} `;
          } else {
            interim += `${text} `;
          }
        }
        latestTranscript = (finalText || interim).trim();
        if (interim.trim()) {
          setInterimTranscript(interim.trim());
          options.onInterim?.(interim.trim());
        }
        if (finalText.trim() && !finalEmitted) {
          finalEmitted = true;
          const clean = finalText.trim();
          setLastTranscript(clean);
          setInterimTranscript("");
          onTranscript?.(clean);
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        return true;
      } catch (err) {
        setListening(false);
        const msg = err?.message || "Could not start voice recognition.";
        setError(msg);
        onError?.(msg);
        return false;
      }
    },
    [language],
  );

  const speak = useCallback(
    (text) => {
      if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = getIntlLocale(language);
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore speech synthesis errors
      }
    },
    [language],
  );

  return {
    supported,
    ttsSupported,
    listening,
    interimTranscript,
    lastTranscript,
    error,
    clearError,
    listen,
    stopListening,
    speak,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getIntlLocale } from "./i18n";

export function useVoice(language = "en") {
  const [supported, setSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [listening, setListening] = useState(false);
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

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore stop errors
    }
    setListening(false);
  }, []);

  const listen = useCallback(
    (onTranscript, onError) => {
      if (typeof window === "undefined") return;
      const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec) return;
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore previous instance stop
      }
      const recognition = new Rec();
      recognition.lang = getIntlLocale(language);
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setListening(true);
      recognition.onend = () => setListening(false);
      recognition.onerror = (event) => {
        setListening(false);
        onError?.(event.error || "Voice capture unavailable");
      };
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        if (transcript) onTranscript?.(transcript);
      };
      recognitionRef.current = recognition;
      recognition.start();
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

  return { supported, ttsSupported, listening, listen, stopListening, speak };
}

"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * useVoicePreview
 *
 * Utilise la Web Speech API native du navigateur pour lire un texte à voix haute.
 * Zéro dépendance externe. Peut être swappé vers un endpoint TTS (ElevenLabs)
 * en remplaçant les appels à speechSynthesis par une requête fetch.
 *
 * @param sampleText - Le texte à lire lors du preview.
 */
export function useVoicePreview(sampleText: string) {
  const [isPreviewing, setIsPreviewing] = useState(false);

  const stopPreview = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPreviewing(false);
  }, []);

  const startPreview = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => setIsPreviewing(false);
    utterance.onerror = () => setIsPreviewing(false);

    setIsPreviewing(true);
    window.speechSynthesis.speak(utterance);
  }, [sampleText]);

  const togglePreview = useCallback(() => {
    if (isPreviewing) {
      stopPreview();
    } else {
      startPreview();
    }
  }, [isPreviewing, startPreview, stopPreview]);

  // Nettoyage à la destruction du composant
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { isPreviewing, togglePreview, stopPreview };
}

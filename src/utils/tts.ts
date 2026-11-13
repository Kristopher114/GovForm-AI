import { LanguageKey } from "@/constants/translations";
import * as Speech from "expo-speech";

/**
 * Maps the app's language selector to a BCP-47 locale for the on-device
 * TTS engine. Cebuano (Bisaya) has no dedicated voice on most Android/iOS
 * TTS engines, so it falls back to Filipino, which is the closest
 * available voice and still sounds far more natural than English.
 */
const LANGUAGE_TO_SPEECH_LOCALE: Record<LanguageKey, string> = {
  English: "en-US",
  Tagalog: "fil-PH",
  Cebuano: "fil-PH",
};

export function getSpeechLocale(language: LanguageKey): string {
  return LANGUAGE_TO_SPEECH_LOCALE[language] || "en-US";
}

interface SpeakOptions {
  rate?: number;
  onStart?: () => void;
  onDone?: () => void;
}

/**
 * Speaks the given text aloud. Stops any speech currently in progress
 * first, since only one utterance should ever play at a time in the app.
 */
export function speakText(
  text: string,
  language: LanguageKey,
  options: SpeakOptions = {},
): void {
  const cleaned = text?.trim();
  if (!cleaned) return;

  Speech.stop();

  const defaultRate = language === "Cebuano" ? 0.88 : 0.92;

  Speech.speak(cleaned, {
    language: getSpeechLocale(language),
    pitch: 1.0,
    rate: options.rate ?? defaultRate,
    onStart: options.onStart,
    onDone: options.onDone,
    onStopped: options.onDone,
    onError: options.onDone,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}

export function isSpeakingNow(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}

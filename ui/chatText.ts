import { phraseText, type Language } from "../game/phrases";
import type { View } from "../game/view";

export const chatLanguage = (): Language =>
  (localStorage.getItem("sm-lang") ?? navigator.language ?? "de").toLowerCase().startsWith("de") ? "de" : "en";
export const messageText = (message: View["chat"][number], language: Language = chatLanguage()) =>
  message.phrase ? phraseText(message.phrase.kind, message.phrase.index, language) : message.text;

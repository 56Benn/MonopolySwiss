import type { Bundle } from "../game/model";

export type Tab = "Tisch" | "Portfolio" | "Handel" | "News" | "Chat";
export type Page = "Transaktionen" | "Menü" | null;
export type TradeDraft = { view: "list" | "cards" | "compose"; contact: string; give: Bundle; want: Bundle };
export type Note = { id: string; kind: "chat" | "news" | "trade" | "casino" | "jail"; title: string; text: string; tab: Tab; thread?: string; good?: boolean };
export const emptyBundle = (): Bundle => ({ cash: 0, assets: [], cards: [] });
export const emptyDraft = (): TradeDraft => ({ view: "list", contact: "", give: emptyBundle(), want: emptyBundle() });

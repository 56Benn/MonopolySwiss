import { M } from "./board.ts";
export const insuranceCap = 60 * M;
export const couponCap = 20 * M;
/** Risikokapital: sicherer Betrag oder 50/50 zwischen Gewinn und Verlust, in Mio. */
export const gamble = { safe: 15, win: 60, loss: 30 };
export type MarketEffect = {
  groups: number[] | "all" | "random" | "other";
  pct: number | "up" | "down" | "either";
};
/** cash: feste Mio.; portfolio/wealth: Prozent von Firmenwert bzw. Bargeld; levels: Mio. je Ausbaustufe. */
export type CashEffect = { kind: "cash" | "portfolio" | "wealth" | "levels"; amount: number; min?: number; cap?: number };
export type Effect =
  | { kind: "market"; changes: MarketEffect[] }
  | CashEffect
  | { kind: "move"; target: "start" | "zurich" | "next" | "back" | "jail" }
  | { kind: "keep"; item: "lawyer" | "insurance" | "coupon" }
  | { kind: "choice" };
export type Card = {
  id: string;
  name: string;
  icon: string;
  duration: "sofort" | "Besitz";
  effect: Effect;
};
const events: [string, MarketEffect[]][] = [];
for (const [group, up, down] of [
  [0, "Netzausbau-Boom", "Digitale Durststrecke"],
  [1, "Luxus ausverkauft", "Luxusflaute"],
  [2, "Schweizer Produkte gefragt", "Rohstoffe werden teurer"],
  [3, "Volle Auftragsbücher", "Lieferketten unter Druck"],
  [4, "Vertrauen kehrt zurück", "Turbulenzen am Finanzplatz"],
  [5, "Forschungserfolg", "Forschung verzögert sich"],
  [7, "Cloud-Boom", "Chip-Lieferengpass"],
  [6, "Autos weltweit gefragt", "Absatzflaute auf dem Automarkt"],
] as const) {
  events.push(
    [up, [{ groups: [group], pct: "up" }]],
    [down, [{ groups: [group], pct: "down" }]],
  );
}
events.push(
  ["Börsenfrühling", [{ groups: "all", pct: 8 }]],
  ["Schwarzer Handelstag", [{ groups: "all", pct: -10 }]],
  [
    "Starker Franken",
    [
      { groups: [3], pct: -10 },
      { groups: [4], pct: 8 },
    ],
  ],
  [
    "Elektromobilitäts-Offensive",
    [
      { groups: [6], pct: 15 },
      { groups: [3], pct: 5 },
    ],
  ],
  ["KI-Offensive", [{ groups: [0, 7], pct: 12 }]],
  ["Konsum zieht an", [{ groups: [1, 2], pct: 12 }]],
  [
    "Kapitalrotation",
    [
      { groups: "random", pct: 15 },
      { groups: "other", pct: -12 },
    ],
  ],
  ["Überraschende Marktreaktion", [{ groups: "random", pct: "either" }]],
);
const chances: [string, Effect][] = [
  ["Dein Start-up geht an die Börse", { kind: "cash", amount: 80 }],
  ["Strafe für Steuerhinterziehung", { kind: "wealth", amount: -5, min: 15 }],
  ["Erfolgreiche Beratung", { kind: "cash", amount: 25 }],
  ["Patent verkauft", { kind: "cash", amount: 35 }],
  ["Betriebskosten explodieren", { kind: "portfolio", amount: -3, min: 10, cap: 200 }],
  ["Steuerrückerstattung", { kind: "cash", amount: 20 }],
  ["Verpasste Frist", { kind: "cash", amount: -20 }],
  ["Investorenpreis", { kind: "cash", amount: 30 }],
  ["Falsch geparkte Firmenflotte", { kind: "cash", amount: -15 }],
  ["Erfolgreicher Messeauftritt", { kind: "cash", amount: 20 }],
  ["Cybervorfall im eigenen Portfolio", { kind: "levels", amount: -10, min: 15 }],
  ["Förderbeitrag", { kind: "cash", amount: 30 }],
];
chances.push(
  ["Portfolioausschüttung", { kind: "portfolio", amount: 5, cap: 150 }],
  ["Vermögensabgabe", { kind: "portfolio", amount: -5, cap: 250 }],
  ["Vorstand auf Geschäftsreise", { kind: "move", target: "start" }],
  ["Sitzung in Zürich", { kind: "move", target: "zurich" }],
  ["Quartalsbesuch", { kind: "move", target: "next" }],
  ["Falsche Abzweigung", { kind: "move", target: "back" }],
  ["Untersuchungshaft", { kind: "move", target: "jail" }],
  ["Anwalt regelt das", { kind: "keep", item: "lawyer" }],
  ["Zweiter Anwaltstermin", { kind: "keep", item: "lawyer" }],
  ["Betriebsausfallversicherung", { kind: "keep", item: "insurance" }],
  ["Übernahmegutschein", { kind: "keep", item: "coupon" }],
  ["Risikokapital-Wette", { kind: "choice" }],
);
export const cards: Card[] = [
  ...events.map(
    ([name, changes], index): Card => ({
      id: `E${index}`,
      name,
      icon: "chart",
      duration: "sofort",
      effect: { kind: "market", changes },
    }),
  ),
  ...chances.map(
    ([name, effect], index): Card => ({
      id: `C${index}`,
      name,
      effect,
      icon: effect.kind,
      duration: effect.kind === "keep" ? "Besitz" : "sofort",
    }),
  ),
];
export const card = (id: string) => cards.find((item) => item.id === id)!;
export const cashEffect = (effect: Effect): effect is CashEffect =>
  ["cash", "portfolio", "wealth", "levels"].includes(effect.kind);
/** Lesbare Formel einer Geldkarte ohne Vorzeichen, z. B. „5 % deines Bargelds (mind. 15M)“. */
export function effectText(effect: CashEffect) {
  const size = Math.abs(effect.amount),
    limits = [effect.min ? `mind. ${effect.min}M` : "", effect.cap ? `höchstens ${effect.cap}M` : ""].filter(Boolean).join(", ");
  const base =
    effect.kind === "cash"
      ? `${size}M`
      : effect.kind === "portfolio"
        ? `${size} % des eigenen Firmenwerts`
        : effect.kind === "wealth"
          ? `${size} % des Bargelds`
          : `${size}M je Ausbaustufe`;
  return limits ? `${base} (${limits})` : base;
}

export type MarketEffect = {
  groups: number[] | "all" | "random" | "other";
  pct: number | "up" | "down" | "either";
};
export type Effect =
  | { kind: "market"; changes: MarketEffect[] }
  | { kind: "cash" | "portfolio"; amount: number }
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
  "Dein Start-up geht an die Börse",
  "Strafe für Steuerhinterziehung",
  "Erfolgreiche Beratung",
  "Patent verkauft",
  "Betriebskosten explodieren",
  "Steuerrückerstattung",
  "Verpasste Frist",
  "Investorenpreis",
  "Falsch geparkte Firmenflotte",
  "Erfolgreicher Messeauftritt",
  "Cybervorfall im eigenen Portfolio",
  "Förderbeitrag",
].map((name, index) => [
  name,
  {
    kind: "cash",
    amount: [60, -30, 15, 20, -25, 12, -15, 20, -10, 10, -30, 15][index],
  },
]);
chances.push(
  ["Portfolioausschüttung", { kind: "portfolio", amount: 2 }],
  ["Vermögensabgabe", { kind: "portfolio", amount: -2 }],
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

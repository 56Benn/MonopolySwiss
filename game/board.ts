export const M = 100_000_000;
export const tokens = ["Gipfel", "Bus", "Uhr", "Koffer", "Turm", "Diamant"];
/** Kräftige, klar unterscheidbare Farben; kein Weiss, da es auf Brett und Feldern verschwindet. */
export const tokenColors = [
  "#e5483b",
  "#f2b230",
  "#27a866",
  "#2f7fe0",
  "#d4469e",
  "#8a55e0",
];
export const groups = [
  "ICT (CH)",
  "Uhren & Luxus",
  "Lebensmittel",
  "Industrie",
  "Banken & Versicherungen",
  "Life Sciences",
  "Automobilindustrie (international)",
  "ICT (international)",
  "Flughafen",
  "Beteiligung",
] as const;
export const colours = [
  "#d45646",
  "#d69c47",
  "#739759",
  "#468f9e",
  "#b58950",
  "#68aa95",
  "#8b81a5",
  "#517da9",
  "#657879",
  "#9b7662",
];
export type Tile = {
  id: number;
  name: string;
  short: string;
  group: number;
  base: number;
};
const rows: [string, string, number, number][] = [
  ["START", "START", -1, 0],
  ["Logitech International", "Logitech", 0, 30],
  ["Ereignis", "Ereignis", -1, 0],
  ["Swisscom", "Swisscom", 0, 36],
  ["Einkommenssteuer", "Steuer", -1, 20],
  ["Flughafen Genf", "Airport Genf", 8, 60],
  ["Swatch Group", "Swatch", 1, 46],
  ["Chance", "Chance", -1, 0],
  ["Richemont", "Richemont", 1, 50],
  ["Rolex", "Rolex", 1, 54],
  ["Gefängnis / Nur zu Besuch", "Besuch", -1, 0],
  ["Bell Food Group", "Bell", 2, 62],
  ["VC Fintech", "Fintech", 9, 60],
  ["Barry Callebaut", "Callebaut", 2, 66],
  ["Nestlé", "Nestlé", 2, 72],
  ["Flughafen Basel-Mulhouse", "Airport Basel", 8, 65],
  ["Georg Fischer", "Georg Fischer", 3, 80],
  ["Ereignis", "Ereignis", -1, 0],
  ["Schindler", "Schindler", 3, 84],
  ["ABB", "ABB", 3, 90],
  ["Casino", "Casino", -1, 0],
  ["UBS", "UBS", 4, 98],
  ["Chance", "Chance", -1, 0],
  ["Zurich Insurance", "Zurich", 4, 102],
  ["Swiss Re", "Swiss Re", 4, 108],
  ["Flughafen Zürich", "Airport Zürich", 8, 70],
  ["Novartis", "Novartis", 5, 116],
  ["Roche", "Roche", 5, 120],
  ["VC Climate Tech", "Climate Tech", 9, 80],
  ["Syngenta", "Syngenta", 5, 126],
  ["Gehe ins Gefängnis", "Haft", -1, 0],
  ["General Motors", "GM", 6, 136],
  ["Volkswagen Group", "Volkswagen", 6, 140],
  ["Ereignis", "Ereignis", -1, 0],
  ["Toyota Motor Corporation", "Toyota", 6, 148],
  ["Los Angeles International Airport", "Airport LAX", 8, 75],
  ["Chance", "Chance", -1, 0],
  ["Microsoft", "Microsoft", 7, 165],
  ["Vermögenssteuer", "Steuer", -1, 30],
  ["Apple", "Apple", 7, 180],
];
export const board: Tile[] = rows.map(([name, short, group, price], id) => ({
  id,
  name,
  short,
  group,
  base: price * M,
}));
export function rate(amount: number, bps: number) {
  if (
    !Number.isSafeInteger(amount) ||
    !Number.isSafeInteger(bps) ||
    amount < 0 ||
    bps < 0
  )
    throw Error("Ungültiger Betrag");
  const result = Number((BigInt(amount) * BigInt(bps) + 5000n) / 10000n);
  if (!Number.isSafeInteger(result)) throw Error("Betragsgrenze erreicht");
  return result;
}
export const money = (value: number) => {
  const millions = value / M;
  return Math.abs(millions) >= 1000
    ? `${(millions / 1000).toLocaleString("de-CH", { maximumFractionDigits: 2 })}B`
    : `${millions.toLocaleString("de-CH", { maximumFractionDigits: 2 })}M`;
};
/** Marktwerte bleiben innerhalb 70–150 % des Startwerts, damit die Brettprogression erhalten bleibt. */
export const marketBand = [7000, 15000] as const;
export const startBonus = 80 * M;
/** Zusatz bei START für Plätze unter der Hälfte des durchschnittlichen Nettovermögens. */
export const recoveryBonus = 40 * M;
/** Steuerfelder: Anteil in Basispunkten von Bargeld bzw. Nettovermögen; tile.base ist der Mindestbetrag. */
export const taxes: Record<number, { bps: number; basis: "cash" | "worth"; label: string }> = {
  4: { bps: 1000, basis: "cash", label: "10 % des Bargelds" },
  38: { bps: 400, basis: "worth", label: "4 % des Nettovermögens" },
};

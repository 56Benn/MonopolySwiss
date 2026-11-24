import { M, taxes, tokenColors, type Tile } from "../game/board";

type Plate = {
  paper: string;
  ink: string;
  accent: string;
  cut: string;
  second: string;
  light: string;
};

function plate(
  paper: string,
  ink: string,
  accent: string,
  cut: string,
  second: string,
  light: string,
): Plate {
  return { paper, ink, accent, cut, second, light };
}

// Original two-colour engravings on a common 64 x 44 printing plate.
const industries = [
  plate(
    "#c9e2dd",
    "#183e43",
    "#317c78",
    "M7 39 23 22 32 31 43 20 61 39Z M26 34 31 10H34L40 34H36L33 24 30 34Z",
    "M21 5Q10 13 17 24L20 22Q15 13 24 8Z M43 5Q54 13 47 24L44 22Q49 13 40 8Z M26 10Q19 15 24 20L26 18Q24 15 28 13Z M38 10Q45 15 40 20L38 18Q40 15 36 13Z",
    "M17 33 23 25 27 30 23 29Z M42 26 44 23 49 30Z",
  ),
  plate(
    "#e4cbb4",
    "#493329",
    "#92582e",
    "M26 2H38L40 11H24Z M24 33H40L38 42H26Z M32 7A15 15 0 1 1 31.99 7Z M47 18H51V24H47Z",
    "M32 11A11 11 0 1 1 31.99 11Z",
    "M31 13H33V21L40 25 38 27 31 23Z M22 21H25V23H22Z M39 21H42V23H39Z",
  ),
  plate(
    "#dde1bc",
    "#344525",
    "#718342",
    "M4 35Q21 20 37 30T61 29V40H4Z M29 29V6H32V30Z",
    "M30 20Q18 19 18 11Q29 11 30 20Z M32 16Q42 15 44 7Q34 7 32 16Z M30 12Q22 9 23 3Q30 5 30 12Z",
    "M6 38Q21 27 37 33T59 32V34Q44 41 33 35T8 40Z",
  ),
  plate(
    "#c6d6d7",
    "#223e4b",
    "#4a7582",
    "M4 38V21L17 14V21L29 14V21L41 14V26H58V38Z M45 24 46 5H52L54 24Z",
    "M43 7H54V10H43Z M7 32H56V36H7Z",
    "M9 26H14V29H9Z M19 26H24V29H19Z M29 26H34V29H29Z M39 28H44V31H39Z",
  ),
  plate(
    "#e0d4b8",
    "#453b29",
    "#987739",
    "M3 16 32 3 61 16V19H3Z M9 21H15V34H9Z M22 21H28V34H22Z M36 21H42V34H36Z M49 21H55V34H49Z M5 35H59V39H5Z",
    "M12 15 32 7 52 15Z M2 40H62V42H2Z",
    "M30 9H34V11H36V14H33V16H31V14H28V11H30Z",
  ),
  plate(
    "#c4ddcb",
    "#254b43",
    "#478678",
    "M18 3H38V7H35V17L46 32Q50 40 41 41H15Q7 39 11 32L22 16V7H18Z M47 8H51V13H56V17H51V22H47V17H42V13H47Z",
    "M25 8H32V18L37 25H20L25 18Z M17 30H39L42 36H14Z",
    "M23 32H26V35H23Z M31 29H34V32H31Z",
  ),
  plate(
    "#d9cedd",
    "#3e354e",
    "#80668a",
    "M3 27 13 23 22 12H39L48 23 59 26V32H4Z M17 26A6 6 0 1 1 16.99 26Z M48 26A6 6 0 1 1 47.99 26Z",
    "M23 15H29V22H17Z M32 15H38L44 22H32Z M5 35H59V37H5Z",
    "M17 30A2 2 0 1 1 16.99 30Z M48 30A2 2 0 1 1 47.99 30Z",
  ),
  plate(
    "#c7d9e7",
    "#203c58",
    "#537992",
    "M16 8H48V36H16Z M20 3H23V8H20Z M30 3H33V8H30Z M40 3H43V8H40Z M20 36H23V41H20Z M30 36H33V41H30Z M40 36H43V41H40Z M9 13H16V16H9Z M9 23H16V26H9Z M48 13H55V16H48Z M48 23H55V26H48Z",
    "M21 13H43V31H21Z",
    "M25 17H39V19H27V27H25Z M32 23H38V27H32Z",
  ),
  plate(
    "#cedbe1",
    "#223f52",
    "#52788a",
    "M3 25 26 19 41 5 47 4 38 17 57 13Q62 12 61 16L37 24 31 38 26 39 28 26 12 30Z",
    "M3 36H22V38H3Z M7 41H35V43H7Z M44 30H60V32H44Z",
    "M21 23 42 17 37 21Z",
  ),
  plate(
    "#dbd3bc",
    "#354338",
    "#73825c",
    "M5 38V27H15V38Z M22 38V22H32V38Z M39 38V15H49V38Z M3 39H57V42H3Z",
    "M4 20 19 11 28 14 46 4 43 2H55L51 13 49 8 29 20 20 16 6 25Z",
    "M8 29H11V36H8Z M25 24H28V36H25Z M42 17H45V36H42Z",
  ),
];
const corners = {
  start: plate(
    "#265747",
    "#f9edcb",
    "#daae5f",
    "M4 34 16 17 23 25 36 6 57 34Z",
    "M2 36H42V30L60 37 42 44V39H2Z",
    "M25 23 36 8 43 19 37 16 34 20 33 17Z",
  ),
  jail: plate(
    "#344554",
    "#f6e8c9",
    "#dbad69",
    "M7 40V17Q7 3 31 3Q56 3 56 17V40H48V18Q48 9 32 9Q16 9 16 18V40Z M19 15H22V38H19Z M30 12H33V38H30Z M41 15H44V38H41Z",
    "M5 38H59V42H5Z M15 25H49V28H15Z",
    "M8 18H13V21H8Z M50 18H55V21H50Z",
  ),
  casino: plate(
    "#6b3741",
    "#fff0d4",
    "#e0ac63",
    "M4 11 23 4 34 31 14 38Z M21 6 41 3 47 32 26 36Z",
    "M34 10 54 13 49 41 29 37Z M2 35Q8 31 15 34V38Q9 42 2 38Z",
    "M42 16 47 24 40 30 36 22Z M9 14 13 11 17 16 13 19Z",
  ),
  transfer: plate(
    "#3c4659",
    "#f6e8cf",
    "#e5ad6a",
    "M7 10H27V15H7Z M4 19H22V23H4Z M10 28H29V32H10Z M38 5H58V39H38Z",
    "M24 13 38 21 24 30V24H15V19H24Z",
    "M41 10H44V31H41Z M48 10H51V31H48Z",
  ),
  chance: plate(
    "#753f36",
    "#fff0d9",
    "#e8b777",
    "M10 15 27 5 43 30 25 40Z",
    "M27 5 51 9 45 38 22 34Z",
    "M36 11Q47 11 45 18Q44 21 39 23L38 26 34 25 35 20Q43 17 40 15Q37 13 34 17L31 15Q32 12 36 11Z M34 28H38V32H34Z",
  ),
  event: plate(
    "#254c52",
    "#e8efdf",
    "#efbf76",
    "M9 7H48V35H52V14H57V36Q57 40 52 40H13Q9 40 9 36Z",
    "M15 13H43V16H15Z M15 21H28V31H15Z M32 20H43V23H32Z M32 27H43V30H32Z",
    "M16 34H42V36H16Z",
  ),
  tax: plate(
    "#52483e",
    "#f7edd6",
    "#e4b86e",
    "M8 27Q17 22 27 27V36Q17 42 8 36Z M27 21Q37 16 47 21V32Q37 38 27 32Z",
    "M37 3H55V21L51 19 48 22 45 19 41 21 37 19Z M7 31Q17 36 27 31V33Q17 38 7 33Z",
    "M40 8H52V10H40Z M40 13H49V15H40Z",
  ),
};

export function fieldPrint(tile: Tile, owner?: number) {
  const design =
    industries[tile.group] ??
    (tile.id === 0
      ? corners.start
      : tile.id === 10
        ? corners.jail
        : tile.id === 20
          ? corners.casino
          : tile.id === 30
            ? corners.transfer
            : tile.name === "Chance"
              ? corners.chance
              : tile.name === "Ereignis"
                ? corners.event
                : corners.tax);
  const neutral = "#e9e9e7";
  const tint = tokenColors[owner ?? -1];
  const paper = tint
    ? "#" + [1, 3, 5].map((offset) => {
        const channel = (hex: string) => parseInt(hex.slice(offset, offset + 2), 16);
        return Math.round(channel(neutral) * 0.82 + channel(tint) * 0.18)
          .toString(16).padStart(2, "0");
      }).join("")
    : neutral;
  return { ...design, paper, ink: "#303538", accent: "#808585" };
}
export const fieldName = (tile: Tile) =>
  tile.id === 10 ? "Gefängnis" : tile.short;
export const fieldAmount = (value: number) => {
  const millions = value / M;
  return millions >= 1000 ? `${(millions / 1000).toLocaleString("de-CH", { maximumFractionDigits: 1 })}B` : `${millions.toLocaleString("de-CH", { maximumFractionDigits: 1 })}M`;
};
/** Preisaufdruck eines Felds; Steuerfelder zeigen ihren Prozentsatz. */
export const fieldPrice = (tile: Tile, value: number) =>
  taxes[tile.id] ? `${taxes[tile.id].bps / 100} %` : fieldAmount(value);

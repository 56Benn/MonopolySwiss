export const speedFaces = ["", "1", "2", "3", "Bus", "Bus", "Freifeld"];
export const diceText = (dice: number[], total: number) =>
  `${total} (${dice.map((value, index) => (index === 2 ? speedFaces[value] : value)).join("+")})`;
export const revealMs = 1200;
export const moveMs = 2000;
export const stepMs = 260;
export const travelTime = (steps: number, transfer=false) => transfer ? Math.max(900, Math.min(steps, 40) * stepMs) : moveMs + Math.max(1,Math.min(steps, 40)) * stepMs;

export function rollDistance(
  dice: number[],
  start: number,
  purchasable: boolean[],
) {
  const [first, second, speed = 0] = dice;
  const normal = first + second;
  if (speed < 4) return normal + speed;
  if (speed < 6) return Math.max(first, second);
  for (let offset = 0; offset < purchasable.length; offset++) {
    if (purchasable[(start + normal + offset) % purchasable.length])
      return normal + offset;
  }
  return normal;
}

export function casinoSlots(count: number) {
  const columns = 6;
  const rows = Math.ceil(count / columns);
  const scale = Math.min(1, 1.95 / Math.max(1, rows * 1.06));
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const length = Math.min(columns, count - row * columns);
    return {
      xx: (index % columns - (length - 1) / 2) * 0.86 * scale,
      zz: 0.98 + (row - (rows - 1) / 2) * 1.06 * scale,
      scale,
    };
  });
}
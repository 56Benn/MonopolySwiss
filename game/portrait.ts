export const portraitSize = 48;
export const validPortrait = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length === portraitSize ** 2 * 4 &&
  !/[^A-Za-z0-9+/]/.test(value);

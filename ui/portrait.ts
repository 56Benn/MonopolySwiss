import { portraitSize, validPortrait } from "../game/portrait";

export async function makePortrait(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw Error("Bitte ein JPG-, PNG- oder WebP-Bild bis 8 MB wählen.");
  const image = await createImageBitmap(file);
  try {
    const side = Math.min(image.width, image.height),
      canvas = document.createElement("canvas");
    canvas.width = canvas.height = portraitSize;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#294438";
    ctx.fillRect(0, 0, portraitSize, portraitSize);
    ctx.drawImage(
      image,
      (image.width - side) / 2,
      (image.height - side) / 2,
      side,
      side,
      0,
      0,
      portraitSize,
      portraitSize,
    );
    const pixels = ctx.getImageData(0, 0, portraitSize, portraitSize).data;
    let rgb = "";
    for (let index = 0; index < pixels.length; index += 4)
      rgb += String.fromCharCode(
        pixels[index],
        pixels[index + 1],
        pixels[index + 2],
      );
    return btoa(rgb);
  } finally {
    image.close();
  }
}
const previews = new Map<string, string>();
export function portraitUrl(photo: string) {
  if (!validPortrait(photo)) return undefined;
  if (!previews.has(photo)) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = portraitSize;
    const ctx = canvas.getContext("2d")!,
      data = ctx.createImageData(portraitSize, portraitSize),
      raw = atob(photo);
    for (let index = 0; index < raw.length / 3; index++)
      data.data.set(
        [
          raw.charCodeAt(index * 3),
          raw.charCodeAt(index * 3 + 1),
          raw.charCodeAt(index * 3 + 2),
          255,
        ],
        index * 4,
      );
    ctx.putImageData(data, 0, 0);
    if (previews.size >= 12) previews.delete(previews.keys().next().value!);
    previews.set(photo, canvas.toDataURL());
  }
  return previews.get(photo);
}

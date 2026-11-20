import { board, type Tile } from "../game/board";
import locations from "./sites.json";

const sites: Record<number, (string | number)[]> = locations;
export const siteCaption = (id: number) => sites[id]?.[0] as string | undefined;
export const isSurveyPhoto = (id: number) => typeof sites[id]?.[1] === "number";
export const sitePhoto = (id: number, small = false) =>
  sites[id] ? `/orte/${id}${small ? "-klein" : ""}.webp` : undefined;

export const companyLogo = (tile: Tile) =>
  tile.group >= 0 && tile.group < 8 ? `/logos/${tile.id}.png` : undefined;

let pending: Promise<Map<number, HTMLImageElement>> | undefined;

export function loadFieldImages() {
  return pending ??= (async () => {
    const images = new Map<number, HTMLImageElement>();
    await Promise.all(board.map(async (tile) => {
      for (const source of [sitePhoto(tile.id, true), companyLogo(tile)]) {
        if (!source) continue;
        const image = new Image();
        image.src = source;
        try {
          await image.decode();
          images.set(tile.id, image);
          return;
        } catch {
          continue;
        }
      }
    }));
    return images;
  })();
}
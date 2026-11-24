import * as THREE from "three";
import { board, colours, tokenColors } from "../game/board";
import { fieldAmount, fieldName, fieldPrice, fieldPrint } from "../ui/fieldPrint";
import { boardIdentity } from "../ui/boardIdentity";
export const pos = (id: number): [number, number] => {
  const side = Math.floor(id / 10),
    step = id % 10,
    offset = step === 0 ? 5.55 : 5 - step;
  return (
    [
      [offset, 5.55],
      [-5.55, offset],
      [-offset, -5.55],
      [5.55, -offset],
    ] as [number, number][]
  )[side];
};
const gold = boardIdentity.brass;
function line(
  ctx: CanvasRenderingContext2D,
  points: number[][],
  color: string,
  width: number,
) {
  ctx.beginPath();
  points.forEach(([xx, yy], index) =>
    index ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy),
  );
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = 700,
) {
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${weight} ${size}px Arial`;
  ctx.fillText(text, x, y);
}
export function boardArt(values: number[], owners: number[], logos?: ReadonlyMap<number, HTMLImageElement>, rents: number[] = []) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 2048;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2048 / 12.5, 2048 / 12.5);
  ctx.translate(6.25, 6.25);
  ctx.fillStyle = "#efe8d4";
  ctx.fillRect(-6.25, -6.25, 12.5, 12.5);
  const field = ctx.createLinearGradient(-5, -5, 5, 5);
  field.addColorStop(0, boardIdentity.feltLight);
  field.addColorStop(1, boardIdentity.feltDark);
  ctx.fillStyle = field;
  ctx.fillRect(-4.5, -4.5, 9, 9);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-4.47, -4.47, 8.94, 8.94);
  ctx.clip();
  ctx.strokeStyle = "#76a38a42";
  ctx.lineWidth = 0.009;
  for (let ring = 0; ring < 64; ring++) {
    ctx.beginPath();
    for (let point = 0; point <= 256; point++) {
      const angle = (point * Math.PI) / 128;
      const radius =
        0.125 *
        ring *
        (1 +
          0.1 * Math.sin(angle * 5) +
          0.07 * Math.sin(angle * 9 + ring * 0.025) +
          0.17 * Math.sin(angle * 2));
      const xx = -3.9 + radius * Math.cos(angle),
        yy = -2.7 + radius * Math.sin(angle) * 0.76;
      if (point) ctx.lineTo(xx, yy);
      else ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
  for (const inset of [4.42, 4.32]) {
    ctx.strokeStyle = gold;
    ctx.lineWidth = 0.014;
    ctx.strokeRect(-inset, -inset, inset * 2, inset * 2);
  }
  ctx.save();
  ctx.translate(0, -0.2);
  boardIdentity.ridges.forEach((ridge, index) => line(ctx, ridge, gold, index ? 0.028 : 0.055));
  label(ctx, "S W I S S", 0, 0.17, 0.48, "#ede5ca");
  label(ctx, "MARKET", 0, 0.97, 1.08, "#f3ead4", 800);
  label(ctx, "B O U R S E   H E L V É T I Q U E", 0, 1.86, 0.13, gold);
  ctx.restore();
  for (const [x, y, rot] of [
    [-3.63, 3.55, 0],
    [3.59, -3.55, Math.PI],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    label(ctx, "✦", 0, 0, 0.4, gold);
    ctx.restore();
  }
  for (const tile of board) {
    const [xx, yy] = pos(tile.id);
    ctx.save();
    ctx.translate(xx, yy);
    ctx.rotate((Math.floor(tile.id / 10) * Math.PI) / 2);
    const corner = tile.id % 10 === 0,
      special = tile.group < 0;
    const print = fieldPrint(tile, owners[tile.id]);
    const width = corner ? 175 : 100;
    ctx.translate(corner ? -1.05 : -0.5, -1.05);
    ctx.scale(0.01, 0.01);
    ctx.fillStyle = print.paper;
    ctx.fillRect(0, 0, width, 175);
    ctx.strokeStyle = "#25382e";
    ctx.lineWidth = 1.6;
    ctx.strokeRect(0.8, 0.8, width - 1.6, 173.4);
    ctx.fillStyle = colours[tile.group] ?? print.accent;
    ctx.fillRect(2, 2, width - 4, 7);
    if(owners[tile.id]>=0){ctx.strokeStyle=tokenColors[owners[tile.id]];ctx.lineWidth=4;ctx.strokeRect(4,4,width-8,167);}
    ctx.fillStyle = print.ink;
    ctx.font = "bold 11px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(String(tile.id).padStart(2, "0"), 7, 18);
    const scale = corner ? 1.95 : 1.22;
    ctx.save();
    ctx.translate((width - 64 * scale) / 2, corner ? 27 : 30);
    ctx.scale(scale, scale);
    const logo = logos?.get(tile.id);
    if (logo) {
      const factor = Math.min(64 / logo.naturalWidth, 44 / logo.naturalHeight);
      const logoWidth = logo.naturalWidth * factor, logoHeight = logo.naturalHeight * factor;
      ctx.drawImage(logo, (64 - logoWidth) / 2, (44 - logoHeight) / 2, logoWidth, logoHeight);
    } else for (const [path, color] of [
      [print.cut, print.ink],
      [print.second, print.accent],
      [print.light, print.paper],
    ]) {
      ctx.fillStyle = color;
      ctx.fill(new Path2D(path));
    }
    ctx.restore();
    const title = fieldName(tile);
    ctx.fillStyle = print.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${corner ? 34 : 28}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
    ctx.fillText(title, width / 2, corner ? 128 : 103, width - 12);
    if (!corner) {
      line(
        ctx,
        [
          [10, 127],
          [width - 10, 127],
        ],
        print.accent,
        1.6,
      );
      ctx.font = `bold ${special ? 13 : 18}px sans-serif`;
      ctx.fillText(
        tile.base ? fieldPrice(tile, values[tile.id] ?? tile.base) : "KARTE",
        width / 2,
        149,
        width - 16,
      );
      if (rents[tile.id] > 0) {
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = "#7a3324";
        ctx.fillText(`Miete ${fieldAmount(rents[tile.id])}`, width / 2, 165, width - 12);
        ctx.fillStyle = print.ink;
      }
    } else {
      line(
        ctx,
        [
          [width / 2 - 36, 150],
          [width / 2 + 36, 150],
        ],
        print.accent,
        2,
      );
    }
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

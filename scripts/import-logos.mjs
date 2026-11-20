import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const sources = new Map([
  [1, "Logitech logo.svg"], [3, "Swisscom Logo 2025.svg"],
  [6, "Swatch Group.svg"], [8, "Richemont Logo.svg"], [9, "Rolex wordmark logo.svg"],
  [11, "BellFoodGroup Logo RGB.png"], [13, "Barry Callebaut logo.svg"], [14, "Nestlé textlogo.svg"],
  [16, "Georg Fischer logo.svg"], [18, "Web big-Schindler Logo Original (RGB) (1).jpg"], [19, "ABB logo.svg"],
  [21, "UBS Logo.png"], [23, "Zurich Insurance Group logo.svg"], [24, "Swiss Re Logo.svg"],
  [26, "Novartis-Logo.svg"], [27, "Hoffmann-La Roche logo.svg"], [29, "Syngenta logo.svg"],
  [31, "General Motors (2021).svg"], [32, "Volkswagen Group Logo 2023.svg"], [34, "Toyota logo.svg"],
  [37, "Microsoft icon.svg"], [39, "Apple logo black.svg"],
]);

const destination = new URL("../public/logos/", import.meta.url);
const api = new URL("https://commons.wikimedia.org/w/api.php");
api.search = new URLSearchParams({action: "query", format: "json", formatversion: "2", prop: "imageinfo", iiprop: "url|mime|extmetadata", iiurlwidth: "250", iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl|Attribution", titles: [...sources.values()].map(name => `File:${name}`).join("|")}).toString();
async function download(url) {
  let response;
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(url, {headers: {"User-Agent": "SwissMarketLocal/1.0 (local board game; attributed logo thumbnails)"}, signal: AbortSignal.timeout(30000)});
    if (response.status !== 429 && response.status !== 503) break;
    const header = response.headers.get("retry-after");
    const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? (Date.parse(header) - Date.now()) / 1000 : 10 * (attempt + 1);
    if (!Number.isFinite(seconds) || seconds > 90 || attempt === 3) break;
    await response.body?.cancel();
    console.log(`Abrufpause: ${Math.max(1, Math.ceil(seconds))} s`);
    await delay(Math.max(1000, seconds * 1000));
  }
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}
const {query} = await (await download(api)).json();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const credits = ["SWISS MARKET | Bildnachweise", "Die Marken dienen der Identifikation der Spielfelder. Es besteht keine Verbindung zu den Unternehmen.", "Bearbeitung: auf die sichtbare Grafik zugeschnitten, verkleinert und als PNG gespeichert. Markenrechte bleiben unberuehrt.", ""];
  await mkdir(destination, {recursive: true});
  for (const [id, name] of sources) {
    const info = query.pages.find(entry => entry.title === `File:${name}`)?.imageinfo?.[0];
    const meta = info?.extmetadata;
    const license = meta?.LicenseShortName?.value;
    if (!["Public domain", "CC BY-SA 4.0"].includes(license)) throw new Error(`Unverified source: ${name} (${license})`);
    const preview = new URL(info.thumburl || info.url);
    preview.search = "";
    const response = await download(preview);
    const bytes = Buffer.from(await response.arrayBuffer());
    const result = await page.evaluate(async ({url, credit}) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = 768 / Math.max(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const {data} = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let left = canvas.width, right = -1, top = canvas.height, bottom = -1;
      for (let py = 0; py < canvas.height; py++) for (let px = 0; px < canvas.width; px++) {
        const index = 4 * (py * canvas.width + px);
        if (data[index + 3] < 20 || Math.min(data[index], data[index + 1], data[index + 2]) > 244) continue;
        left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py);
      }
      if (right < left) throw new Error("Empty logo");
      const width = right - left + 1, height = bottom - top + 1;
      const thumbnail = document.createElement("canvas");
      const factor = 256 / Math.max(width, height);
      thumbnail.width = Math.max(1, Math.round(width * factor)); thumbnail.height = Math.max(1, Math.round(height * factor));
      const out = thumbnail.getContext("2d");
      out.imageSmoothingQuality = "high";
      out.drawImage(canvas, left, top, width, height, 0, 0, thumbnail.width, thumbnail.height);
      const template = document.createElement("template");
      template.innerHTML = credit;
      return { png: thumbnail.toDataURL("image/png").split(",")[1], artist: template.content.textContent.trim().replace(/\s+/g, " ") };
    }, {url: `data:${response.headers.get("content-type")};base64,${bytes.toString("base64")}`, credit: id === 31 ? "General Motors Company" : meta.Attribution?.value || meta.Artist?.value || ""});
    if (license !== "Public domain" && !result.artist) throw new Error(`Missing attribution: ${name}`);
    await writeFile(new URL(`${id}.png`, destination), Buffer.from(result.png, "base64"));
    credits.push(`Feld ${id}: ${name}`, `${result.artist || name} | ${license}${meta.LicenseUrl?.value ? " | " + meta.LicenseUrl.value : ""}`, info.descriptionurl, "");
    console.log(`${id}: ${name} (${license})`);
    await delay(1100);
  }
  await writeFile(new URL("quellen.txt", destination), credits.join("\n"));
} finally {
  await browser.close();
}
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import sites from "../ui/sites.json" with { type: "json" };

const dest = new URL("../public/orte/", import.meta.url);
async function get(url) {
  const response = await fetch(url, {headers: {"User-Agent": "SwissMarketLocal/1.0 (educational board game site photographs)"}, signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw Error(`${response.status} ${url}`);
  return response;
}
const api = new URL("https://commons.wikimedia.org/w/api.php");
api.search = new URLSearchParams({action:"query", format:"json", formatversion:"2", prop:"imageinfo", iiprop:"url|extmetadata", iiurlwidth:"500", iiextmetadatafilter:"Artist|Attribution|LicenseShortName|LicenseUrl", titles:Object.values(sites).filter(([, source]) => typeof source === "string").map(([, name]) => `File:${name}`).join("|")});
const {query} = await (await get(api)).json();
const escape = text => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const link = (url, label) => `<a href="${escape(url)}">${escape(label)}</a>`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const credits = [];
  await mkdir(dest, {recursive:true});
  for (const [id, [caption, source, north, lei]] of Object.entries(sites)) {
    let url, credit;
    if (typeof source === "number") {
      url = new URL("https://wms.geo.admin.ch/");
      url.search = new URLSearchParams({SERVICE:"WMS", VERSION:"1.3.0", REQUEST:"GetMap", LAYERS:"ch.swisstopo.swissimage", STYLES:"", CRS:"EPSG:2056", BBOX:[source-96,north-64,source+96,north+64].join(","), WIDTH:"600", HEIGHT:"400", FORMAT:"image/jpeg"});
      credit = `© swisstopo, ${link("https://www.swisstopo.admin.ch/", "Bundesamt für Landestopografie")} · ${link(url, "SWISSIMAGE – Bildausschnitt")} · ${link("https://opendata.swiss/en/terms-of-use", "Freie Nutzung mit Quellenangabe")} · ${link(`https://search.gleif.org/#/record/${lei}`, "Hauptsitzanschrift")}`;
    } else {
      const info = query.pages.find(file => file.title === `File:${source}`)?.imageinfo?.[0];
      const meta = info?.extmetadata;
      const license = meta?.LicenseShortName?.value;
      if (!/^(CC BY(?:-SA)? [234]\.0|Public domain|CC0|Copyrighted free use)$/.test(license ?? "")) throw Error(`Ungeprüfte Lizenz: ${source}: ${license}`);
      const author = await page.evaluate(html => {
        const template = document.createElement("template");
        template.innerHTML = html;
        template.content.querySelectorAll("style,script").forEach(node => node.remove());
        return template.content.textContent.trim().replace(/\s+/g," ");
      }, meta.Attribution?.value || meta.Artist?.value || "");
      if (!author && license.startsWith("CC BY")) throw Error(`Namensnennung fehlt: ${source}`);
      url = new URL(info.thumburl);
      url.search = "";
      credit = `${escape(author)} · ${link(info.descriptionurl, source)} · ${link(meta.LicenseUrl?.value || info.descriptionurl, license)}`;
    }
    const response = await get(url);
    const bytes = Buffer.from(await response.arrayBuffer());
    const results = await page.evaluate(async data => {
      const image = new Image(); image.src = data; await image.decode();
      const width = image.naturalWidth, height = image.naturalHeight;
      if (Math.min(width,height) < 100) throw Error("Keine brauchbare Standortaufnahme");
      return [true, false].map(small => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 600 / Math.max(width,height));
        canvas.width = small ? 128 : Math.round(width * scale);
        canvas.height = small ? 88 : Math.round(height * scale);
        const ctx = canvas.getContext("2d"); ctx.imageSmoothingQuality = "high";
        const fit = Math.max(canvas.width/width, canvas.height/height);
        ctx.drawImage(image, (canvas.width-width*fit)/2, (canvas.height-height*fit)/2, width*fit, height*fit);
        return canvas.toDataURL("image/webp", 0.84).split(",")[1];
      });
    }, `data:${response.headers.get("content-type")};base64,${bytes.toString("base64")}`);
    await Promise.all(results.map((data,index) => writeFile(new URL(`${id}${index === 0 ? "-klein" : ""}.webp`,dest),Buffer.from(data,"base64"))));
    credits.push(`<li id="feld-${id}"><strong>${escape(caption)}</strong><br>${credit}</li>`);
    console.log(`Feld ${id}: ${caption}`);
    await delay(1100);
  }
  await writeFile(new URL("quellen.html",dest), `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Standortfotos | Swiss Market</title><style>body{font:1rem/1.6 sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem}li{margin:1rem 0;overflow-wrap:anywhere}li:target{background:#edf1e8}</style><main><h1>Standortfotos</h1><p>Für Swiss Market verkleinert und als WebP gespeichert. Die Brettminiaturen sind mittige Ausschnitte. Für jede Bildfassung gelten die beim Foto genannten Nutzungsbedingungen.</p><ol>${credits.join("\n")}</ol></main></html>`);
} finally {
  await browser.close();
}
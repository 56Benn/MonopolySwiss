import { test, expect, type Page } from "@playwright/test";
import { newGame, player } from "../../game/model";
import { M } from "../../game/board";
import type { View } from "../../game/view";
import type { Command } from "../../game/model";
declare global {
  interface Window {
    marketSocket?: WebSocket;
    testStream?: MediaStream;
  }
}
async function loadLocal(page: Page, state: ReturnType<typeof newGame>) {
  await page.goto("/");
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keyval-store", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("keyval");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("keyval", "readwrite");
      tx.objectStore("keyval").put(state, "swiss-market:local:v1");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    localStorage.setItem("sm-mode", "local");
    localStorage.setItem("sm-board-style", "photos");
  }, state);
  await page.reload();
}
const fixedDice = (page: Page) => page.evaluate(() => {
  const original = crypto.getRandomValues.bind(crypto);
  Object.defineProperty(crypto, "getRandomValues", { value: (array: Uint32Array) => array instanceof Uint32Array && array.length === 1 ? array.fill(0) : original(array) });
});
const table = (limit: 0 | 90 = 0) => {
  const anna = player("anna", "Anna", 0), ben = player("ben", "Ben", 1, "Mittel");
  anna.cash = ben.cash = 500 * M;
  const game = newGame(anna);
  game.players.push(ben);
  game.phase = "roll";
  game.round = 1;
  game.settings.limit = limit;
  return game;
};
const phone = (page: Page) => page.getByRole("complementary", { name: "Spielhandy" });
async function swipe(page: Page) {
  const knob = phone(page).getByRole("slider", { name: "Überweisung bestätigen" });
  const track = (await knob.locator("xpath=..").boundingBox())!, box = (await knob.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width - 6, y, { steps: 12 });
  await page.mouse.up();
}

for (const [width, height] of [[1440, 940], [390, 844]]) test(`Startansicht ${width}px: nur Handy, Feldkarte ohne Sperre`, async ({ page }, info) => {
  await page.setViewportSize({ width, height });
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("sm-board-style", "photos"));
  await page.reload();
  await expect(page.locator(".desk-sidebar")).toHaveCount(0);
  await expect(phone(page).getByRole("button", { name: "Lokal gegen Bots" })).toBeVisible();
  const board = (await page.locator(".table-stage").boundingBox())!, device = (await page.locator(".device-frame").boundingBox())!;
  expect(width > 760 ? board.x + board.width <= device.x + 1 : board.y + board.height <= device.y + 1).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Feld 8: Richemont", exact: true }).click();
  const card = page.getByRole("dialog", { name: "Richemont" });
  await expect(card).toContainText("Grundmiete");
  await expect(card).toContainText("Startwert");
  await expect(card).toContainText("Ausbau je Stufe");
  await expect(card.locator(".site-photo")).toBeVisible();
  await expect(card.getByRole("button", { name: /Details/ })).toHaveCount(0);
  await card.screenshot({ path: info.outputPath(`feldkarte-${width}.png`) });
  if (width > 760) {
    await page.getByRole("button", { name: "Feld 25: Flughafen Zürich", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Flughafen Zürich" })).toContainText("Flughafen");
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".field-card")).toHaveCount(0);
  if (width > 760) {
    await phone(page).getByRole("button", { name: "Links" }).click();
    const left = (await page.locator(".device-frame").boundingBox())!, stage = (await page.locator(".table-stage").boundingBox())!;
    expect(left.x + left.width <= stage.x + 1).toBe(true);
    await phone(page).getByRole("button", { name: "Rechts" }).click();
  }
  await page.screenshot({ path: info.outputPath(`start-${width}.png`) });
});

test("Tisch-Tab: Zug, Route, Spielerliste, Abstimmungen und Transaktionen", async ({ page }, info) => {
  const game = table();
  game.players[1].pos = 15;
  game.decks[0] = ["E16"];
  await loadLocal(page, game);
  await fixedDice(page);
  const hand = phone(page), turn = hand.getByRole("region", { name: "Aktueller Zug" });
  await expect(page.locator(".turn-banner")).toContainText("Du bist am Zug");
  await expect(turn).toContainText("Du bist am Zug");
  await expect(turn).toContainText("Aktuelles Feld");
  await expect(turn.locator(".field-chip")).toHaveCount(1);
  const seats = hand.getByRole("region", { name: "Spieler am Tisch" });
  await expect(seats.locator(".seat-row")).toHaveCount(2);
  await expect(seats.locator(".seat-row").first().locator(".signal-bars")).toHaveAttribute("data-level", "4");
  await expect(seats.getByRole("button", { name: "Handel anbieten" })).toHaveCount(1);
  await expect(hand.getByRole("button", { name: "Für Pause stimmen" })).toBeVisible();
  await expect(hand.getByRole("button", { name: "Für Unentschieden stimmen" })).toBeVisible();
  await expect(hand.getByRole("button", { name: "Bankrott melden" })).toBeVisible();
  await hand.getByRole("button", { name: "Würfeln", exact: true }).click();
  await expect(turn).toContainText("Start");
  await expect(turn.getByText("Neues Feld")).toBeVisible({ timeout: 8000 });
  await expect(turn.getByText("Vorheriges Feld")).toBeVisible();
  await expect(turn.locator(".field-chip").last()).toContainText("Ereignis");
  await hand.screenshot({ path: info.outputPath("tisch-tab.png") });
  await hand.getByRole("button", { name: "Transaktionen ansehen" }).click();
  await expect(hand.getByRole("heading", { name: "Transaktionen" })).toBeVisible();
  await hand.getByRole("button", { name: "Portfolio", exact: true }).click();
  await hand.getByRole("button", { name: "Tisch", exact: true }).click();
  await expect(hand.getByRole("button", { name: "Transaktionen ansehen" })).toBeVisible();
});

test("Pflichtzahlung: Wischen mit Greif-Cursor, Bestätigung und Geldflug", async ({ page }, info) => {
  const game = table(90);
  game.phase = "debt";
  game.players[0].pos = 4;
  game.debt = { amount: 80 * M, to: null, reason: "Einkommenssteuer" };
  game.deadline = Date.now() + 10_000;
  await loadLocal(page, game);
  const hand = phone(page);
  await expect(hand.getByRole("heading", { name: "Banküberweisung" })).toBeVisible();
  await expect(hand.getByRole("timer")).toContainText(/Frist \d+ s/);
  await expect(hand.getByText("Zum Zahlen nach rechts wischen")).toBeVisible();
  const knob = hand.getByRole("slider", { name: "Überweisung bestätigen" });
  expect(await knob.evaluate((node) => getComputedStyle(node).cursor)).toBe("grab");
  const track = (await knob.locator("xpath=..").boundingBox())!;
  await page.mouse.click(track.x + track.width - 8, track.y + track.height / 2);
  await expect(knob).toBeVisible();
  await hand.screenshot({ path: info.outputPath("ueberweisung.png") });
  await swipe(page);
  await expect(hand.getByText("Zahlung ausgeführt")).toBeVisible();
  await expect(page.locator(".money-flight")).toContainText("80M");
  await expect(page.locator(".money-flight .flight-note")).toHaveCount(5);
  await hand.screenshot({ path: info.outputPath("bestaetigung.png") });
  await expect(hand.getByText("Zahlung ausgeführt")).toHaveCount(0, { timeout: 4000 });
  await expect(hand.locator("[data-balance]")).toHaveText("420M CHF", { timeout: 5000 });
  await hand.getByRole("button", { name: "Transaktionen ansehen" }).click();
  await expect(hand.locator(".ledger-row").first()).toContainText("Einkommenssteuer");
  await expect(hand.locator(".ledger-row").first()).toContainText("−80M");
});

test("Zahlung ohne Deckung: keine Frist, Beleihen, dann 10 Sekunden zum Bezahlen", async ({ page }, info) => {
  const game = table(90);
  game.phase = "debt";
  game.players[0].cash = 10 * M;
  game.assets[1].owner = game.assets[3].owner = "anna";
  game.debt = { amount: 40 * M, to: "ben", reason: "Miete Bell" };
  game.deadline = 0;
  await loadLocal(page, game);
  const hand = phone(page);
  await expect(hand.getByRole("heading", { name: "Finanzierung" })).toBeVisible();
  await expect(hand).toContainText("KEINE FRIST");
  await expect(hand.getByRole("timer")).toHaveCount(0);
  await expect(hand.getByRole("button", { name: "Bank finanzieren lassen" })).toBeVisible();
  await hand.screenshot({ path: info.outputPath("finanzierung.png") });
  await hand.locator(".finance-row").filter({ hasText: "Logitech" }).getByRole("button", { name: /Beleihen/ }).click();
  await expect(hand.getByRole("heading", { name: "Finanzierung" })).toBeVisible();
  await expect(hand.getByRole("timer")).toHaveCount(0);
  await hand.locator(".finance-row").filter({ hasText: "Swisscom" }).getByRole("button", { name: /Beleihen/ }).click();
  await expect(hand.getByRole("heading", { name: "Banküberweisung" })).toBeVisible();
  await expect(hand.getByRole("timer")).toContainText(/Frist (9|10) s/);
  await swipe(page);
  await expect(hand.getByText("Zahlung ausgeführt")).toBeVisible();
  await hand.getByRole("button", { name: "Portfolio", exact: true }).click();
  await expect(hand.locator(".holding").filter({ hasText: "Logitech" })).toContainText("fällig in 5 Runden (R6)");
});
test("Mitspieler sehen live, wie ein Bot Geld für eine Zahlung beschafft", async ({ page }, info) => {
  const game = table();
  game.turn = 1;
  game.phase = "debt";
  game.players[1].cash = 10 * M;
  game.assets[1].owner = game.assets[3].owner = "ben";
  game.debt = { amount: 40 * M, to: "anna", reason: "Miete Swatch" };
  game.deadline = 0;
  await loadLocal(page, game);
  const box = phone(page).locator(".funding-box");
  await expect(box).toContainText("Ben beschafft Geld");
  await expect(page.locator(".table-tag")).toContainText("Ben beschafft Geld für eine Zahlung");
  await expect(box.locator("li").first()).toContainText(/beleiht (Logitech|Swisscom)/);
  await box.screenshot({ path: info.outputPath("geldbeschaffung.png") });
  await expect(phone(page).locator("[data-balance]")).toHaveText("540M CHF", { timeout: 8000 });
});
test("Darlehen: Erinnerung im Handy eine Runde vor Fälligkeit", async ({ page }) => {
  const game = table();
  game.round = 4;
  game.assets[3].owner = "anna";
  game.assets[3].loan = 18 * M;
  game.assets[3].due = 5;
  await loadLocal(page, game);
  const alert = phone(page).locator(".loan-alert");
  await expect(alert).toContainText("Darlehen bald fällig");
  await expect(alert).toContainText("Swisscom: 19.8M · fällig nächste Runde (R5)");
  await alert.getByRole("button", { name: /Swisscom/ }).click();
  const card = page.getByRole("dialog", { name: "Swisscom" });
  await expect(card).toContainText("Rückzahlung");
  await card.getByRole("button", { name: /^Darlehen tilgen/ }).click();
  await expect(phone(page).getByRole("heading", { name: "Banküberweisung" })).toBeVisible();
  await swipe(page);
  await expect(phone(page).locator(".loan-alert")).toHaveCount(0, { timeout: 6000 });
});

test("Kauf: ohne genug Geld nur Passen, sonst Überweisung und Besitz", async ({ page }, info) => {
  const game = table();
  game.players[0].cash = 5 * M;
  game.players[0].pos = 1;
  game.phase = "buy";
  game.assets[3].owner = "anna";
  await loadLocal(page, game);
  const offer = page.locator(".table-stage").getByRole("dialog", { name: "Kaufentscheidung" });
  await page.keyboard.press("Escape");
  await expect(offer).toBeVisible();
  await expect(offer).toContainText("Nicht genug Geld");
  await expect(offer.getByRole("button", { name: /^Kaufen/ })).toBeDisabled();
  await expect(offer.getByRole("button", { name: "Passen" })).toBeEnabled();
  await offer.screenshot({ path: info.outputPath("kaufangebot-knapp.png") });
});
test("Kauf: mit Geld per Überweisung", async ({ page }) => {
  const rich = table();
  rich.players[0].pos = 1;
  rich.phase = "buy";
  rich.assets[3].owner = "anna";
  await loadLocal(page, rich);
  await page.locator(".table-stage").getByRole("button", { name: /^Kaufen/ }).click();
  const hand = phone(page);
  await expect(hand.getByRole("heading", { name: "Banküberweisung" })).toBeVisible();
  await swipe(page);
  await expect(hand.getByText("Zahlung ausgeführt")).toBeVisible();
  await expect(hand.locator(".seat-row").first()).toContainText("2 Firmen", { timeout: 6000 });
});
test("Kauf: Verzicht startet keine Auktion", async ({ page }) => {
  const second = table();
  second.players[0].pos = 1;
  second.phase = "buy";
  second.extra = true;
  await loadLocal(page, second);
  await page.getByRole("button", { name: "Passen" }).click();
  await expect(page.getByRole("dialog", { name: "Kaufentscheidung" })).toHaveCount(0);
  await expect(phone(page).getByRole("button", { name: "Würfeln", exact: true })).toBeVisible({ timeout: 6000 });
  await expect(page.getByLabel("Eigenes Gebot (in M)")).toHaveCount(0);
});

test("Ausbau sofort ohne Zahlungsseite, Sterne, kein Handel mit ausgebauter Branche, Leertaste würfelt", async ({ page }, info) => {
  const game = table();
  game.assets[1].owner = game.assets[3].owner = "anna";
  game.assets[6].owner = game.assets[8].owner = game.assets[9].owner = "ben";
  game.assets[6].levels = [20.7 * M];
  game.assets[8].levels = [22.5 * M];
  game.assets[9].levels = [24.3 * M];
  game.assets[11].owner = "ben";
  game.assets[11].levels = [25 * M, 25 * M];
  await loadLocal(page, game);
  await fixedDice(page);
  await page.getByRole("button", { name: "Feld 3: Swisscom", exact: true }).click();
  const card = page.getByRole("dialog", { name: "Swisscom" });
  await card.getByRole("button", { name: /^Ausbauen/ }).click();
  await expect(phone(page).getByRole("heading", { name: "Banküberweisung" })).toHaveCount(0);
  await expect(card).toContainText("1 Geldstapel");
  await expect(card.getByRole("button", { name: /Stufe verkaufen|An Bank verkaufen/ })).toHaveCount(0);
  const stars = page.locator('.flat-level[data-tile="3"]');
  await expect(stars).toHaveText("★");
  const starBox = (await stars.boundingBox())!, tileBox = (await page.getByRole("button", { name: "Feld 3: Swisscom", exact: true }).boundingBox())!;
  expect(starBox.y + starBox.height).toBeLessThanOrEqual(tileBox.y + 1);
  await expect(page.locator('.flat-level[data-tile="11"]')).toHaveText("★★");
  const side = (await page.locator('.flat-level[data-tile="11"]').boundingBox())!, bell = (await page.getByRole("button", { name: "Feld 11: Bell Food Group", exact: true }).boundingBox())!;
  expect(side.x).toBeGreaterThanOrEqual(bell.x + bell.width - 1);
  await page.locator(".photo-board").screenshot({ path: info.outputPath("sterne.png") });
  await expect(card.getByRole("button", { name: /^Ausbauen/ })).toBeDisabled();
  await card.screenshot({ path: info.outputPath("ausbau.png") });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Feld 8: Richemont", exact: true }).click();
  const foreign = page.getByRole("dialog", { name: "Richemont" });
  await expect(foreign).toContainText("nicht handelbar");
  await expect(foreign.getByRole("button", { name: /Handel/ })).toHaveCount(0);
  await expect(page.locator('button[aria-label="Feld 8: Richemont"] .tile-rent')).toContainText("Miete");
  await page.keyboard.press("Escape");
  await phone(page).getByRole("button", { name: "Chat", exact: true }).click();
  await page.keyboard.press("Space");
  await expect(page.locator(".roll-readout")).toHaveCount(0);
  await phone(page).getByRole("button", { name: "Tisch", exact: true }).click();
  await page.locator(".surface-top").click();
  await page.keyboard.press("Space");
  await expect(page.locator(".roll-readout")).toContainText("2 (1+1)", { timeout: 4000 });
});

test("Bus: Ziele markiert, Klick auf ein markiertes Feld fährt dorthin", async ({ page }, info) => {
  const game = table();
  game.settings.dice = 3;
  game.players[0].pos = 25;
  game.phase = "bus";
  game.dice = [2, 3, 4];
  game.bus = [{ steps: 2, target: 27 }, { steps: 3, target: 28 }];
  game.deadline = Date.now() + 20_000;
  await loadLocal(page, game);
  await expect(page.locator(".bus-hint")).toContainText("Roche");
  await expect(page.locator('.photo-board > button[data-bus="true"]')).toHaveCount(2);
  await expect(phone(page).getByRole("group", { name: "Busziel wählen" }).getByRole("button")).toHaveCount(2);
  await page.screenshot({ path: info.outputPath("bus.png") });
  await page.getByRole("button", { name: "Feld 28: VC Climate Tech", exact: true }).click();
  await expect(page.locator('.photo-board > button[data-bus="true"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Feld 28: VC Climate Tech", exact: true }).locator(".flat-token")).toHaveCount(1, { timeout: 6000 });
});

test("Lobby zeigt alle Regeln inklusive Bauregeln", async ({ page }) => {
  await page.goto("/");
  await phone(page).getByRole("button", { name: "Lokal gegen Bots" }).click();
  await page.getByLabel("Gastname").fill("Nora");
  await page.getByRole("button", { name: "Lokalen Tisch öffnen" }).click();
  const hand = phone(page);
  for (const heading of ["Partie", "Wirtschaft", "Bauregeln", "Tisch"]) await expect(hand.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await expect(hand.getByRole("checkbox", { name: "Gleichmässig bauen" })).toBeChecked();
  await hand.getByRole("checkbox", { name: "Ein Ausbau je Branche und Runde" }).click();
  await expect(hand.getByRole("checkbox", { name: "Ein Ausbau je Branche und Runde" })).toBeChecked();
  const term = hand.getByRole("combobox", { name: "Darlehensfrist" });
  await expect(term).toHaveValue("5");
  await term.selectOption("8");
  await expect(term).toHaveValue("8");
});

test("Online: Verbindungsabbruch zeigt Overlay, sperrt Eingaben und verschwindet nach Wiederverbindung", async ({ page }, info) => {
  await page.goto("/");
  await phone(page).getByRole("button", { name: "Lobby erstellen", exact: true }).click();
  await page.getByLabel("Gastname").fill("Anna");
  await page.getByRole("button", { name: "Lobby eröffnen" }).click();
  await expect(page.getByTitle("Einladungslink kopieren")).toBeVisible();
  await page.context().setOffline(true);
  const overlay = page.getByRole("alertdialog", { name: "Verbindung verloren" });
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText(/Neuer Versuch in \d+ s|Verbinde neu/);
  await expect(page.locator(".device-frame")).toHaveAttribute("inert", "");
  await overlay.screenshot({ path: info.outputPath("verbindung.png") });
  await page.context().setOffline(false);
  await expect(overlay).toHaveCount(0, { timeout: 15000 });
  await expect(phone(page).getByRole("button", { name: "Bereit melden" })).toBeEnabled();
});

test("Handel: Vorschlag, Karten anzeigen, Anfrage und Rückkehr zur Liste", async ({ page }, info) => {
  const game = table();
  game.assets[1].owner = "anna";
  game.assets[3].owner = "ben";
  game.assets[11].owner = "ben";
  game.players[0].cards = ["C21"];
  await loadLocal(page, game);
  const hand = phone(page);
  await hand.getByRole("button", { name: "Handel", exact: true }).click();
  const card = hand.locator(".partner-card").filter({ hasText: "Ben" });
  await expect(card).toContainText("Vorgeschlagen");
  await expect(card).toContainText("Besitzt Karten, die dein Set vervollständigen");
  await card.getByRole("button", { name: "Karten anzeigen" }).click();
  const swisscom = hand.locator(".holding").filter({ hasText: "Swisscom" });
  await expect(swisscom).toContainText("Vervollständigt dein Set");
  await hand.screenshot({ path: info.outputPath("spielerkarten.png") });
  await swisscom.getByRole("button", { name: "Anfragen" }).click();
  await expect(hand.getByText("Anfrage an Ben")).toBeVisible();
  await hand.getByRole("button", { name: "News", exact: true }).click();
  await hand.getByRole("button", { name: "Handel", exact: true }).click();
  await expect(hand.getByText("Anfrage an Ben")).toBeVisible();
  await expect(hand.locator(".bundle").last().getByRole("checkbox", { name: /Swisscom/ })).toBeChecked();
  await hand.locator(".bundle").first().getByRole("spinbutton").fill("150");
  await hand.screenshot({ path: info.outputPath("handelsentwurf.png") });
  await hand.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(hand.locator(".phone-note")).toContainText(/Handel (angenommen|abgelehnt)/, { timeout: 12000 });
  await expect(hand.locator(".partner-card")).toHaveCount(1);
  await hand.getByRole("button", { name: "Chat", exact: true }).click();
  await hand.locator(".chat-row").first().click();
  const system = hand.locator(".system-note");
  await expect(system.first()).toContainText("Anna → Ben: neue Handelsanfrage");
  await expect(system.last()).toContainText(/Ben (nimmt an|lehnt ab)/);
  await expect(system.last()).toContainText("Swisscom");
  await hand.getByRole("button", { name: "Portfolio", exact: true }).click();
  await expect(hand.locator(".worth-grid")).toContainText("Bargeld");
  await expect(hand.locator(".extra-card")).toContainText("60M");
  await expect(hand.locator(".holding").first().locator(".trend")).toBeVisible();
});

test("News, Mitteilung oben im Handy und Testfahrt ins Gefängnis", async ({ page }, info) => {
  const game = table();
  game.round = 3;
  game.events.push({ seq: 1, time: Date.now() - 60_000, kind: "Spiel", text: "Ein alter Eintrag.", round: 1 });
  game.seq = 1;
  await loadLocal(page, game);
  const hand = phone(page);
  await page.getByRole("button", { name: "Test Gefängnis" }).click();
  const note = hand.locator(".phone-note");
  await expect(note).toContainText("Gefängnis", { timeout: 6000 });
  await note.click();
  await expect(hand.getByRole("heading", { name: "News" })).toBeVisible();
  await expect(hand.locator(".jail-board")).toContainText("Anna sitzt im Gefängnis");
  await expect(hand.locator(".jail-board")).toContainText("0 von 3 Runden abgesessen");
  await expect(hand.getByRole("heading", { name: "Diese Runde" })).toBeVisible();
  const older = hand.locator("details.older");
  await expect(older).not.toHaveAttribute("open", "");
  await older.locator("summary").click();
  await expect(older).toContainText("Ein alter Eintrag.");
  await hand.screenshot({ path: info.outputPath("news.png") });
  await hand.getByRole("button", { name: "Chat", exact: true }).click();
  await hand.getByRole("button", { name: "News", exact: true }).click();
  await expect(hand.locator("details.older")).not.toHaveAttribute("open", "");
});

test("Casino: Einladung, Teilnahme, Einsatz am Tisch, Spiel und Rückkehr", async ({ page }, info) => {
  test.setTimeout(150_000);
  await loadLocal(page, table());
  await page.getByRole("button", { name: "Test Casino" }).click();
  const invite = page.getByRole("dialog", { name: "Casino-Einladung" });
  await expect(invite).toContainText("Du hast 10M bekommen", { timeout: 15000 });
  await invite.screenshot({ path: info.outputPath("einladung.png") });
  await invite.getByRole("button", { name: "Annehmen & ins Casino" }).click();
  await expect(page.getByRole("heading", { name: "Das Casino." })).toBeAttached();
  await page.getByRole("button", { name: "Teilnehmen", exact: true }).click();
  const bet = page.getByLabel("Dein Einsatz (in M)");
  await expect(bet).toBeVisible();
  await expect(bet).toHaveAttribute("max", "40");
  await expect(page.locator(".bj-balance")).toContainText("510M CHF");
  await bet.fill("4");
  await page.getByRole("button", { name: "Setzen" }).click();
  await expect(page.locator(".bj-card").first()).toBeVisible({ timeout: 10000 });
  await page.locator(".casino-floor").screenshot({ path: info.outputPath("blackjack.png") });
  const stand = page.getByRole("button", { name: "Bleiben", exact: true }), verdict = page.locator(".bj-verdict").first();
  for (let turn = 0; turn < 4; turn++) {
    await expect(stand.or(verdict)).toBeVisible({ timeout: 25000 });
    if (await verdict.isVisible()) break;
    await stand.click();
    await expect(stand).toHaveCount(0, { timeout: 3000 }).catch(() => {});
  }
  await expect(verdict).toBeVisible({ timeout: 25000 });
  await page.locator(".casino-floor").screenshot({ path: info.outputPath("abrechnung.png") });
  await expect(page.locator(".casino-floor")).toHaveCount(0, { timeout: 30000 });
  await phone(page).getByRole("button", { name: "News", exact: true }).click();
  await expect(phone(page).locator(".news-section").first()).toContainText(/Casino|Blackjack|spielt/);
});

test("Figurenfoto: Kamera auslösen oder beim Zuklappen freigeben", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      const feed = canvas.captureStream(10);
      window.testStream = feed;
      requestAnimationFrame(() => { ctx.fillStyle = "#df9040"; ctx.fillRect(0, 0, 64, 64); });
      return feed;
    } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Lokal gegen Bots" }).click();
  const picker = page.getByText("Figurenkopf mit eigenem Foto");
  await picker.click();
  await page.getByRole("button", { name: "Kamera öffnen" }).click();
  const video = page.locator(".portrait-camera video");
  await expect.poll(() => video.evaluate((node) => (node as HTMLVideoElement).videoWidth)).toBe(64);
  await page.getByRole("button", { name: "Foto aufnehmen" }).click();
  await expect(page.getByRole("button", { name: "Foto entfernen" })).toBeVisible();
  const ended = () => page.evaluate(() => window.testStream!.getTracks()[0].readyState);
  await expect.poll(ended).toBe("ended");
  await page.getByRole("button", { name: "Kamera öffnen" }).click();
  await expect(video).toBeVisible();
  await picker.click();
  await expect.poll(ended).toBe("ended");
});

test("Tischtour: Ziele im neuen Aufbau und höchstens drei Minuten", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const hand = phone(page), dialog = page.getByRole("dialog", { name: "Tischtour" });
  await hand.getByRole("button", { name: "Tischtour" }).click();
  await expect(dialog).toContainText("Schritt 1 von 4");
  await dialog.getByRole("button", { name: "Weiter" }).click();
  await expect(dialog).toContainText("Dein Zug");
  const spot = (await dialog.locator(".tour-spot").boundingBox())!, frame = (await page.locator(".device-frame").boundingBox())!;
  expect(Math.abs(spot.x - frame.x)).toBeLessThan(6);
  await dialog.getByRole("button", { name: "Überspringen" }).click();
  await expect(dialog).toHaveCount(0);
  await hand.getByRole("button", { name: "Tischtour" }).click();
  await page.clock.fastForward(180_100);
  await expect(dialog).toHaveCount(0);
});

test("Online: Chatliste, Gruppenchat mit Profilbild und Präsenz", async ({ browser }, info) => {
  const host = await browser.newPage({ viewport: { width: 1440, height: 940 } }), guest = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await host.goto("/");
    await phone(host).getByRole("button", { name: "Lobby erstellen", exact: true }).click();
    await host.getByLabel("Gastname").fill("Anna");
    await host.getByRole("button", { name: "Lobby eröffnen" }).click();
    const code = (await host.getByTitle("Einladungslink kopieren").innerText()).trim();
    await guest.goto(`/?raum=${code}`);
    await guest.getByLabel("Gastname").fill("Ben");
    await guest.getByRole("button", { name: "Beitreten", exact: true }).click();
    await expect(phone(host).getByText("Ben", { exact: true })).toBeVisible();
    await phone(host).getByRole("button", { name: "Bereit melden" }).click();
    await phone(guest).getByRole("button", { name: "Bereit melden" }).click();
    await phone(host).getByRole("button", { name: "Partie starten" }).click();
    const hostPhone = phone(host), guestPhone = phone(guest);
    await expect(hostPhone.locator(".seat-row")).toHaveCount(2);
    await expect(hostPhone.locator(".seat-row").filter({ hasText: "Ben" }).locator(".signal-bars")).toBeVisible({ timeout: 10000 });
    await hostPhone.getByRole("button", { name: "Chat", exact: true }).click();
    const rows = hostPhone.locator(".chat-row");
    await expect(rows.first()).toContainText("Tischchat");
    await rows.filter({ hasText: "Ben" }).click();
    await hostPhone.getByRole("textbox", { name: "Nachricht" }).fill("Nur für dich.");
    await hostPhone.getByTitle("Nachricht senden").click();
    const note = guestPhone.locator(".phone-note").filter({ hasText: "Nur für dich." });
    await expect(note).toBeVisible({ timeout: 8000 });
    await guestPhone.getByRole("button", { name: "Chat", exact: true }).click();
    await expect(guestPhone.locator(".chat-row").filter({ hasText: "Anna" }).locator(".unread-badge")).toHaveText("1");
    await guestPhone.locator(".chat-row").first().click();
    await guestPhone.getByRole("textbox", { name: "Nachricht" }).fill("Hallo an alle!");
    await guestPhone.getByTitle("Nachricht senden").click();
    await hostPhone.getByTitle("Alle Chats").click();
    await hostPhone.locator(".chat-row").first().click();
    const bubble = hostPhone.getByRole("log", { name: "Tischchat-Verlauf" }).locator(".bubble-row.incoming");
    await expect(bubble).toContainText("Hallo an alle!");
    await expect(bubble.locator(".avatar")).toBeVisible();
    await hostPhone.screenshot({ path: info.outputPath("gruppenchat.png") });
    await guestPhone.getByTitle("Alle Chats").click();
    await guestPhone.locator(".chat-row").filter({ hasText: "Anna" }).click();
    await expect(guestPhone.getByRole("log", { name: "Privater Verlauf" }).locator(".avatar")).toHaveCount(0);
  } finally {
    await host.close();
    await guest.close();
  }
});

test("Online: zwei Gäste und Bot spielen mit Zahlung, Casino und Handel", async ({ browser }) => {
  test.setTimeout(300_000);
  const contexts = [await browser.newContext(), await browser.newContext()];
  try {
    const pages: Page[] = [], views: (View | undefined)[] = [];
    for (const [index, ctx] of contexts.entries()) {
      await ctx.addInitScript(() => {
        const Native = window.WebSocket;
        window.WebSocket = class extends Native {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            window.marketSocket = this;
          }
        };
        const get = HTMLCanvasElement.prototype.getContext;
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: function (type: string, ...args: unknown[]) { return type === "webgl2" ? null : Reflect.apply(get, this, [type, ...args]); } });
      });
      const page = await ctx.newPage();
      pages.push(page);
      page.on("websocket", (socket) => socket.on("framereceived", (frame) => {
        const data = JSON.parse(String(frame.payload));
        if (data.view) views[index] = data.view;
      }));
      await page.goto("http://127.0.0.1:8787");
    }
    const send = async (index: number, cmd: Command) => {
      const v = views[index]!;
      await pages[index].evaluate((packet) => window.marketSocket!.send(JSON.stringify(packet)), { cmd, version: v.version, epoch: v.epoch, actionId: crypto.randomUUID() });
      await expect.poll(() => views[index]!.version, { timeout: 5000 }).toBeGreaterThan(v.version);
    };
    const [host, guest] = pages;
    await phone(host).getByRole("button", { name: "Lobby erstellen", exact: true }).click();
    await host.getByLabel("Gastname").fill("Anna");
    await host.getByRole("button", { name: "Lobby eröffnen" }).click();
    await expect(host.getByTitle("Einladungslink kopieren")).toBeVisible();
    const code = views[0]!.code;
    await phone(guest).getByRole("button", { name: "Mit Code beitreten", exact: true }).click();
    await guest.getByLabel("Gastname").fill("Lara");
    await guest.getByLabel("Raumnummer").fill(code);
    await guest.getByRole("button", { name: "Beitreten", exact: true }).click();
    await expect(phone(host).getByText("Lara", { exact: true })).toBeVisible();
    await phone(host).getByRole("button", { name: "Bot hinzufügen" }).click();
    await expect.poll(() => views[0]!.players.length).toBe(3);
    await expect(phone(guest).getByText(/Bot · Mittel/)).toBeVisible();
    await send(0, { type: "SETTINGS", settings: { ...views[0]!.settings, hidden: true, auctions: false, auto: true, limit: 0 } });
    await phone(host).getByRole("button", { name: "Bereit melden" }).click();
    await phone(guest).getByRole("button", { name: "Bereit melden" }).click();
    await phone(host).getByRole("button", { name: "Partie starten" }).click();
    await expect.poll(() => views[0]!.round).toBe(1);
    const ids = views.map((v) => v!.me);
    let bought = false, traded = false;
    for (let step = 0; step < 140 && !(bought && traded && views[0]!.round >= 2); step++) {
      const view = views[0]!, index = ids.indexOf(view.players[view.turn].id);
      if (view.tradeUntil) {
        const receiver = views.findIndex((snapshot) => snapshot?.trades.some((item) => item.status === "Offen" && item.to === snapshot.me));
        if (receiver !== -1) await phone(pages[receiver]).getByRole("button", { name: "Ablehnen", exact: true }).click();
        await expect.poll(() => views[0]!.tradeUntil, { timeout: 35000 }).toBe(0);
        continue;
      }
      if (view.phase === "casinoInvite") {
        for (const [idx, id] of ids.entries()) if (views[idx]!.phase === "casinoInvite" && !views[idx]!.casino?.arrived.includes(id)) await send(idx, { type: "CASINO_ENTER" }).catch(() => {});
        continue;
      }
      if (view.phase === "casinoJoin") {
        for (const [idx, id] of ids.entries()) if (views[idx]!.phase === "casinoJoin" && !views[idx]!.casino?.answers.includes(id)) await send(idx, { type: "CASINO_JOIN", yes: false }).catch(() => {});
        continue;
      }
      if (["travel", "blackjack", "casinoBet", "casinoSettle"].includes(view.phase) || index < 0) {
        const prev = view.version;
        await expect.poll(() => views[0]!.version, { timeout: 20000 }).toBeGreaterThan(prev);
        continue;
      }
      if (view.phase === "debt") {
        await phone(pages[index]).getByRole("slider", { name: "Überweisung bestätigen" }).press("End");
        await expect.poll(() => views[index]!.phase, { timeout: 8000 }).not.toBe("debt");
        if (views[index]!.assets.some((asset) => asset.owner === ids[index])) bought = true;
      } else if (view.phase === "buy") {
        await pages[index].getByRole("button", { name: /^Kaufen ·/ }).click();
        await phone(pages[index]).getByRole("slider", { name: "Überweisung bestätigen" }).press("End");
        await expect.poll(() => views[index]!.phase).not.toBe("debt");
        bought = true;
      } else if (view.phase === "roll") {
        const owner = views.findIndex((v) => v!.assets.some((a) => a.owner === v!.me));
        if (bought && !traded && owner >= 0) {
          const id = views[owner]!.assets.findIndex((a) => a.owner === ids[owner]), to = 1 - owner;
          await send(owner, { type: "PROPOSE_TRADE", to: ids[to], give: { cash: 0, assets: [id], cards: [] }, want: { cash: M, assets: [], cards: [] } });
          await expect(phone(pages[owner]).getByRole("heading", { name: "Anfrage gesendet" })).toBeVisible();
          await phone(pages[to]).getByRole("button", { name: "Annehmen", exact: true }).click();
          await expect.poll(() => views[owner]!.assets[id].owner).toBe(ids[to]);
          traded = true;
        }
        await send(index, { type: "ROLL_DICE" });
      } else if (view.phase === "manage") {
        await expect.poll(() => views[0]!.phase, { timeout: 15000 }).not.toBe("manage");
      } else if (view.phase === "choice" || view.phase === "insurance") await send(index, { type: "REACT", yes: false });
      else throw Error(`Unerwartete Phase ${view.phase}`);
    }
    expect(bought && traded).toBe(true);
    expect(views[1]!.players.find((p) => p.id === ids[0])).not.toHaveProperty("cash");
    expect(views[1]).not.toHaveProperty("decks");
    const before = views[1]!.own.cash;
    views[1] = undefined;
    await guest.reload();
    await expect.poll(() => views[1]?.me).toBe(ids[1]);
    expect(views[1]!.own.cash).toBe(before);
    expect(views[1]!.trades.some((t) => t.status === "Angenommen")).toBe(true);
  } finally {
    await Promise.all(contexts.map((ctx) => ctx.close()));
  }
});

test("Aufgeben: nur der eigene Platz scheidet aus, Besitz geht an die Bank", async ({ page }) => {
  const game = table();
  game.players.push(player("cara", "Cara", 2, "Einfach"));
  game.players[2].cash = 500 * M;
  game.assets[3].owner = "anna";
  await loadLocal(page, game);
  const hand = phone(page);
  await hand.getByRole("button", { name: "Bankrott melden" }).click();
  await hand.getByRole("alertdialog", { name: "Aufgeben bestätigen" }).getByRole("button", { name: "Aufgeben" }).click();
  await expect(hand.locator(".seat-row").first()).toContainText("Ausgeschieden");
  await expect(hand.getByRole("button", { name: "Bankrott melden" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Feld 3: Swisscom", exact: true })).toHaveAttribute("data-owned", "false");
});

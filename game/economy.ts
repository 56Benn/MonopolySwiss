import { board, groups, M, marketBand, money, rate, taxes } from "./board.ts";
import {
  balance,
  book,
  log,
  say,
  type Game,
  type Player,
  type Command,
  type Bundle,
  type Trade,
} from "./model.ts";
import { card, type CashEffect } from "./cards.ts";
export const members = (id: number) =>
  board.filter((tile) => tile.group === board[id].group);
export const complete = (s: Pick<Game, "assets">, id: number) =>
  !!s.assets[id].owner &&
  members(id).every(
    (tile) =>
      s.assets[tile.id].owner === s.assets[id].owner && !s.assets[tile.id].loan,
  );
export const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);
export const buildPrice = (value: number) => rate(value, 4000);
export const maxLevel = 5;
export const refundShare = 6000;
export const loanShare = 5000;
export const repayAmount = (loan: number) => rate(loan, 11000);
/** Miete in Basispunkten des aktuellen Werts: ohne Branche, volle Branche, dann Stufe 1–4 und Hotel. */
export const rentLadder = [800, 1600, 4000, 8000, 13000, 18000, 24000];
export const levelName = (level: number) => (level >= maxLevel ? "Hotel" : `${level} Geldstapel`);
export function quotedRent(
  group: number,
  value: number,
  count: number,
  full: boolean,
  level: number,
  dice: number,
  factor: number,
) {
  const base =
    group === 8
      ? rate(value, [0, 1200, 2500, 5000, 10000][count])
      : group === 9
        ? rate(value, count === 2 ? 600 : 250) * dice
        : rate(value, level ? rentLadder[Math.min(level, maxLevel) + 1] : full ? rentLadder[1] : rentLadder[0]);
  return rate(base, factor);
}
export function rent(s: Pick<Game, "assets" | "settings"> & { players: { id: string; jail: number }[] }, id: number, dice: number) {
  const asset = s.assets[id],
    group = board[id].group;
  if (!asset.owner || asset.loan) return 0;
  if (s.players.find((person) => person.id === asset.owner)?.jail) return 0;
  const owned = members(id).filter(
    (tile) =>
      s.assets[tile.id].owner === asset.owner && !s.assets[tile.id].loan,
  ).length;
  return quotedRent(
    group,
    asset.value,
    owned,
    complete(s, id),
    asset.levels.length,
    dice,
    s.settings.rent,
  );
}
export function worth(s: Game, p: Player) {
  return (
    p.cash +
    (s.casino?.settledAt ? 0 : sum((s.casino?.hands ?? []).filter((hand) => hand.id === p.id).map((hand) => hand.own))) +
    sum(
      s.assets
        .filter((asset) => asset.owner === p.id)
        .map(
          (asset) =>
            asset.value -
            asset.loan +
            sum(asset.levels.map((value) => rate(value, refundShare))),
        ),
    )
  );
}
export function victory(s: Game, now: number, bankrupt = false) {
  if (s.phase === "lobby" || s.phase === "over") return;
  const live = s.players.filter((person) => !person.out),
    eligible =
      live.length <= 1 || (bankrupt && s.settings.win === "first")
        ? live
        : s.settings.win === "goal"
          ? live.filter((person) => worth(s, person) >= s.settings.goal * M)
          : [];
  if (live.length > 1 && !eligible.length) return;
  eligible.sort(
    (left, right) => worth(s, right) - worth(s, left) || right.cash - left.cash,
  );
  s.winners = eligible
    .filter(
      (person) =>
        worth(s, person) === worth(s, eligible[0]) &&
        person.cash === eligible[0].cash,
    )
    .map((person) => person.id);
  s.phase = "over";
  for (const person of s.players)
    person.history = [...person.history, worth(s, person)].slice(-100);
  s.paused = false;
  s.deadline = 0;
  s.auction = null;
  s.casino = null;
  s.trades.forEach((trade) => {
    if (trade.status === "Offen") trade.status = "Abgelaufen";
  });
  log(s, now, "Spiel", "Die Partie ist beendet.");
}
export function market(
  s: Game,
  targets: number[],
  pct: number,
  reason: string,
  now: number,
) {
  const changes: { tile: number; before: number; after: number }[] = [];
  for (const tile of board.filter((tile) => targets.includes(tile.group))) {
    const asset = s.assets[tile.id],
      old = asset.value;
    asset.value = Math.min(
      rate(tile.base, marketBand[1]),
      Math.max(rate(tile.base, marketBand[0]), rate(old, 10000 + pct * 100)),
    );
    asset.history = [...asset.history, asset.value].slice(-30);
    changes.push({ tile: tile.id, before: old, after: asset.value });
  }
  log(
    s,
    now,
    "Markt",
    `${targets.length === 8 ? "Gesamtmarkt" : targets.map((index) => groups[index]).join(", ")} ${pct >= 0 ? "+" : "−"}${Math.abs(pct)} %`,
    reason,
  );
  s.events[s.events.length - 1].changes = changes;
}
/** Zieht Kurse jede Runde um 10 % zum Startwert zurück, ohne Marktbewegungen aufzuheben. */
export function revert(s: Game) {
  for (const tile of board) {
    if (tile.group < 0) continue;
    const asset = s.assets[tile.id],
      next = asset.value + Math.round((tile.base - asset.value) * 0.1);
    if (Math.abs(next - asset.value) < M / 10) continue;
    asset.value = next;
    asset.history = [...asset.history, next].slice(-30);
  }
}
/** Kleine Branchenbewegung zum Rundenschluss als ein einziger Markteintrag. */
export function drift(s: Game, moves: number[], now: number) {
  const changes: NonNullable<Game["events"][number]["changes"]> = [], parts: string[] = [];
  moves.forEach((pct, group) => {
    if (!pct) return;
    for (const tile of board.filter((item) => item.group === group)) {
      const asset = s.assets[tile.id], old = asset.value;
      asset.value = Math.min(rate(tile.base, marketBand[1]), Math.max(rate(tile.base, marketBand[0]), rate(old, 10000 + pct * 100)));
      asset.history = [...asset.history, asset.value].slice(-30);
      changes.push({ tile: tile.id, before: old, after: asset.value });
    }
    parts.push(`${groups[group]} ${pct > 0 ? "+" : "−"}${Math.abs(pct)} %`);
  });
  if (!parts.length) return;
  log(s, now, "Markt", parts.join(", "), "Rundenschluss");
  s.events[s.events.length - 1].changes = changes;
}
export function taxDue(s: Game, p: Player, id: number) {
  const tax = taxes[id], basis = tax.basis === "cash" ? p.cash : worth(s, p);
  return Math.max(board[id].base, Math.round(rate(Math.max(0, basis), tax.bps) / M) * M);
}
/** Betrag einer Geldkarte für diesen Platz, auf ganze Millionen gerundet; negativ bei Belastung. */
export function cardCash(s: Game, p: Player, effect: CashEffect) {
  const size = Math.abs(effect.amount),
    mine = s.assets.filter((asset) => asset.owner === p.id);
  const raw =
    effect.kind === "cash"
      ? size * M
      : effect.kind === "portfolio"
        ? rate(sum(mine.filter((asset) => board[s.assets.indexOf(asset)].group < 8).map((asset) => asset.value)), size * 100)
        : effect.kind === "wealth"
          ? rate(p.cash, size * 100)
          : sum(mine.map((asset) => asset.levels.length)) * size * M;
  const bounded = Math.min(effect.cap ? effect.cap * M : Infinity, Math.max(effect.min ? effect.min * M : 0, raw));
  return Math.sign(effect.amount) * Math.round(bounded / M) * M;
}
export function buildBlock(s: Pick<Game, "assets" | "settings" | "builds">, owner: string, id: number) {
  const asset = s.assets[id],
    tile = board[id],
    family = members(id).map((other) => s.assets[other.id]),
    levels = asset.levels.length;
  if (asset.owner !== owner || tile.group < 0 || tile.group >= 8) return "Nicht ausbaubar";
  if (asset.loan) return "Zuerst Darlehen tilgen";
  if (levels >= maxLevel) return "Hotel bereits gebaut";
  if (s.settings.full && family.some((other) => other.owner !== owner || other.loan)) return "Vollständige, unbelehnte Branche nötig";
  if (s.settings.even !== false && family.some((other) => other.owner === owner && other.levels.length < levels)) return "Gleichmässig bauen: zuerst die anderen Firmen";
  if (s.settings.perRound && (s.builds?.[`${owner}:${tile.group}`] ?? 0) >= 1) return "Diese Branche wurde in dieser Runde schon ausgebaut";
  return null;
}
export function assetAction(
  s: Game,
  p: Player,
  id: number,
  op: Extract<Command, { type: "ASSET" }>["op"],
  now: number,
) {
  const asset = s.assets[id];
  if (!asset || asset.owner !== p.id) throw Error("Keine eigene Firma");
  const family = members(id)
    .filter((tile) => s.assets[tile.id].owner === p.id)
    .map((tile) => s.assets[tile.id]);
  const levels = asset.levels.length,
    price = buildPrice(asset.value),
    before = p.cash,
    short = board[id].short;
  if (op === "build") {
    const blocked = buildBlock(s, p.id, id);
    if (blocked) throw Error(blocked);
    if (balance(s, p.id) < price) throw Error("Nicht genügend freies Guthaben");
    book(p, -price, `Ausbau ${short}`, now);
    asset.levels.push(price);
    const key = `${p.id}:${board[id].group}`;
    s.builds = { ...(s.builds ?? {}), [key]: (s.builds?.[key] ?? 0) + 1 };
    s.turnBuilds = (s.turnBuilds ?? 0) + 1;
    log(s, now, "Konto", `${p.name} baut ${short} aus (${levelName(asset.levels.length)})`);
  } else if (op === "reduce") {
    if (
      !levels ||
      (s.settings.even !== false && family.some((other) => other.levels.length > levels))
    )
      throw Error("Zuerst die höchste Stufe abbauen");
    book(
      p,
      rate(asset.levels.pop()!, refundShare),
      `Rückbau ${short}`,
      now,
    );
    log(s, now, "Konto", `${p.name} verkauft eine Ausbaustufe von ${short} · +${money(p.cash - before)}`);
  } else if (op === "loan") {
    if (asset.loan || family.some((other) => other.levels.length))
      throw Error("Zuerst Branche zurückbauen oder Darlehen tilgen");
    asset.loan = rate(asset.value, loanShare);
    asset.due = s.round + (s.settings.loanRounds ?? 5);
    book(p, asset.loan, `Beleihung ${short}`, now);
    log(s, now, "Konto", `${p.name} beleiht ${short} · +${money(asset.loan)} · fällig in Runde ${asset.due}`);
  } else if (op === "repay") {
    if (!asset.loan) throw Error("Kein Darlehen");
    book(p, -repayAmount(asset.loan), `Tilgung ${short}`, now);
    asset.loan = 0;
    delete asset.due;
    log(s, now, "Konto", `${p.name} tilgt das Darlehen auf ${short} · ${money(before - p.cash)}`);
  } else if (op === "sell") {
    if (family.some((other) => other.levels.length))
      throw Error("Zuerst Branche zurückbauen");
    book(
      p,
      rate(asset.value, 6000) - asset.loan,
      `Bankverkauf ${short}`,
      now,
    );
    asset.owner = null;
    asset.loan = 0;
    delete asset.due;
    log(s, now, "Konto", `${p.name} verkauft ${short} an die Bank · +${money(p.cash - before)}`);
  } else throw Error("Unbekannte Verwaltung");
  return p.cash - before;
}
function bundleOK(s: Game, p: Player, b: Bundle) {
  if (
    !b ||
    !Number.isSafeInteger(b.cash) ||
    b.cash < 0 ||
    b.cash > balance(s, p.id) ||
    !Array.isArray(b.assets) ||
    !Array.isArray(b.cards) ||
    new Set(b.assets).size !== b.assets.length ||
    new Set(b.cards).size !== b.cards.length ||
    b.assets.some(
      (id) =>
        !Number.isInteger(id) ||
        s.assets[id]?.owner !== p.id ||
        members(id).some((tile) => s.assets[tile.id].levels.length),
    ) ||
    b.cards.some((id) => !p.cards.includes(id))
  )
    throw Error("Angebot nicht mehr verfügbar");
}
export function clearInvalid(s: Game) {
  for (const trade of s.trades.filter((item) => item.status === "Offen"))
    try {
      if (trade.quote.some((quote) => s.assets[quote.id].loan !== quote.loan))
        throw Error("Darlehen geändert");
      bundleOK(
        s,
        s.players.find((person) => person.id === trade.from)!,
        trade.give,
      );
      bundleOK(
        s,
        s.players.find((person) => person.id === trade.to)!,
        trade.want,
      );
    } catch {
      trade.status = "Abgelaufen";
    }
}
export const bundleText = (bundle: Bundle) =>
  [
    ...(bundle.cash ? [`CHF ${money(bundle.cash)}`] : []),
    ...bundle.assets.map((id) => board[id].short),
    ...bundle.cards.map((id) => card(id).name),
  ].join(", ") || "nichts";
export function tradeNote(s: Game, trade: Trade, outcome: "offer" | "accepted" | "rejected" | "expired", now: number) {
  const name = (id: string) => s.players.find((person) => person.id === id)?.name ?? "Gast",
    from = name(trade.from),
    to = name(trade.to),
    deal = `${from} bietet ${bundleText(trade.give)} für ${bundleText(trade.want)}`;
  const text =
    outcome === "offer"
      ? `${from} → ${to}: neue Handelsanfrage`
      : outcome === "accepted"
        ? `${to} nimmt an · ${from} gibt ${bundleText(trade.give)} · ${to} gibt ${bundleText(trade.want)}`
        : outcome === "rejected"
          ? `${to} lehnt ab · ${deal}`
          : `Keine Antwort von ${to} · ${deal}`;
  say(s, { from: "system", name: "Handel", text, time: now, system: true });
}
export function offer(
  s: Game,
  p: Player,
  cmd: Extract<Command, { type: "PROPOSE_TRADE" }>,
  now: number,
) {
  const other = s.players.find((person) => person.id === cmd.to && !person.out);
  if (!other || other === p) throw Error("Ungültiger Kontakt");
  bundleOK(s, p, cmd.give);
  bundleOK(s, other, cmd.want);
  if (
    !(
      cmd.give.cash +
      cmd.want.cash +
      cmd.give.assets.length +
      cmd.want.assets.length +
      cmd.give.cards.length +
      cmd.want.cards.length
    )
  )
    throw Error("Leeres Angebot");
  const key = `${p.id}:${other.id}`;
  if ((s.counts[key] ?? 0) >= 2)
    throw Error("Angebotslimit dieser Spielrunde erreicht");
  s.counts[key] = (s.counts[key] ?? 0) + 1;
  for (const old of s.trades.filter(
    (item) =>
      item.from === p.id && item.to === other.id && item.status === "Offen",
  ))
    old.status = "Zurückgezogen";
  s.trades.push({
    id: crypto.randomUUID(),
    from: p.id,
    to: other.id,
    give: cmd.give,
    want: cmd.want,
    round: s.round,
    time: now,
    status: "Offen",
    quote: [...cmd.give.assets, ...cmd.want.assets].map((id) => ({
      id,
      value: s.assets[id].value,
      loan: s.assets[id].loan,
      level: s.assets[id].levels.length,
    })),
  });
  s.trades = s.trades.slice(-100);
  tradeNote(s, s.trades.at(-1)!, "offer", now);
}
export function accept(s: Game, trade: Trade, now: number) {
  if (s.phase !== "roll" || s.debt || s.auction || s.casino)
    throw Error("Handel nur vor dem Würfeln");
  if (
    trade.status !== "Offen" ||
    trade.round !== s.round ||
    trade.quote.some((quote) => s.assets[quote.id].loan !== quote.loan)
  )
    throw Error("Angebot abgelaufen");
  const from = s.players.find((person) => person.id === trade.from)!,
    to = s.players.find((person) => person.id === trade.to)!;
  bundleOK(s, from, trade.give);
  bundleOK(s, to, trade.want);
  for (const [sender, target, items] of [
    [from, to, trade.give],
    [to, from, trade.want],
  ] as const) {
    book(sender, -items.cash, `Handel an ${target.name}`, now);
    book(target, items.cash, `Handel von ${sender.name}`, now);
    for (const id of items.assets) s.assets[id].owner = target.id;
    for (const id of items.cards) {
      sender.cards = sender.cards.filter((item) => item !== id);
      target.cards.push(id);
    }
  }
  trade.status = "Angenommen";
  s.stats.deal = Math.max(
    s.stats.deal,
    trade.give.cash,
    trade.want.cash,
    sum(trade.quote.map((quote) => quote.value)),
  );
  log(s, now, "Spiel", `Handel: ${from.name} ↔ ${to.name}`);
  tradeNote(s, trade, "accepted", now);
}
export function rentText(s: Game, id: number) {
  const level = s.assets[id].levels.length;
  return `Miete ${board[id].short}${level ? ` (${levelName(level)})` : ""}`;
}

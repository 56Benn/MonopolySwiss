import { board, M, money, rate, startBonus } from "./board.ts";
import { card } from "./cards.ts";
import { diceText, revealMs, rollDistance, travelTime } from "./dice.ts";
import { phraseText, type PhraseKind } from "./phrases.ts";
import {
  secure,
  shuffle,
  joinCasino,
  deal,
  payout,
  dealerFinish,
  score,
  casinoBonus,
  dealStep,
  settleTime,
  splitHand,
  canSplit,
  canDouble,
  type Random,
} from "./casino.ts";
import {
  newGame,
  openTrade,
  tradeWindow,
  player,
  log,
  say,
  current,
  balance,
  book,
  seedFunds,
  validSettings,
  type Game,
  type Phase,
  type Player,
  type Command,
} from "./model.ts";
import {
  assetAction,
  rent,
  rentText,
  sum,
  market,
  worth,
  victory,
  offer,
  accept,
  clearInvalid,
  revert,
  tradeNote,
} from "./economy.ts";
export { newGame, player };
function botSay(s: Game, p: Player, kind: PhraseKind, now: number, rng: Random) {
  if (!p.bot) return;
  const index = rng(30);
  say(s, { from: p.id, name: p.name, text: phraseText(kind, index), time: now, phrase: { kind, index } });
}
export function suspend(s: Game, now: number) {
  const pending = openTrade(s);
  if (pending) {
    pending.status = "Abgelehnt";
    tradeNote(s, pending, "expired", now);
    restoreTradeClock(s, pending.time, now);
  }
  s.paused = true;
  s.pausedAt = now;
  s.remaining = s.deadline ? Math.max(1, s.deadline - now) : 0;
  s.deadline = 0;
}
export function resume(s: Game, now: number) {
  const elapsed = s.pausedAt === undefined ? 0 : Math.max(0, now - s.pausedAt);
  if (s.auction) s.auction.max += elapsed;
  if (s.phase==="travel" && s.movement?.at!==undefined)s.movement.at+=elapsed;
  if (s.turnDeadline) s.turnDeadline += elapsed;
  s.paused = false;
  s.deadline = s.remaining ? now + s.remaining : 0;
  s.remaining = 0;
  s.resumeAt = 0;
  delete s.pausedAt;
  s.votes = [];
  s.epoch++;
}
function insist(
  condition: unknown,
  message = "Aktion in dieser Phase nicht möglich",
): asserts condition {
  if (!condition) throw Error(message);
}
function phase(s: Game, next: Phase, now: number, seconds?: number) {
  s.phase = next;
  s.epoch++;
  if (seconds === undefined) {
    s.turnDeadline ??= s.settings.limit ? now + s.settings.limit * 1000 : 0;
    s.deadline = s.turnDeadline;
  } else s.deadline = seconds ? now + seconds * 1000 : 0;
}
function manage(s: Game, now: number) {
  phase(s, "manage", now, 2);
  s.deadline = Math.max(
    s.deadline,
    (s.movement?.at ?? now) +
      travelTime(s.movement?.path.length ?? 0) +
      (s.lastCard || s.result ? 4200 : 500),
  );
}
function jail(s: Game, now: number, rng: Random = secure) {
  const p = current(s);
  p.pos = 10;
  p.jail = 3;
  s.extra = false;
  s.doubles = 0;
  log(s, now, "Zug", `${p.name} muss ins Gefängnis`);
  botSay(s, p, "jail", now, rng);
  manage(s, now);
}
function discard(s: Game, p: Player, id: string) {
  insist(p.cards.includes(id));
  p.cards = p.cards.filter((value) => value !== id);
  s.discards[1].push(id);
}
function nextTurn(s: Game, now: number, rng: Random) {
  let index = s.turn;
  do {
    index = (index + 1) % s.players.length;
    if (index === 0) {
      s.round++;
      s.counts = {};
      s.builds = {};
      s.trades.forEach((item) => {
        if (item.status === "Offen") item.status = "Abgelaufen";
      });
      revert(s);
      if (s.settings.auto)
        for (let group = 0; group < 8; group++)
          market(s, [group], rng(5) - 2, "Rundenschluss", now);
      s.players.forEach((p) => {
        p.history = [...p.history, worth(s, p)].slice(-100);
      });
    }
  } while (s.players[index].out);
  s.turn = index;
  s.doubles = 0;
  s.extra = false;
  s.lastCard = "";
  s.turnBuilds = 0;
  s.turnDeadline = s.settings.limit ? now + s.settings.limit * 1000 : 0;
  phase(s, "roll", now);
}
function debt(
  s: Game,
  amount: number,
  to: string | null,
  reason: string,
  now: number,
) {
  if (amount <= 0) {
    manage(s, now);
    return;
  }
  s.debt = { amount, to, reason };
  phase(s, "debt", now, current(s).cash >= amount ? 10 : 40);
}
function transfer(s: Game, p: Player, bill: NonNullable<Game["debt"]>, now: number) {
  book(p, -bill.amount, bill.reason, now);
  const target = bill.to ? s.players.find((other) => other.id === bill.to)! : null;
  if (target) book(target, bill.amount, bill.reason, now);
  log(s, now, "Konto", `${p.name} zahlt ${money(bill.amount)}${target ? ` an ${target.name}` : ""} · ${bill.reason}`);
}
function openCasino(s: Game, now: number, rng: Random) {
  const p = current(s);
  book(p, casinoBonus, "Casino-Bonus", now);
  const queue = [...s.players.slice(s.turn), ...s.players.slice(0, s.turn)]
    .filter((other) => !other.out)
    .map((other) => other.id);
  s.casino = {
    host: p.id,
    bonus: casinoBonus,
    queue,
    arrived: s.players.filter((other) => other.bot && queue.includes(other.id)).map((other) => other.id),
    answers: [],
    seats: [],
    hands: [],
    dealer: [],
    shoe: [],
    cursor: 0,
  };
  s.result = null;
  log(s, now, "Casino", `${p.name} erhält ${money(casinoBonus)} und lädt ins Casino ein`);
  botSay(s, p, "casino", now, rng);
  phase(s, "casinoInvite", now, 10);
}
function casinoJoinStage(s: Game, now: number) {
  const table = s.casino!;
  table.arrived = [...table.queue];
  if (table.answers.length >= table.queue.length) casinoBetStage(s, now);
  else phase(s, "casinoJoin", now, 5);
}
function casinoBetStage(s: Game, now: number) {
  const table = s.casino!;
  table.answers = [...table.queue];
  if (!table.seats.length) closeCasino(s, now, "Niemand spielt mit.");
  else phase(s, "casinoBet", now, 20);
}
function closeCasino(s: Game, now: number, text: string) {
  s.casino = null;
  log(s, now, "Casino", text);
  manage(s, now);
}
function travel(s: Game, distance: number, bonus: boolean, now: number, depth=0, imprisoned=false, transfer=false) {
  const p = current(s);
  const target=imprisoned ? 10 : (p.pos+distance+40)%40;
  const path=imprisoned ? [10] : Array.from({length:Math.abs(distance)},(_,index)=>(p.pos+Math.sign(distance)*(index+1)+40)%40);
  s.movement={player:p.id,roll:s.rolls,start:p.pos,at:now,stage:"Bewegung",distance,path,transfer};
  s.arrival={target,bonus:bonus && distance>0 && p.pos+distance>=40,jail:imprisoned,depth};
  phase(s,"travel",now,0);
  s.deadline=now+travelTime(path.length,transfer);
}
function dice(s: Game, rng: Random) {
  return Array.from({ length: s.settings.dice }, () => rng(6) + 1);
}
function resolve(
  s: Game,
  now: number,
  rng: Random,
  depth = 0,
  fromCard = false,
) {
  const p = current(s),
    tile = board[p.pos],
    asset = s.assets[p.pos];
  if (s.movement) s.movement.stage = "Feldauflösung";
  if (depth >= 20) {
    manage(s, now);
    s.paused = true;
    s.remaining = 0;
    log(s, now, "Spiel", "Diagnose: Kartenkette nach 20 Feldern pausiert.");
    return;
  }
  if (tile.group >= 0) {
    if (!asset.owner) {
      phase(
        s,
        "buy",
        now,
        !s.settings.limit && p.cards.includes("C22") ? 90 : undefined,
      );
      return;
    }
    if (asset.owner !== p.id && !asset.loan) {
      const owner = s.players.find((other) => other.id === asset.owner)!;
      if (owner.jail) {
        log(s, now, "Konto", `Keine Miete für ${tile.short}: ${owner.name} sitzt im Gefängnis`);
        manage(s, now);
        return;
      }
      const roll =
        fromCard && tile.group === 9
          ? rollDistance(
              dice(s, rng),
              p.pos,
              board.map((tile) => tile.group >= 0 && !s.assets[tile.id].owner),
            )
          : (s.movement?.distance ?? sum(s.dice));
      debt(s, rent(s, tile.id, roll), asset.owner, rentText(s, tile.id), now);
      return;
    }
    manage(s, now);
    return;
  }
  if (p.pos === 30) {
    travel(s,0,false,now,depth+1,true,true);
    return;
  }
  if (p.pos === 20) {
    openCasino(s, now, rng);
    return;
  }
  if (tile.base) {
    debt(s, tile.base, null, tile.name, now);
    return;
  }
  if (tile.name !== "Chance" && tile.name !== "Ereignis") {
    manage(s, now);
    return;
  }
  const deck = tile.name === "Chance" ? 1 : 0;
  if (!s.decks[deck].length) {
    s.decks[deck] = shuffle(s.discards[deck], rng);
    s.discards[deck] = [];
  }
  const id = s.decks[deck].pop()!;
  const drawn = card(id),
    effect = drawn.effect;
  s.lastCard = id;
  if (effect.kind === "keep" || effect.kind === "move" || effect.kind === "choice")
    log(s, now, "Spiel", effect.kind === "keep" ? `${p.name} erhält eine Besitzkarte` : `${p.name}: ${drawn.name}`);
  if (effect.kind === "keep") {
    p.cards.push(id);
    manage(s, now);
    return;
  }
  s.discards[deck].push(id);
  if (effect.kind === "market") {
    let prev = -1;
    for (const change of effect.changes) {
      const possible = Array.from({ length: 8 }, (_, index) => index).filter(
        (group) => group !== prev,
      );
      const targets =
        change.groups === "all"
          ? [0, 1, 2, 3, 4, 5, 6, 7]
          : change.groups === "other"
            ? [possible[rng(7)]]
            : change.groups === "random"
              ? [rng(8)]
              : change.groups;
      prev = targets[0];
      const [low, high] =
        s.settings.volatility === "Wild"
          ? [15, 35]
          : s.settings.volatility === "Ruhig"
            ? [3, 10]
            : [8, 20];
      const pct =
        typeof change.pct === "number"
          ? change.pct
          : (low + rng(high - low + 1)) *
            (change.pct === "down" || (change.pct === "either" && rng(2) === 0)
              ? -1
              : 1);
      market(s, targets, pct, drawn.name, now);
    }
    manage(s, now);
  } else if (effect.kind === "choice") {
    phase(s, "choice", now, 20);
  } else if (effect.kind === "move") {
    if (effect.target === "jail") {
      travel(s,0,false,now,depth+1,true,true);
      return;
    }
    let distance =
      effect.target === "back"
        ? -3
        : effect.target === "start"
          ? 40 - p.pos
          : effect.target === "zurich"
            ? (25 - p.pos + 40) % 40
            : 1;
    if (effect.target === "next")
      while (
        board[(p.pos + distance) % 40].group < 0 ||
        board[(p.pos + distance) % 40].group >= 8
      )
        distance++;
    travel(s,distance,distance>0,now,depth+1,false,true);
  } else {
    const value =
      effect.kind === "cash"
        ? effect.amount * M
        : Math.min(
            (effect.amount > 0 ? 30 : 25) * M,
            rate(
              sum(
                s.assets
                  .filter(
                    (asset, index) =>
                      asset.owner === p.id &&
                      board[index].group >= 0 &&
                      board[index].group < 8,
                  )
                  .map((asset) => asset.value),
              ),
              200,
            ),
          ) * Math.sign(effect.amount);
    if (value < 0 && p.cards.includes("C21")) {
      s.reaction = -value;
      phase(s, "insurance", now, 20);
    } else if (value < 0) debt(s, -value, null, drawn.name, now);
    else {
      book(p, value, drawn.name, now);
      log(s, now, "Konto", `${p.name} erhält ${money(value)} · ${drawn.name}`);
      manage(s, now);
    }
  }
}
function autoPass(s: Game) {
  const sale = s.auction!, passed = (sale.passed ??= []);
  for (const person of s.players)
    if (!person.out && person.id !== sale.leader && !passed.includes(person.id) && person.cash < sale.bid + M) passed.push(person.id);
  return s.players.every((other) => other.out || other.id === sale.leader || passed.includes(other.id));
}
function auction(s: Game, tiles: number[], now: number, rng: Random) {
  const [tile, ...queue] = tiles;
  if (tile === undefined || !s.settings.auctions) {
    s.auction = null;
    if (current(s).out) nextTurn(s, now, rng);
    else manage(s, now);
    return;
  }
  s.auction = {
    tile,
    queue,
    bid: 0,
    leader: null,
    max: 0,
    passed: [],
  };
  phase(s, "auction", now, 0);
  if (autoPass(s)) closeAuction(s, now, rng);
}
function closeAuction(s: Game, now: number, rng: Random) {
  const sale = s.auction!;
  if (sale.leader) {
    const buyer = s.players.find((other) => other.id === sale.leader)!;
    book(buyer, -sale.bid, `Auktion ${board[sale.tile].short}`, now);
    s.assets[sale.tile].owner = buyer.id;
    log(s, now, "Konto", `Auktion: ${buyer.name} ersteigert ${board[sale.tile].short} für ${money(sale.bid)}`);
  } else log(s, now, "Konto", `Auktion: ${board[sale.tile].short} ohne Gebot`);
  if(sale.resumeRoll && !sale.queue.length){s.auction=null;phase(s,"roll",now);}
  else auction(s, sale.queue, now, rng);
}
function casinoNext(s: Game, now: number, lead = 0) {
  const table = s.casino!;
  const index = table.hands.findIndex((hand) => !hand.done);
  if (index >= 0) {
    table.cursor = index;
    phase(s, "blackjack", now, 0);
    s.deadline = now + lead + 10000;
    return;
  }
  dealerFinish(table);
  s.result = {
    dealer: table.dealer,
    hands: table.hands.map((hand) => {
      const paid = payout(hand, table.dealer);
      const net = paid - hand.own;
      const person = s.players.find((p) => p.id === hand.id)!;
      if (paid)
        book(person, paid, `Blackjack: ${money(hand.own)} eingesetzt, ${money(paid)} zurück`, now);
      s.stats.casino = Math.max(s.stats.casino, net);
      log(s, now, "Casino", net > 0 ? `${person.name} gewinnt im Casino ${money(net)} CHF.` : net < 0 ? `${person.name} verliert im Casino ${money(-net)} CHF.` : `${person.name} spielt im Casino unentschieden.`);
      return { id: hand.id, cards: hand.cards, paid, net, stake: hand.own };
    }),
  };
  table.settledAt = now;
  phase(s, "casinoSettle", now, 0);
  s.deadline = now + settleTime(table);
}
function beginDeal(s: Game, now: number, rng: Random) {
  const table = s.casino!;
  table.hands = table.hands.filter((hand) => table.seats.includes(hand.id));
  table.seats = table.seats.filter((id) => table.hands.some((hand) => hand.id === id));
  if (!table.hands.length) {
    closeCasino(s, now, "Kein Einsatz, kein Blackjack.");
    return;
  }
  deal(table, rng);
  table.dealtAt = now;
  casinoNext(s, now, (table.hands.length * 2 + 2) * dealStep + 400);
}
function settleDebt(s: Game, now: number, rng: Random) {
  const pending = s.debt!,
    p = current(s),
    owned = () => board.filter((tile) => s.assets[tile.id].owner === p.id);
  for (const op of ["reduce", "loan", "sell"] as const) {
    while (p.cash < pending.amount) {
      const tile = owned()
        .sort(
          (left, right) =>
            s.assets[right.id].levels.length - s.assets[left.id].levels.length,
        )
        .find((tile) =>
          op === "reduce"
            ? s.assets[tile.id].levels.length
            : op === "loan"
              ? !s.assets[tile.id].loan
              : rate(s.assets[tile.id].value, 6000) > s.assets[tile.id].loan,
        );
      if (!tile) break;
      assetAction(s, p, tile.id, op, now);
      if(op==="sell" && s.settings.auctions)(s.saleQueue??=[]).push(tile.id);
    }
  }
  s.debt = null;
  if (p.cash >= pending.amount) {
    transfer(s, p, pending, now);
    manage(s, now);
    return;
  }
  const target = s.players.find((other) => other.id === pending.to),
    tiles = owned().map((tile) => tile.id);
  if (target) {
    book(target, p.cash, "Konkursübernahme", now);
    target.cards.push(...p.cards);
  } else s.discards[1].push(...p.cards);
  p.cards = [];
  book(p, -p.cash, "Konkurs", now);
  p.out = true;
  for (const id of tiles) {
    s.assets[id].owner = target?.id ?? null;
    if (!target) s.assets[id].loan = 0;
  }
  s.trades
    .filter((trade) => trade.from === p.id || trade.to === p.id)
    .forEach((trade) => {
      if (trade.status === "Offen") trade.status = "Abgelaufen";
    });
  log(s, now, "Spiel", `${p.name} ist bankrott.`);
  victory(s, now, true);
  if (s.phase !== "over") {const released=[...(s.saleQueue??[]),...(target?[]:tiles)];s.saleQueue=[];auction(s,released,now,rng);}
}
function restoreTradeClock(s: Game, start: number, now: number) {
  const elapsed = Math.max(0, Math.min(now - start, tradeWindow));
  if (s.deadline) s.deadline += elapsed;
  if (s.turnDeadline) s.turnDeadline += elapsed;
}
function resign(s: Game, p: Player, now: number, rng: Random) {
  const turn = current(s) === p;
  for (const asset of s.assets)
    if (asset.owner === p.id) Object.assign(asset, { owner: null, loan: 0, levels: [] });
  s.discards[1].push(...p.cards);
  p.cards = [];
  if (p.cash) book(p, -p.cash, "Aufgabe", now);
  p.out = true;
  s.trades.forEach((trade) => {
    if (trade.status === "Offen" && (trade.from === p.id || trade.to === p.id)) trade.status = "Abgelaufen";
  });
  log(s, now, "Spiel", `${p.name} gibt auf.`);
  victory(s, now, true);
  if (s.phase === "over" || !turn) return;
  s.debt = null;
  s.saleQueue = [];
  delete s.arrival;
  nextTurn(s, now, rng);
}
export function tick(source: Game, now: number, rng: Random = secure): Game {
  const offer = openTrade(source);
  if (offer) {
    if (now < offer.time + tradeWindow) return source;
    const next = structuredClone(source);
    const expired = openTrade(next)!;
    expired.status = "Abgelehnt";
    tradeNote(next, expired, "expired", now);
    restoreTradeClock(next, offer.time, now);
    next.version++;
    return next;
  }
  if (
    source.paused ||
    ((!source.deadline || source.deadline > now) &&
      !(source.phase === "manage" && !source.deadline))
  )
    return source;
  const s = structuredClone(source),
    p = current(s);
  if (s.phase === "travel" && s.arrival) {
    const arrival=s.arrival; delete s.arrival;
    p.pos=arrival.target;
    if(s.movement) s.movement.stage="Feldauflösung";
    if(arrival.bonus) book(p,startBonus,"START-Bonus",now);
    if(arrival.jail) jail(s,now,rng); else resolve(s,now,rng,arrival.depth,arrival.depth>0);
  } else if (s.phase === "manage" && s.saleQueue?.length) {
    const tiles=s.saleQueue;s.saleQueue=[];auction(s,tiles,now,rng);
  } else if (s.phase === "manage") {
    if (s.extra) {
      s.extra = false;
      phase(s, "roll", now);
    } else nextTurn(s, now, rng);
  } else if (s.phase === "debt" && s.debt?.purchase) { s.debt=null; manage(s,now); }
  else if (s.phase === "debt") settleDebt(s, now, rng);
  else if (s.phase === "auction") {
    closeAuction(s, now, rng);
  } else if (s.phase === "casinoInvite") casinoJoinStage(s, now);
  else if (s.phase === "casinoJoin") casinoBetStage(s, now);
  else if (s.phase === "casinoBet") beginDeal(s, now, rng);
  else if (s.phase === "casinoSettle") closeCasino(s, now, "Blackjack abgerechnet.");
  else {
    const cmd: Command =
      s.phase === "roll"
        ? { type: "ROLL_DICE" }
        : s.phase === "bus"
          ? { type: "BUS_CHOOSE", steps: s.bus!.at(-1)!.steps }
          : s.phase === "buy"
            ? { type: "DECLINE" }
            : s.phase === "blackjack"
              ? { type: "BLACKJACK_STAND" }
              : { type: "REACT", yes: false };
    return apply(
      s,
      s.phase === "blackjack" ? s.casino!.hands[s.casino!.cursor].id : p.id,
      cmd,
      now,
      rng,
    );
  }
  clearInvalid(s);
  if (!s.casino && !s.debt) victory(s, now);
  s.version++;
  return s;
}
export function apply(
  source: Game,
  id: string,
  cmd: Command,
  now = Date.now(),
  rng: Random = secure,
) {
  const s = structuredClone(source),
    p = s.players.find((other) => other.id === id);
  insist(p, "Kein Platz in diesem Raum");
  const host = s.host === id,
    active = current(s) === p;
  const at = (...phases: Phase[]) => insist(phases.includes(s.phase));
  const turn = () => insist(active, "Der andere Platz ist am Zug");
  if (cmd.type === "CHAT") {
    const text = cmd.text.trim();
    if (cmd.to !== undefined)
      insist(
        cmd.to !== id &&
          s.players.some((other) => other.id === cmd.to && !other.bot),
        "Kein gültiger Empfänger am Tisch",
      );
    insist(
      text.length > 0 && text.length <= 300,
      "Nachricht: 1 bis 300 Zeichen",
    );
    insist(
      !s.chat.some((msg) => msg.from === id && now - msg.time < 900),
      "Bitte kurz warten",
    );
    s.chat = [
      ...s.chat,
      {
        id: ++s.seq,
        from: id,
        name: p.name,
        text,
        time: now,
        ...(cmd.to ? { to: cmd.to } : {}),
      },
    ].slice(-60);
    return s;
  }
  if (cmd.type === "RESUME") {
    insist(s.paused && p.online && !p.bot);
    resume(s, now);
    s.version++;
    return s;
  }
  insist(!s.paused, "Partie pausiert");
  if (s.phase === "lobby") {
    if (cmd.type === "READY") p.ready = !p.ready;
    else {
      insist(host, "Nur die Spielleitung");
      if (cmd.type === "START") {
        insist(
          s.players.length >= 2 && s.players.every((other) => other.ready),
          "Mindestens zwei Plätze und alle bereit",
        );
        s.players = shuffle(s.players, rng);
        s.players.forEach((other) => {
          seedFunds(other, s.settings, now);
          other.history = [other.cash];
        });
        s.round = 1;
        phase(s, "roll", now);
        log(s, now, "Spiel", "Die Börse ist eröffnet.");
      } else if (cmd.type === "SETTINGS") {
        validSettings(cmd.settings);
        s.settings = { ...cmd.settings };
        s.players.forEach((other) => {
          if (!other.bot) other.ready = false;
        });
      } else if (cmd.type === "BOT") {
        insist(["Einfach", "Mittel", "Schwer"].includes(cmd.level));
        if (cmd.seat) {
          const bot = s.players.find(
            (person) => person.id === cmd.seat && person.bot,
          );
          insist(bot);
          bot.bot = cmd.level;
        } else {
          insist(s.players.length < 6, "Alle Plätze belegt");
          const token = [0, 1, 2, 3, 4, 5].find((index) =>
            s.players.every((other) => other.token !== index),
          )!;
          s.players.push(
            player(
              crypto.randomUUID(),
              ["Nina", "Levin", "Lara", "Noé", "Elin", "Luca"][token],
              token,
              cmd.level,
            ),
          );
        }
        s.players.forEach((other) => {
          if (!other.bot) other.ready = false;
        });
      } else if (cmd.type === "REMOVE") {
        insist(
          cmd.seat !== id && s.players.some((other) => other.id === cmd.seat),
        );
        s.players = s.players.filter((other) => other.id !== cmd.seat);
        s.players.forEach((other) => {
          if (!other.bot) other.ready = false;
        });
      } else if (cmd.type === "LOCK") s.locked = !s.locked;
      else throw Error("Aktion in der Lobby nicht möglich");
    }
    s.version++;
    return s;
  }
  at(
    "roll",
    "bus",
    "travel",
    "buy",
    "manage",
    "auction",
    "debt",
    "choice",
    "insurance",
    "casinoInvite",
    "casinoJoin",
    "casinoBet",
    "blackjack",
    "casinoSettle",
  );
  insist(!p.out, "Platz ausgeschieden");
  const pending = openTrade(s);
  if (pending) insist(cmd.type === "TRADE" && cmd.op !== "withdraw" && cmd.id === pending.id && now < pending.time + tradeWindow, "Handelsentscheidung ausstehend oder Frist abgelaufen");
  switch (cmd.type) {
    case "TEST_TRAVEL":
      turn(); at("roll"); insist(!s.code && host,"Testfahrt nur am lokalen Tisch");
      s.lastCard="";s.extra=false;s.doubles=0;
      travel(s,(20-p.pos+40)%40,false,now,0,cmd.target==="jail",true);
      break;
    case "ROLL_DICE": {
      turn();
      at("roll");
      s.dice = dice(s, rng);
      s.rolls++;
      s.lastCard = "";
      s.movement = {
        player: p.id,
        roll: s.rolls,
        path: [],
        at: now,
        start: p.pos,
        distance: 0,
        stage: "Würfeln",
      };
      const double = s.dice[0] === s.dice[1];
      s.extra = false;
      if (p.jail && !double) {
        p.jail--;
        manage(s, now);
        break;
      }
      if (p.jail) p.jail = 0;
      else {
        s.extra = double;
        s.doubles = double ? s.doubles + 1 : 0;
        if (s.doubles === 3) {
          travel(s,0,false,now,0,true);
          break;
        }
      }
      const distance = rollDistance(
        s.dice,
        p.pos,
        board.map((tile) => tile.group >= 0 && !s.assets[tile.id].owner),
      );
      if (s.settings.dice === 3 && (s.dice[2] === 4 || s.dice[2] === 5)) {
        const [first, second] = s.dice;
        s.bus = [first, second, first + second]
          .map((steps) => ({ steps, target: (p.pos + steps) % 40 }))
          .filter((option, index, all) => option.target !== 30 && all.findIndex((other) => other.target === option.target) === index);
        log(s, now, "Zug", `${p.name} würfelt ${diceText(s.dice, first + second)} · Bus`);
        phase(s, "bus", now, 0);
        s.deadline = now + revealMs + 20000;
        break;
      }
      s.movement.distance = distance;
      travel(s, distance, true, now);
      log(
        s,
        now,
        "Zug",
        `${p.name} würfelt ${diceText(s.dice, distance)} → ${board[s.arrival!.target].short}`,
      );
      break;
    }
    case "BUS_CHOOSE": {
      turn();
      at("bus");
      const option = s.bus?.find((item) => item.steps === cmd.steps);
      insist(option, "Dieses Busziel ist nicht wählbar");
      delete s.bus;
      log(s, now, "Zug", `${p.name} fährt mit dem Bus ${option.steps} Felder → ${board[option.target].short}`);
      travel(s, option.steps, true, now, 0, false, true);
      s.movement!.distance = option.steps;
      break;
    }
    case "BAIL":
    case "LAWYER":
    case "JAIL_WAIT":
      turn();
      at("roll");
      insist(p.jail);
      if (cmd.type === "JAIL_WAIT") {
        p.jail--;
        manage(s, now);
      } else {
        if (cmd.type === "BAIL") book(p, -50 * M, "Freikauf Gefängnis", now);
        else
          discard(
            s,
            p,
            p.cards.find((item) => item === "C19" || item === "C20")!,
          );
        p.jail = 0;
        s.epoch++;
      }
      break;
    case "BUY_COMPANY": {
      turn();
      at("buy");
      const asset = s.assets[p.pos];
      insist(!asset.owner);
      const discount = cmd.coupon
        ? Math.min(10 * M, rate(asset.value, 1500))
        : 0;
      if(cmd.coupon) insist(p.cards.includes("C22"));
      insist(p.cash >= asset.value - discount, "Nicht genug Geld für diesen Kauf");
      s.debt={amount:asset.value-discount,to:null,reason:`Kauf ${board[p.pos].short}`,purchase:{tile:p.pos,coupon:!!cmd.coupon}};
      phase(s,"debt",now,10);break;
    }
    case "CONFIRM_PAYMENT": {
      turn();at("debt");const invoice=s.debt;insist(invoice && p.cash>=invoice.amount && now<s.deadline,"Zahlung nicht möglich");
      if(invoice.purchase){
        const {tile,coupon}=invoice.purchase;insist(!s.assets[tile].owner && p.pos===tile);
        if(coupon) discard(s,p,"C22");book(p,-invoice.amount,invoice.reason,now);s.assets[tile].owner=id;
        log(s,now,"Konto",`${p.name} kauft ${board[tile].short} für ${money(invoice.amount)}`);
      } else transfer(s,p,invoice,now);
      s.debt=null;
      manage(s, now);
      break;
    }
    case "RESIGN":
      insist(!["auction","casinoInvite","casinoJoin","casinoBet","blackjack","casinoSettle"].includes(s.phase),"Aufgeben ist nach Auktion oder Casino möglich");
      resign(s,p,now,rng);
      break;
    case "DECLINE":
      turn();
      insist(s.phase==="buy" || (s.phase==="debt" && s.debt?.purchase));
      s.debt=null;manage(s,now);
      break;
    case "PASS_BID":
    case "BID": {
      at("auction");
      const sale = s.auction!;
      const passed = (sale.passed ??= []);
      insist(
        id !== sale.leader && !passed.includes(id),
        "Du führst bereits oder hast gepasst",
      );
      if (cmd.type === "PASS_BID") passed.push(id);
      else if (cmd.type === "BID") {
        insist(
          Number.isSafeInteger(cmd.amount) &&
            cmd.amount >= sale.bid + M &&
            cmd.amount <= p.cash,
          "Gebot zu niedrig oder nicht gedeckt",
        );
        sale.bid = cmd.amount;
        sale.leader = id;
      }
      if (autoPass(s)) closeAuction(s, now, rng);
      break;
    }
    case "ASSET":
      turn();
      at("roll", "debt");
      if (s.phase === "roll") insist(["build", "loan", "repay"].includes(cmd.op), "Verkauf und Rückbau nur zur Begleichung einer Zahlung");
      else insist(s.debt && !s.debt.purchase && ["sell", "loan", "reduce"].includes(cmd.op), "Nur zur Begleichung einer offenen Zahlung");
      assetAction(s, p, cmd.tile, cmd.op, now);
      if (cmd.op === "sell" && s.settings.auctions) (s.saleQueue ??= []).push(cmd.tile);
      break;
    case "REACT":
      turn();
      at("insurance", "choice");
      if (s.phase === "insurance") {
        if (cmd.yes) discard(s, p, "C21");
        debt(
          s,
          Math.max(0, s.reaction - (cmd.yes ? 30 * M : 0)),
          null,
          "Chance: Schaden nach Deckung",
          now,
        );
        s.reaction = 0;
      } else {
        const amount = cmd.yes ? (rng(2) ? 35 : -20) : 5;
        if (amount < 0) debt(s, -amount * M, null, "Risikokapital-Wette", now);
        else {
          book(p, amount * M, "Risikokapital-Wette", now);
          manage(s, now);
        }
      }
      break;
    case "CASINO_ENTER":
    case "CASINO_SKIP": {
      at("casinoInvite");
      const table = s.casino!;
      insist(table.queue.includes(id) && !table.arrived.includes(id), "Bereits im Casino");
      table.arrived.push(id);
      if (cmd.type === "CASINO_SKIP") {
        insist(id === table.host, "Nur der Gast auf dem Casinofeld");
        table.answers.push(id);
      }
      if (table.arrived.length >= table.queue.length) casinoJoinStage(s, now);
      break;
    }
    case "CASINO_JOIN": {
      at("casinoJoin");
      const table = s.casino!;
      insist(table.queue.includes(id) && !table.answers.includes(id), "Bereits entschieden");
      if (cmd.yes) {
        insist(balance(s, id) >= M / 2, "Zu wenig Guthaben für einen Einsatz");
        table.seats = id === table.host ? [id, ...table.seats] : [...table.seats, id];
        if (id !== table.host) botSay(s, p, "casino", now, rng);
      }
      table.answers.push(id);
      if (table.answers.length >= table.queue.length) casinoBetStage(s, now);
      break;
    }
    case "PLACE_CASINO_BET": {
      at("casinoBet");
      const table = s.casino!;
      if (cmd.amount === null) {
        insist(table.seats.includes(id) && !table.hands.some((hand) => hand.id === id));
        table.seats = table.seats.filter((seat) => seat !== id);
      } else {
        joinCasino(table, id, cmd.amount, balance(s, id));
        book(p, -cmd.amount, "Casino-Einsatz", now);
      }
      if (table.seats.every((seat) => table.hands.some((hand) => hand.id === seat))) beginDeal(s, now, rng);
      break;
    }
    case "BLACKJACK_HIT":
    case "BLACKJACK_STAND":
    case "BLACKJACK_DOUBLE":
    case "BLACKJACK_SPLIT": {
      at("blackjack");
      const table = s.casino!,
        hand = table.hands[table.cursor];
      insist(hand.id === id && !hand.done, "Nicht an der Reihe");
      if (cmd.type === "BLACKJACK_SPLIT") {
        insist(canSplit(hand, balance(s, id)), "Teilen nicht möglich");
        book(p, -hand.own, "Casino: Hand geteilt", now);
        splitHand(table, table.cursor);
        casinoNext(s, now, 2 * 700);
        break;
      }
      if (cmd.type === "BLACKJACK_DOUBLE") {
        insist(canDouble(hand, balance(s, id)), "Verdoppeln nicht möglich");
        book(p, -hand.own, "Casino: Einsatz verdoppelt", now);
        hand.own *= 2;
        hand.doubled = true;
        hand.cards.push(table.shoe.pop()!);
        hand.done = true;
      } else if (cmd.type === "BLACKJACK_HIT") {
        hand.cards.push(table.shoe.pop()!);
        hand.done = score(hand.cards) >= 21;
      } else hand.done = true;
      casinoNext(s, now, cmd.type === "BLACKJACK_STAND" ? 300 : 700);
      break;
    }
    case "PROPOSE_TRADE":
      at("roll");
      offer(s, p, cmd, now);
      break;
    case "TRADE": {
      at("roll");
      const trade = s.trades.find((other) => other.id === cmd.id);
      insist(trade && trade.status === "Offen" && trade.round === s.round);
      if (cmd.op === "withdraw") {
        insist(trade.from === id);
        trade.status = "Zurückgezogen";
      } else {
        insist(trade.to === id);
        if (cmd.op === "accept") accept(s, trade, now);
        else if (cmd.op === "reject") {
          trade.status = "Abgelehnt";
          tradeNote(s, trade, "rejected", now);
        } else throw Error("Unbekannte Handelsaktion");
      }
      restoreTradeClock(s, trade.time, now);
      break;
    }
    case "VOTE": {
      insist(cmd.issue === "pause" || cmd.issue === "quit");
      insist(
        s.voteType === null
          ? host || s.settings.competitive
          : s.voteType === cmd.issue,
      );
      s.voteType = cmd.issue;
      if (!s.votes.includes(id)) s.votes.push(id);
      const voters = s.players.filter(
        (other) => other.online && !other.bot && !other.out,
      );
      if (
        voters.filter((other) => s.votes.includes(other.id)).length >=
        (s.settings.competitive
          ? Math.floor(voters.length / 2) + 1
          : voters.length)
      ) {
        if (cmd.issue === "quit") {
          if (!s.casino?.settledAt)
            for (const hand of s.casino?.hands ?? [])
            book(
              s.players.find((other) => other.id === hand.id)!,
              hand.own,
              "Abbruch: eigener Einsatz zurück",
              now,
            );
          s.casino = null;
          s.auction = null;
          s.debt = null;
          s.trades.forEach((trade) => {
            if (trade.status === "Offen") trade.status = "Abgelaufen";
          });
          s.phase = "over";
          s.winners = [];
          s.deadline = 0;
        } else {
          suspend(s, now);
        }
        s.voteType = null;
        s.votes = [];
      }
      break;
    }
    default:
      throw Error("Unbekannte Spielaktion");
  }
  clearInvalid(s);
  if (!s.casino && !s.debt) victory(s, now);
  s.version++;
  return s;
}

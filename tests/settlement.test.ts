import test from "node:test";
import assert from "node:assert/strict";
import { M } from "../game/board.ts";
import { newGame, player, apply, tick } from "../game/engine.ts";
import { worth } from "../game/economy.ts";
import { advance } from "../game/scheduler.ts";
import { decide } from "../bots/strategy.ts";
import { project } from "../game/view.ts";
test("Auktion: Mindestabstand, bindender Pass, risikobewusster Bot und sofortiger Zuschlag", () => {
  const host = player("a", "Anna", 0),
    bot = player("b", "Levin", 1, "Schwer"),
    guest = player("c", "Emma", 2);
  host.cash = guest.cash = 500 * M;
  bot.cash = 46 * M;
  let state = newGame(host);
  state.players.push(bot, guest);
  state.phase = "auction";state.turn=2;
  state.auction = { tile: 3, queue: [], bid: 0, leader: null, max: 0, passed: [guest.id] };
  state.deadline = 0;
  state = apply(state, host.id, { type: "BID", amount: 17.5 * M }, 101);
  assert.throws(() =>
    apply(state, guest.id, { type: "BID", amount: 18 * M }, 102),
  );
  assert.equal(tick(state, 10_000_000), state);
  assert.deepEqual(decide(project(state, bot.id), "Schwer"), {
    type: "PASS_BID",
  });
  state = apply(state, bot.id, { type: "PASS_BID" }, 103);
  assert.throws(() =>
    apply(state, bot.id, { type: "BID", amount: 20 * M }, 104),
  );
  assert.equal(state.phase,"manage");
  assert.equal(state.assets[3].owner, host.id);
  assert.equal(state.players[0].cash, 482.5 * M);
  assert.equal(state.auction, null);
  assert.equal(state.players[state.turn].id,guest.id);
  assert.match(state.events.at(-1)!.text, /ersteigert Swisscom/);
});
test("Kauf, Verwaltung und Zusatzwurf verlängern das Zuglimit nicht", () => {
  const p = player("a", "Anna", 0),
    q = player("b", "Lara", 1);
  p.cash = q.cash = 500 * M;
  let s = newGame(p);
  s.players.push(q);
  s.phase = "roll";
  s.turnDeadline = 90000;
  p.pos = 1;
  s = apply(s, "a", { type: "ROLL_DICE" }, 15000, () => 0);
  s=tick(s,s.deadline);
  assert.equal(s.phase, "buy");
  assert.equal(s.deadline, 90000);
  s = apply(s, "a", { type: "BUY_COMPANY" }, 22000);
  assert.equal(s.assets[3].owner,null);assert.equal(s.players[0].cash,500*M);
  assert.throws(()=>apply(s,"b",{type:"CONFIRM_PAYMENT"},22001));
  s=apply(s,"a",{type:"CONFIRM_PAYMENT"},22002);assert.equal(s.assets[3].owner,"a");
  s = tick(s, s.deadline);
  assert.equal(s.phase, "roll");
  assert.equal(s.deadline, 90000);
});
test("Genehmigte Pause hält eine Auktion ohne Frist an", () => {
  const p = player("a", "Anna", 0),
    q = player("b", "Lara", 1);
  p.cash = q.cash = 500 * M;
  let s = newGame(p);
  s.players.push(q);
  s.players.push(player("c","Carla",2));s.players[2].cash=500*M;
  s.phase="auction";s.auction={tile:1,queue:[],bid:0,leader:null,max:0,passed:["a"]};s.deadline=0;
  s = apply(s, "a", { type: "VOTE", issue: "pause" }, 3000);
  assert.equal(s.paused, false);
  s = apply(s, "b", { type: "VOTE", issue: "pause" }, 4000);
  s = apply(s, "c", { type: "VOTE", issue: "pause" }, 4000);
  assert.equal(s.paused, true);
  assert.throws(() => apply(s, "b", { type: "BID", amount: M }, 5000));
  s = apply(s, "b", { type: "RESUME" }, 104000);
  assert.equal(s.deadline, 0);
  s = apply(s, "b", { type: "BID", amount: M }, 115000);
  assert.equal(s.deadline, 0);
  assert.equal(s.auction?.leader, "b");
});
test("Handelsentscheidung sperrt den Zug und endet nach höchstens 30 Sekunden", () => {
  const p = player("a", "Anna", 0),
    q = player("b", "Levin", 1, "Schwer");
  p.cash = M;
  q.cash = 500 * M;
  let s = newGame(p);
  s.players.push(q);
  s.phase = "roll";
  s.settings.hidden = true;
  s.assets[3].owner = "b";
  const request = {
    type: "PROPOSE_TRADE" as const,
    to: "b",
    give: { cash: M, assets: [], cards: [] },
    want: { cash: 0, assets: [3], cards: [] },
  };
  s = apply(s, "a", request, 1);
  s = advance(s, 2);
  assert.equal(s.trades[0].status, "Abgelehnt");
  s = apply(s, "a", request, 3);
  s.turn = 1;
  s.deadline = 5000;
  assert.throws(() => apply(s,"b",{type:"ASSET",tile:3,op:"loan"},4));
  assert.throws(() => apply(s,"b",{type:"ROLL_DICE"},5));
  assert.equal(tick(s,30002),s);
  assert.throws(() => apply(s,"b",{type:"TRADE",op:"accept",id:s.trades[1].id},30003));
  s = tick(s,30003);
  assert.equal(s.trades[1].status, "Abgelehnt");
  assert.equal(s.deadline,35000);
  assert.equal(s.assets[3].owner,"b");
  assert.throws(() =>
    apply(s, "b", { type: "TRADE", op: "accept", id: s.trades[1].id }, 5),
  );
});
test("Marktkarte prüft geteilten Zielsieg erst nach der letzten Branche", () => {
  const p = player("a", "Anna", 0),
    q = player("b", "Lara", 1);
  p.cash = q.cash = 500 * M;
  const s = newGame(p);
  s.players.push(q);
  s.phase = "roll";
  s.settings.win = "goal";
  s.settings.goal = 565;
  s.assets[8].owner = "a";
  s.assets[11].owner = "b";
  s.assets[8].value = s.assets[11].value = 60 * M;
  s.decks[0] = ["E21"];
  const trip = apply(s, "a", { type: "ROLL_DICE" }, 2, () => 0),next=tick(trip,trip.deadline,()=>0);
  assert.deepEqual(next.winners, ["a", "b"]);
  assert.equal(next.phase, "over");
  assert.equal(next.assets[11].value, 67.2 * M);
  assert.match(next.events.find((event) => event.kind === "Markt")!.text, /Uhren & Luxus, Lebensmittel \+12 %/);
  assert.deepEqual(next.movement?.path, [1, 2]);
});
test("Konkurs überträgt unterdecktes Eigentum samt festem Darlehen", () => {
  const p = player("a", "Anna", 0),
    q = player("b", "Lara", 1);
  p.cash = M;
  q.cash = 500 * M;
  const s = newGame(p);
  s.players.push(q);
  s.phase = "debt";
  s.debt = { amount: 100 * M, to: "b", reason: "Miete" };
  s.deadline = 2;
  s.assets[3].owner = "a";
  s.assets[3].value = 50 * M;
  s.assets[3].loan = 80 * M;
  const next = tick(s, 2);
  assert.equal(next.assets[3].owner, "b");
  assert.equal(next.assets[3].loan, 80 * M);
  assert.equal(next.players[1].cash, 501 * M);
  assert.equal(next.players[0].cash, 0);
  assert.deepEqual(next.winners, ["b"]);
});
test("Gebot reserviert einmal, Auktion endet erst nach allen Pässen und Zuschlag zahlt einmal", () => {
  const p = player("a", "Anna", 0),
    q = player("b", "Lara", 1);
  p.cash = q.cash = 100 * M;
  let s = newGame(p);
  s.players.push(q);
  s.players.push(player("c","Carla",2));s.players[2].cash=100*M;
  s.phase="auction";s.auction={tile:1,queue:[],bid:0,leader:null,max:0,passed:["a"]};s.deadline=0;
  s = apply(s, "b", { type: "BID", amount: 83 * M }, 14000);
  assert.equal(s.deadline, 0);
  assert.equal(worth(s, s.players[1]), 100 * M);
  assert.throws(() => apply(s, "b", { type: "BID", amount: 101 * M }, 15000));
  assert.equal(tick(s, 99_000_000), s);
  s = apply(s, "c", { type: "PASS_BID" }, 20000);
  assert.equal(s.players[1].cash, 17 * M);
  assert.equal(s.assets[1].owner, "b");
  assert.equal(tick(s, 20001).players[1].cash, 17 * M);
});
test("Ausbau: 45 % je Stufe, gleichmässig, eine Stufe je Branche und Runde, Hotel als fünfte Stufe", () => {
  const p = player("a", "Anna", 0), q = player("b", "Lara", 1);
  p.cash = q.cash = 2000 * M;
  let s = newGame(p);
  s.players.push(q);
  s.phase = "roll";
  s.round = 1;
  s.assets[1].owner = s.assets[3].owner = "a";
  s.settings.perRound = true;
  s = apply(s, "a", { type: "ASSET", tile: 1, op: "build" }, 1);
  assert.equal(s.players[0].cash, 2000 * M - 13.5 * M);
  assert.throws(() => apply(s, "a", { type: "ASSET", tile: 3, op: "build" }, 2), /Runde/);
  s.settings.perRound = false;
  assert.throws(() => apply(s, "a", { type: "ASSET", tile: 1, op: "build" }, 3), /Gleichmässig/);
  for (let level = 0; level < 9; level++) s = apply(s, "a", { type: "ASSET", tile: level % 2 ? 1 : 3, op: "build" }, 4 + level);
  assert.equal(s.assets[1].levels.length, 5);
  assert.throws(() => apply(s, "a", { type: "ASSET", tile: 1, op: "build" }, 20), /Hotel/);
  assert.throws(() => apply(s, "a", { type: "ASSET", tile: 1, op: "reduce" }, 21), /Zahlung/);
  assert.throws(() => apply(s, "a", { type: "ASSET", tile: 1, op: "sell" }, 22), /Zahlung/);
  s.settings.even = false;
  s.assets[3].levels = [];
  s = apply(s, "a", { type: "ASSET", tile: 3, op: "build" }, 23);
  assert.equal(s.turnBuilds, 11);
});

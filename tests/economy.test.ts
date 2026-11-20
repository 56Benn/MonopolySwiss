import test from "node:test";
import assert from "node:assert/strict";
import { M, money } from "../game/board.ts";
import { newGame, player } from "../game/model.ts";
import {
  assetAction,
  rent,
  market,
  revert,
  worth,
  victory,
  offer,
  accept,
  clearInvalid,
} from "../game/economy.ts";
const setup = () => {
  const p = player("a", "Anna", 0),
    q = player("b", "Lara", 1);
  p.cash = q.cash = 500 * M;
  const s = newGame(p);
  s.players.push(q);
  s.phase = "roll";
  s.assets[1].owner = s.assets[3].owner = p.id;
  return { s, p, q };
};
test("Marktband, wertproportionale Miete, 60 % Rückbau vom Originalpreis und Bankverkauf", () => {
  const { s, p } = setup();
  assetAction(s, p, 1, "build", 1);
  assert.equal(p.cash, 500 * M - 13.5 * M);
  market(s, [0], 400, "Test", 2);
  assert.equal(s.assets[1].value, 45 * M);
  assert.equal(s.assets[37].value, 165 * M);
  assert.equal(rent(s, 1, 7), 13.5 * M);
  assetAction(s, p, 1, "reduce", 3);
  assert.equal(p.cash, 500 * M - 13.5 * M + 8.1 * M);
  assetAction(s, p, 1, "loan", 4);
  market(s, [0], -99, "Test", 5);
  assert.equal(s.assets[1].value, 21 * M);
  assert.equal(s.assets[1].loan, 22.5 * M);
  const before = p.cash;
  assetAction(s, p, 1, "sell", 6);
  assert.equal(p.cash, before + 12.6 * M - 22.5 * M);
  s.assets[3].value = 54 * M;
  revert(s);
  assert.equal(s.assets[3].value, 51.3 * M);
  assert.equal(money(950 * M), "950M");
  assert.equal(money(1500 * M), "1.5B");
  assert.equal(money(2000 * M), "2B");
});
test("Zielgleichstand und sofortiger erster Konkurs", () => {
  const { s, p, q } = setup();
  s.settings.win = "goal";
  s.settings.goal = 550;
  q.cash = worth(s, p);
  victory(s, 1);
  assert.deepEqual(s.winners, ["b"]);
  const other = setup();
  other.s.players.push(player("c", "C", 2));
  other.s.players[2].out = true;
  other.s.settings.win = "first";
  victory(other.s, 2, true);
  assert.deepEqual(other.s.winners, ["a"]);
});
test("Handelszähler, Eigentumswechsel und ungültiges zweites Angebot", () => {
  const { s, p, q } = setup();
  const third = player("c", "C", 2);
  s.players.push(third);
  const cmd = {
    type: "PROPOSE_TRADE" as const,
    to: q.id,
    give: { cash: 0, assets: [1], cards: [] },
    want: { cash: 0, assets: [], cards: [] },
  };
  offer(s, p, cmd, 1);
  offer(s, p, cmd, 2);
  assert.throws(() => offer(s, p, cmd, 3));
  offer(s, p, { ...cmd, to: "c" }, 4);
  accept(s, s.trades[1], 5);
  clearInvalid(s);
  assert.equal(s.assets[1].owner, "b");
  assert.equal(s.trades[2].status, "Abgelaufen");
  const notes = s.chat.filter((message) => message.system).map((message) => message.text);
  assert.equal(notes[0], "Anna → Lara: neue Handelsanfrage");
  assert.equal(notes.at(-1), "Lara nimmt an · Anna gibt Logitech · Lara gibt nichts");
});

import test from "node:test";
import assert from "node:assert/strict";
import { M } from "../game/board.ts";
import {
  score,
  payout,
  joinCasino,
  dealerFinish,
  splitHand,
  canSplit,
  type Casino,
} from "../game/casino.ts";
test("Alle Auszahlungen mit eigenem, freiem und gemischtem Einsatz", () => {
  for (const [own, free] of [
    [10 * M, 0],
    [0, 10 * M],
    [5 * M, 10 * M],
  ])
    for (const [cards, dealer, mult] of [
      [[9, 8], [9, 7], 2],
      [[0, 9], [9, 7], 2.5],
      [[9, 8], [9, 8], 1],
      [[9, 8], [9, 9], 0],
      [[0, 9], [0, 9], 1],
      [[9, 5, 4], [0, 9], 0],
      [[9, 8, 7], [9, 8, 7], 0],
    ] as [number[], number[], number][]) {
      assert.equal(
        payout({ id: "a", own, free, cards, done: true }, dealer),
        (own + free) * mult,
      );
    }
});
test("Soft 17, mehrere Asse, Einsatzgrenzen und geteilte Hände", () => {
  assert.equal(score([0, 13, 8]), 21);
  const table: Casino = {
    host: "a",
    bonus: 10 * M,
    queue: ["a", "b"],
    arrived: ["a", "b"],
    answers: ["a", "b"],
    seats: ["a", "b"],
    hands: [],
    dealer: [0, 5],
    shoe: [2, 3, 4],
    cursor: 0,
  };
  assert.throws(() => joinCasino(table, "b", 10.5 * M, 100 * M));
  assert.throws(() => joinCasino(table, "a", 40.5 * M, 100 * M));
  joinCasino(table, "a", 40 * M, 100 * M);
  joinCasino(table, "b", 10 * M, 10 * M);
  assert.throws(() => joinCasino(table, "b", M, 20 * M));
  table.hands[0].cards = [7, 20];
  assert.equal(canSplit(table.hands[0], 40 * M), true);
  assert.equal(canSplit(table.hands[0], 39 * M), false);
  splitHand(table, 0);
  assert.deepEqual(table.hands.map((hand) => [hand.id, hand.cards.length, hand.split]), [["a", 2, true], ["a", 2, true], ["b", 0, undefined]]);
  assert.equal(payout({ id: "a", own: M, free: 0, cards: [0, 9], done: true, split: true }, [9, 7]), 2 * M);
  dealerFinish(table);
  assert.equal(table.dealer.length, 2);
});

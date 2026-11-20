import test from "node:test";
import assert from "node:assert/strict";
import { board, groups, rate } from "../game/board.ts";
test("Brettseiten, Branchen und Rappen", () => {
  assert.equal(board.length, 40);
  assert.equal(groups.length, 10);
  assert.deepEqual(
    groups
      .slice(0, 8)
      .map((_, index) => board.filter((tile) => tile.group === index).length),
    [2, 3, 3, 3, 3, 3, 3, 2],
  );
  assert.ok(
    board
      .filter((tile) => tile.group === 6 || tile.group === 7)
      .every((tile) => tile.id > 30),
  );
  assert.equal(rate(101, 5000), 51);
  assert.throws(() => rate(Infinity, 100));
});

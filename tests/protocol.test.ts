import test from "node:test";
import assert from "node:assert/strict";
import { envelope } from "../server/protocol.ts";
test("Netzwerkvertrag akzeptiert Absichten, keine Ergebnisse oder gebrochenen Rappen", () => {
  const packet = {
    actionId: crypto.randomUUID(),
    epoch: 1,
    version: 2,
    cmd: { type: "ROLL_DICE" },
  };
  assert.ok(envelope.safeParse(packet).success);
  for (const cmd of [
    { type: "ROLL_DICE", dice: [6, 6] },
    { type: "BID", amount: 0.5 },
    { type: "PLACE_CASINO_BET", amount: -1 },
    { type: "REACT", yes: "false" },
  ])
    assert.equal(envelope.safeParse({ ...packet, cmd }).success, false);
});

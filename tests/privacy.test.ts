import test from "node:test";
import assert from "node:assert/strict";
import { newGame, player } from "../game/model.ts";
import { project } from "../game/view.ts";
import { apply } from "../game/engine.ts";
import { bulletins } from "../ui/notifications.ts";
test("Besitzanzahl zählt Firmen, Flughafen und VC auch bei verborgenem Konto und wechselt mit dem Eigentum", () => {
  const state = newGame(player("anna", "Anna", 0));
  state.players.push(player("ben", "Ben", 1));
  state.settings.hidden = true;
  for (const id of [1, 5, 12]) state.assets[id].owner = "ben";
  state.assets[1].levels = [100, 100];
  state.assets[5].loan = 300;
  const counts = () =>
    project(state, "anna").players.map((person) => person.propertyCount);
  assert.deepEqual(counts(), [0, 3]);
  assert.equal(project(state, "anna").players[1].cash, undefined);
  state.assets[1].owner = "anna";
  assert.deepEqual(counts(), [1, 2]);
});
test("Kursmeldungen bündeln einen Marktschritt, zeigen reale Änderungen und respektieren den Lesestand", () => {
  const state = newGame(player("a", "Anna", 0));
  state.events = [
    {
      seq: 1,
      time: 10,
      kind: "Markt",
      text: "",
      changes: [{ tile: 1, before: 100, after: 105 }],
    },
    {
      seq: 2,
      time: 10,
      kind: "Markt",
      text: "",
      changes: [
        { tile: 3, before: 100, after: 105 },
        { tile: 6, before: 100, after: 100 },
      ],
    },
  ];
  const v = project(state, "a"),
    feed = bulletins(v, 0, []);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].title, "ICT (CH) steigt");
  assert.match(feed[0].text, /2 Firmen.*\+5 %/);
  assert.deepEqual(bulletins(v, 2, []), []);
  assert.equal(bulletins(v, 1, [])[0].title, "Swisscom steigt");
});
test("Direktnachrichten erreichen nur Absender und Empfänger, Tischchat alle Plätze", () => {
  let state = newGame(player("a", "Anna", 0));
  state.players.push(player("b", "Ben", 1), player("c", "Caro", 2));
  state = apply(
    state,
    "a",
    { type: "CHAT", text: "Nur für Ben", to: "b" },
    1000,
  );
  state = apply(state, "a", { type: "CHAT", text: "An den Tisch" }, 2000);
  for (const id of ["a", "b"])
    assert.deepEqual(
      project(state, id).chat.map((message) => message.text),
      ["Nur für Ben", "An den Tisch"],
    );
  assert.deepEqual(
    project(state, "c").chat.map((message) => message.text),
    ["An den Tisch"],
  );
  assert.throws(() =>
    apply(
      state,
      "a",
      { type: "CHAT", text: "Falsch adressiert", to: "nicht-im-raum" },
      3000,
    ),
  );
});
test("Empfängerpayload enthält keine verborgenen Schlüssel oder Dealerkarte", () => {
  const s = newGame(player("a", "Anna", 0));
  s.players.push(player("b", "Lara", 1));
  s.settings.hidden = true;
  s.players[1].cash = 123456789;
  s.players[1].cards = ["C19"];
  s.casino = {
    host: "a",
    bonus: 10 * 100_000_000,
    queue: ["a", "b"],
    arrived: [],
    answers: [],
    seats: [],
    hands: [],
    dealer: [2, 51],
    shoe: [31],
    cursor: 0,
  };
  const payload = JSON.stringify(project(s, "a"));
  assert.ok(!/123456789|"shoe"|"decks"|C19|"discards"/.test(payload));
  assert.deepEqual(JSON.parse(payload).casino.dealer, [2]);
  assert.equal("cash" in JSON.parse(payload).players[1], false);
});

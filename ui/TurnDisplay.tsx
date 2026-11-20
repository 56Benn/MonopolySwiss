import { useEffect, useState } from "react";
import { Dices, Layers3 } from "lucide-react";
import { board, money, M } from "../game/board";
import { card } from "../game/cards";
import { diceText, moveMs, revealMs, travelTime } from "../game/dice";
import type { View } from "../game/view";

const moves = { start: "fährt direkt zum START", zurich: "fährt zum Flughafen Zürich", next: "fährt zur nächsten Firma", back: "geht drei Felder zurück", jail: "muss direkt ins Gefängnis" } as const;
export function cardLines(v: View) {
  const drawn = card(v.lastCard), effect = drawn.effect, p = v.players[v.turn], me = p.id === v.me;
  if (effect.kind === "market") {
    const market = v.events.filter((event) => event.kind === "Markt" && event.cause === drawn.name);
    const latest = market.at(-1)?.time;
    return market.filter((event) => event.time === latest).map((event) => {
      const match = /^(.*) ([+−])(\d+) %$/.exec(event.text);
      return match ? `${match[1]} ${match[2] === "+" ? "steigt" : "fällt"} um ${match[3]} %.` : event.text;
    });
  }
  if (effect.kind === "cash")
    return [effect.amount > 0 ? `${me ? "Du erhältst" : `${p.name} erhält`} CHF ${money(effect.amount * M)}.` : `${me ? "Du musst" : `${p.name} muss`} CHF ${money(-effect.amount * M)} bezahlen.`];
  if (effect.kind === "portfolio")
    return [effect.amount > 0 ? `${me ? "Du erhältst" : `${p.name} erhält`} ${effect.amount} % des eigenen Firmenwerts (höchstens CHF 30M).` : `${me ? "Du musst" : `${p.name} muss`} ${-effect.amount} % des eigenen Firmenwerts bezahlen (höchstens CHF 25M).`];
  if (effect.kind === "move") return [`${me ? "Du" : p.name} ${moves[effect.target].replace(/^fährt/, me ? "fährst" : "fährt").replace(/^geht/, me ? "gehst" : "geht").replace(/^muss/, me ? "musst" : "muss")}.`];
  if (effect.kind === "keep") return [me ? "Diese Karte bleibt in deiner Hand." : `${p.name} behält diese Karte.`];
  return [`${me ? "Du wählst" : `${p.name} wählt`}: sicher CHF 5M oder 50/50 +35M bzw. −20M.`];
}

export function useTrip(v: View | null) {
  const movement = v?.movement,
    at = movement?.at ? movement.at + (v?.clockOffset ?? 0) : 0,
    steps = movement?.path.length ?? 0,
    linger = v?.lastCard ? 4000 : 0;
  const [stamp, setStamp] = useState(Date.now);
  useEffect(() => {
    if (!at) return;
    let timer: ReturnType<typeof setTimeout>;
    function update() {
      const now = Date.now();
      setStamp(now);
      if (now < at + travelTime(steps, movement?.transfer) + linger)
        timer = setTimeout(update, 100);
    }
    update();
    return () => clearTimeout(timer);
  }, [at, steps, linger,movement?.transfer]);
  const age = Math.max(0, Math.max(stamp, Date.now()) - at),
    duration = travelTime(steps,movement?.transfer), walkAt=movement?.transfer ? 0 : moveMs,
    live = !!at && v?.phase !== "over";
  const travelled =
    age < walkAt
      ? 0
      : Math.min(
          steps,
          Math.floor(((age - walkAt) / Math.max(1, duration - walkAt)) * steps),
        );
  return {
    at,
    moving: live && age < duration,
    reveal: live && !movement?.transfer && age >= revealMs && age < moveMs,
    rolling: live && !movement?.transfer && age < revealMs,
    showCard: live && age >= duration && age < duration + linger,
    position: travelled ? movement?.path[travelled - 1] : movement?.start,
  };
}
export function TurnDisplay({
  v,
  trip,
}: {
  v: View;
  trip: ReturnType<typeof useTrip>;
}) {
  const [closed, setClosed] = useState(""),
    key = `${v.id}:${v.rolls}:${v.lastCard}`;
  if (trip.reveal || trip.rolling)
    return (
      <div className="roll-readout" role="status">
        <Dices />
        <div>
          <small>{trip.rolling ? "WÜRFELN" : "GEWÜRFELT"}</small>
          <strong>
            {trip.rolling
              ? "Würfel rollen …"
              : v.phase === "bus"
                ? `${diceText(v.dice, v.dice[0] + v.dice[1])} · Ziel wählen`
                : diceText(v.dice, v.movement?.distance ?? 0)}
          </strong>
        </div>
      </div>
    );
  if (!v.lastCard || !trip.showCard || key === closed) return null;
  const drawn = card(v.lastCard), target = v.players[v.turn].pos;
  return (
    <article
      className={`board-card ${v.lastCard.startsWith("C") ? "chance" : ""}`}
      role="status"
      key={key}
    >
      <small>
        <Layers3 size={15} />
        {v.lastCard.startsWith("E") ? "EREIGNIS" : "CHANCE"}
      </small>
      <strong>{drawn.name}</strong>
      {cardLines(v).map((line) => <p key={line}>{line}</p>)}
      {drawn.effect.kind === "move" && <p className="card-target">Ziel: {board[target].short}</p>}
      <button onClick={() => setClosed(key)}>Schliessen</button>
    </article>
  );
}

import { apply, tick } from "./engine.ts";
import { project } from "./view.ts";
import { decide } from "../bots/strategy.ts";
import { openTrade, type Game, type Command } from "./model.ts";
import { travelTime } from "./dice.ts";
export function botReadyAt(s: Game) {
  return s.phase === "buy" && s.movement?.at
    ? s.movement.at + travelTime(s.movement.path.length) + 500
    : 0;
}
export function actor(s: Game, now: number) {
  if (s.phase === "lobby" || s.phase === "over" || s.paused) return null;
  const pending = openTrade(s);
  for (const p of s.players) {
    if (pending && pending.to !== p.id) continue;
    const takeover = !p.online && !p.bot && p.away && now - p.away >= 90000;
    if (!p.bot && !takeover) continue;
    const view = project(s, p.id);
    let cmd: Command | null = null;
    if (p.bot || s.settings.takeover) cmd = decide(view, p.bot ?? "Mittel");
    else if (!s.deadline && s.players[s.turn] === p)
      cmd =
        s.phase === "roll"
          ? { type: "ROLL_DICE" }
          : s.phase === "buy"
            ? { type: "DECLINE" }
            : null;
    if (cmd && (!pending || cmd.type === "TRADE")) return { id: p.id, cmd };
  }
  return null;
}
export function advance(s: Game, now: number) {
  const next = tick(s, now);
  if (next !== s) return next;
  const bot = actor(s, now);
  if (!bot) return s;
  return apply(s, bot.id, bot.cmd, now);
}

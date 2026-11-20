import { board, groups, money } from "../game/board.ts";
import type { View } from "../game/view.ts";

type Message = View["chat"][number];
type Change = NonNullable<View["events"][number]["changes"]>[number];
export const chatThread = (message: Message, me: string) =>
  message.to ? (message.from === me ? message.to : message.from) : "";
export const latestSeq = (v: View) =>
  Math.max(v.events.at(-1)?.seq ?? 0, v.chat.at(-1)?.id ?? 0);
export type Bulletin = { id: number; title: string; text: string } & (
  | { kind: "chat"; thread: string }
  | { kind: "market"; changes: Change[] }
);

export function bulletins(v: View, after: number, muted: string[]): Bulletin[] {
  const result: Bulletin[] = v.chat
    .filter(
      (message) =>
        message.id > after &&
        message.from !== v.me &&
        !muted.includes(message.from),
    )
    .map((message) => ({
      id: message.id,
      kind: "chat",
      thread: chatThread(message, v.me),
      title: `${message.to ? "Direktnachricht" : "Tischchat"} · ${message.name}`,
      text: message.text,
    }));
  const markets = new Map<
    number,
    { id: number; changes: Map<number, Change> }
  >();
  for (const event of v.events) {
    if (event.seq <= after || !event.changes) continue;
    const batch = markets.get(event.time) ?? {
      id: event.seq,
      changes: new Map<number, Change>(),
    };
    batch.id = event.seq;
    for (const change of event.changes)
      batch.changes.set(change.tile, {
        ...change,
        before: batch.changes.get(change.tile)?.before ?? change.before,
      });
    markets.set(event.time, batch);
  }
  for (const batch of markets.values()) {
    const changes = [...batch.changes.values()].filter(
      (change) => change.before !== change.after,
    );
    if (!changes.length) continue;
    const first = changes[0],
      up = changes.filter((change) => change.after > change.before).length;
    const sectors = new Set(changes.map((change) => board[change.tile].group));
    const name =
      changes.length === 1
        ? board[first.tile].short
        : sectors.size === 1
          ? groups[board[first.tile].group]
          : "Markt";
    const direction =
      up === changes.length ? "steigt" : !up ? "fällt" : "in Bewegung";
    const percent = (change: Change) =>
      ((change.after / change.before - 1) * 100).toLocaleString("de-CH", {
        maximumFractionDigits: 2,
        signDisplay: "exceptZero",
      });
    const same = changes.every((change) => percent(change) === percent(first));
    result.push({
      id: batch.id,
      kind: "market",
      title: `${name} ${direction}`,
      text:
        changes.length === 1
          ? `${money(first.before)} → ${money(first.after)} CHF (${percent(first)} %)`
          : same
            ? `${changes.length} Firmen · ${percent(first)} %`
            : `${up} gestiegen · ${changes.length - up} gefallen`,
      changes,
    });
  }
  return result.sort((left, right) => left.id - right.id);
}

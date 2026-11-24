import { card } from "./cards.ts";
import { worth } from "./economy.ts";
import { openTrade, reserved, tradeWindow, type Game } from "./model.ts";
export function project(s: Game, id: string) {
  const me = s.players.find((person) => person.id === id);
  if (!me) throw Error("Kein Platz");
  const reveal = s.phase === "over",
    table = s.casino, pending = openTrade(s);
  return {
    id: s.id,
    me: id,
    code: s.code,
    host: s.host,
    locked: s.locked,
    settings: s.settings,
    phase: s.phase,
    round: s.round,
    turn: s.turn,
    epoch: s.epoch,
    version: s.version,
    deadline: s.deadline,
    tradeUntil: pending ? pending.time + tradeWindow : 0,
    dice: s.dice,
    rolls: s.rolls,
    movement: s.movement,
    bus: s.bus ?? null,
    builds: s.builds ?? {},
    turnBuilds: s.turnBuilds ?? 0,
    extra: s.extra,
    paused: s.paused,
    voteType: s.voteType,
    votes: s.votes,
    players: s.players.map((person) => ({
      id: person.id,
      name: person.name,
      token: person.token,
      photo: person.photo,
      propertyCount: s.assets.filter((asset) => asset.owner === person.id)
        .length,
      bot: person.bot,
      ready: person.ready,
      online: person.online,
      out: person.out,
      pos: person.pos,
      jail: person.jail,
      ...(person.id === id || reveal || !s.settings.hidden
        ? { cash: person.cash }
        : {}),
      ...(person.id === id || reveal
        ? { worth: worth(s, person), history: person.history }
        : {}),
    })),
    own: {
      cards: me.cards,
      ledger: me.ledger,
      cash: me.cash,
      reserved:
        reserved(s, id) +
        (table && !table.settledAt
          ? table.hands.filter((hand) => hand.id === id).reduce((total, hand) => total + hand.own, 0)
          : 0),
      worth: worth(s, me),
    },
    assets: s.assets,
    events: s.events,
    chat: s.chat.filter(
      (message) => !message.to || message.from === id || message.to === id,
    ),
    trades: s.trades.filter((item) => item.from === id || item.to === id),
    counts: Object.fromEntries(
      Object.entries(s.counts).filter(([key]) => key.startsWith(`${id}:`)),
    ),
    auction: s.auction
      ? {
          tile: s.auction.tile,
          bid: s.auction.bid,
          leader: s.auction.leader,
          passed: s.auction.passed ?? [],
        }
      : null,
    debt: s.players[s.turn].id === id ? s.debt : null,
    payment:
      s.phase === "debt" && s.debt && !s.debt.purchase
        ? {
            amount: s.debt.amount,
            reason: s.debt.reason,
            to: s.debt.to,
            raising: s.players[s.turn].cash < s.debt.amount,
            steps: s.debt.steps ?? [],
          }
        : null,
    reaction: s.players[s.turn].id === id ? s.reaction : 0,
    casino: table
      ? {
          host: table.host,
          bonus: table.bonus,
          queue: table.queue,
          arrived: table.arrived,
          answers: table.answers,
          seats: table.seats,
          dealer: table.settledAt ? table.dealer : table.dealer.slice(0, 1),
          hands: table.hands.map(({ id, cards, own, free, done, doubled, split }) => ({
            id,
            cards,
            stake: own + free,
            done,
            doubled: !!doubled,
            split: !!split,
          })),
          cursor: table.cursor,
          dealtAt: table.dealtAt ?? 0,
          settledAt: table.settledAt ?? 0,
          actor: s.phase === "blackjack" ? table.hands[table.cursor]?.id : undefined,
        }
      : null,
    result: s.result,
    lastCard:
      s.lastCard &&
      card(s.lastCard).effect.kind === "keep" &&
      s.players[s.turn].id !== id
        ? ""
        : s.lastCard,
    winners: s.winners,
    stats: reveal ? s.stats : null,
  };
}
export type View = ReturnType<typeof project> & { clockOffset?: number };

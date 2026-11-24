import { board, M } from "./board.ts";
import { cards } from "./cards.ts";
import { shuffle, secure, type Random, type Casino } from "./casino.ts";
export type Difficulty = "Einfach" | "Mittel" | "Schwer";
export type Settings = {
  start: number;
  dice: 2 | 3;
  win: "last" | "first" | "goal";
  goal: number;
  hidden: boolean;
  volatility: "Ruhig" | "Normal" | "Wild";
  auto: boolean;
  auctions: boolean;
  limit: 0 | 90 | 120;
  rent: 7500 | 10000 | 12500;
  full: boolean;
  even: boolean;
  perRound: boolean;
  takeover: boolean;
  competitive: boolean;
  loanRounds: number;
};
export const loanTerms = [3, 4, 5, 6, 8, 10];
export const defaults: Settings = {
  start: 500,
  dice: 2,
  win: "last",
  goal: 2000,
  hidden: false,
  volatility: "Normal",
  auto: true,
  auctions: true,
  limit: 90,
  rent: 10000,
  full: true,
  even: true,
  perRound: false,
  takeover: true,
  competitive: false,
  loanRounds: 5,
};
export const presets: Record<string, Settings> = {
  Entspannt: {
    ...defaults,
    start: 750,
    volatility: "Ruhig",
    rent: 7500,
    limit: 0,
  },
  Börsenabend: defaults,
  "Chaos an der Börse": {
    ...defaults,
    dice: 3,
    volatility: "Wild",
    auto: true,
    rent: 12500,
  },
};
export function validSettings(s: Settings) {
  if (
    ![250, 500, 750, 1000].includes(s.start) ||
    ![2, 3].includes(s.dice) ||
    !["last", "first", "goal"].includes(s.win) ||
    !Number.isSafeInteger(s.goal) ||
    s.goal > 1000000 ||
    s.goal <= 0 ||
    (s.win === "goal" && s.goal <= s.start) ||
    !["Ruhig", "Normal", "Wild"].includes(s.volatility) ||
    ![0, 90, 120].includes(s.limit) ||
    ![7500, 10000, 12500].includes(s.rent) ||
    !loanTerms.includes(s.loanRounds) ||
    (
      ["hidden", "auto", "auctions", "full", "even", "perRound", "takeover", "competitive"] as const
    ).some((key) => typeof s[key] !== "boolean")
  )
    throw Error("Ungültige Regeln: Ziel muss über dem Startguthaben liegen.");
}
export type Player = {
  id: string;
  name: string;
  token: number;
  photo?: string;
  bot: Difficulty | null;
  ready: boolean;
  online: boolean;
  away: number;
  cash: number;
  pos: number;
  jail: number;
  out: boolean;
  cards: string[];
  ledger: { time: number; delta: number; reason: string }[];
  history: number[];
};
export type Asset = {
  owner: string | null;
  value: number;
  loan: number;
  /** Runde, in der das Darlehen zu Beginn des eigenen Zugs zurückgezahlt werden muss. */
  due?: number;
  levels: number[];
  history: number[];
};
export type Bundle = { cash: number; assets: number[]; cards: string[] };
export type Trade = {
  id: string;
  from: string;
  to: string;
  give: Bundle;
  want: Bundle;
  round: number;
  time: number;
  status: "Offen" | "Angenommen" | "Abgelehnt" | "Zurückgezogen" | "Abgelaufen";
  quote: { id: number; value: number; loan: number; level: number }[];
};
export type Phase =
  | "lobby"
  | "roll"
  | "bus"
  | "travel"
  | "buy"
  | "auction"
  | "manage"
  | "debt"
  | "choice"
  | "insurance"
  | "casinoInvite"
  | "casinoJoin"
  | "casinoBet"
  | "blackjack"
  | "casinoSettle"
  | "over";
export type Event = {
  seq: number;
  time: number;
  round?: number;
  kind: "Zug" | "Markt" | "Konto" | "Lobby" | "Casino" | "Spiel";
  text: string;
  cause?: string;
  changes?: { tile: number; before: number; after: number }[];
};
export type ChatMessage = {
  id: number;
  from: string;
  to?: string;
  name: string;
  text: string;
  time: number;
  system?: boolean;
  phrase?: { kind: "jail" | "casino"; index: number };
};
export type Game = {
  boardEdition?: number;
  arrival?: { target:number; bonus:boolean; jail:boolean; depth:number };
  bus?: { steps: number; target: number }[];
  builds?: Record<string, number>;
  turnBuilds?: number;
  saleQueue?: number[];
  id: string;
  code: string;
  host: string;
  locked: boolean;
  settings: Settings;
  players: Player[];
  assets: Asset[];
  phase: Phase;
  round: number;
  turn: number;
  version: number;
  epoch: number;
  deadline: number;
  turnDeadline?: number;
  dice: number[];
  rolls: number;
  movement: {
    player: string;
    roll: number;
    at?: number;
    start?: number;
    distance?: number;
    transfer?: boolean;
    path: number[];
    stage: "Würfeln" | "Bewegung" | "Feldauflösung";
  } | null;
  doubles: number;
  extra: boolean;
  decks: string[][];
  discards: string[][];
  events: Event[];
  seq: number;
  chat: ChatMessage[];
  trades: Trade[];
  counts: Record<string, number>;
  casino: Casino | null;
  result: {
    dealer: number[];
    hands: { id: string; cards: number[]; paid: number; net: number; stake?: number }[];
  } | null;
  auction: {
    tile: number;
    bid: number;
    leader: string | null;
    max: number;
    queue: number[];
    passed?: string[];
    resumeRoll?: boolean;
  } | null;
  debt: {
    amount: number;
    to: string | null;
    reason: string;
    purchase?: { tile: number; coupon: boolean };
    /** Fällige Darlehen, die mit dieser Zahlung getilgt werden. */
    loans?: number[];
    /** Nach der Zahlung geht der Zug mit dem Würfeln weiter. */
    resume?: boolean;
    /** Öffentlich sichtbare Schritte der Geldbeschaffung. */
    steps?: { tile: number; op: "loan" | "reduce" | "sell"; amount: number }[];
  } | null;
  reaction: number;
  winners: string[];
  paused: boolean;
  remaining: number;
  pausedAt?: number;
  votes: string[];
  voteType: "pause" | "quit" | null;
  resumeAt: number;
  stats: { deal: number; casino: number };
  lastCard: string;
};
export const tradeWindow = 30_000;
export function migrateBoard(game:Game){
  if((game.boardEdition??1)>=2)return game;
  const swap=(id:number)=>id===22?28:id===28?22:id;
  [game.assets[22],game.assets[28]]=[game.assets[28],game.assets[22]];
  for(const person of game.players)person.pos=swap(person.pos);
  for(const trade of game.trades){trade.give.assets=trade.give.assets.map(swap);trade.want.assets=trade.want.assets.map(swap);for(const quote of trade.quote)quote.id=swap(quote.id);}
  for(const event of game.events)for(const item of event.changes??[])item.tile=swap(item.tile);
  if(game.auction){game.auction.tile=swap(game.auction.tile);game.auction.queue=game.auction.queue.map(swap);}
  game.movement=null;game.boardEdition=2;return game;
}
export const openTrade = (s: Game) => s.trades.find(trade => trade.status === "Offen");
export const player = (
  id: string,
  name: string,
  token: number,
  bot: Difficulty | null = null,
): Player => ({
  id,
  name,
  token,
  bot,
  ready: !!bot,
  online: true,
  away: 0,
  cash: 0,
  pos: 0,
  jail: 0,
  out: false,
  cards: [],
  ledger: [],
  history: [],
});
export function newGame(host: Player, code = "", rng: Random = secure): Game {
  return {
    id: crypto.randomUUID(),
    boardEdition: 2,
    code,
    host: host.id,
    locked: false,
    settings: { ...defaults },
    players: [host],
    assets: board.map((tile) => ({
      owner: null,
      value: tile.base,
      loan: 0,
      levels: [],
      history: [tile.base],
    })),
    phase: "lobby",
    round: 0,
    turn: 0,
    version: 0,
    epoch: 0,
    deadline: 0,
    dice: [4, 2],
    rolls: 0,
    movement: null,
    doubles: 0,
    extra: false,
    decks: ["E", "C"].map((prefix) =>
      shuffle(
        cards
          .filter((item) => item.id.startsWith(prefix))
          .map((item) => item.id),
        rng,
      ),
    ),
    discards: [[], []],
    events: [],
    seq: 0,
    chat: [],
    trades: [],
    counts: {},
    casino: null,
    result: null,
    auction: null,
    debt: null,
    reaction: 0,
    winners: [],
    paused: false,
    remaining: 0,
    votes: [],
    voteType: null,
    resumeAt: 0,
    stats: { deal: 0, casino: 0 },
    lastCard: "",
  };
}
export type Command =
  | {
      type:
        | "READY"
        | "START"
        | "ROLL_DICE"
        | "DECLINE"
        | "CONFIRM_PAYMENT"
        | "PASS_BID"
        | "BAIL"
        | "LAWYER"
        | "JAIL_WAIT"
        | "BLACKJACK_HIT"
        | "BLACKJACK_STAND"
        | "BLACKJACK_DOUBLE"
        | "BLACKJACK_SPLIT"
        | "CASINO_ENTER"
        | "CASINO_SKIP"
        | "RESIGN"
        | "LOCK"
        | "RESUME";
    }
  | { type: "CASINO_JOIN"; yes: boolean }
  | { type: "BUS_CHOOSE"; steps: number }
  | { type: "VOTE"; issue: "pause" | "quit" }
  | { type: "TEST_TRAVEL"; target:"casino"|"jail" }
  | { type: "SETTINGS"; settings: Settings }
  | { type: "BOT"; level: Difficulty; seat?: string }
  | { type: "REMOVE"; seat: string }
  | { type: "CHAT"; text: string; to?: string }
  | { type: "BUY_COMPANY"; coupon?: boolean }
  | { type: "BID"; amount: number }
  | {
      type: "ASSET";
      tile: number;
      op: "build" | "reduce" | "loan" | "repay" | "sell";
    }
  | { type: "REACT"; yes: boolean }
  | { type: "PLACE_CASINO_BET"; amount: number | null }
  | { type: "PROPOSE_TRADE"; to: string; give: Bundle; want: Bundle }
  | { type: "TRADE"; id: string; op: "accept" | "reject" | "withdraw" };
export const log = (
  s: Game,
  time: number,
  kind: Event["kind"],
  text: string,
  cause?: string,
) => {
  s.events.push({ seq: ++s.seq, time, kind, text, round: s.round, ...(cause ? { cause } : {}) });
  s.events = s.events.slice(-80);
};
export function say(s: Game, message: Omit<ChatMessage, "id">) {
  s.chat = [...s.chat, { id: ++s.seq, ...message }].slice(-60);
}
export const current = (s: Game) => s.players[s.turn];
export const reserved = (s: Game, id: string) =>
  s.auction?.leader === id ? s.auction.bid : 0;
export const balance = (s: Game, id: string) =>
  s.players.find((person) => person.id === id)!.cash - reserved(s, id);
export function book(p: Player, delta: number, reason: string, time: number) {
  if (
    !Number.isSafeInteger(delta) ||
    !Number.isSafeInteger(p.cash + delta) ||
    p.cash + delta < 0
  )
    throw Error("Nicht genügend freies Guthaben");
  p.cash += delta;
  p.ledger.push({ time, delta, reason });
  p.ledger = p.ledger.slice(-80);
}
export const seedFunds = (p: Player, s: Settings, now: number) =>
  book(p, s.start * M, "Startguthaben", now);

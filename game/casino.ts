import { M, rate } from "./board.ts";
export type Random = (limit: number) => number;
export const secure: Random = (limit) => {
  const values = new Uint32Array(1);
  const cap = 2 ** 32 - (2 ** 32 % limit);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= cap);
  return values[0] % limit;
};
export function shuffle<T>(input: T[], rng: Random) {
  const list = input.slice();
  for (let index = list.length - 1; index > 0; index--) {
    const swap = rng(index + 1);
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return list;
}
export type Hand = {
  id: string;
  own: number;
  free: number;
  cards: number[];
  done: boolean;
  doubled?: boolean;
  split?: boolean;
};
export type Casino = {
  host: string;
  bonus: number;
  queue: string[];
  arrived: string[];
  answers: string[];
  seats: string[];
  hands: Hand[];
  dealer: number[];
  shoe: number[];
  cursor: number;
  dealtAt?: number;
  settledAt?: number;
};
export const casinoBonus = 10 * M;
export const dealStep = 550;
export const stakeLimit = (table: Pick<Casino, "host" | "bonus">, id: string) =>
  id === table.host ? 4 * table.bonus : table.bonus;
export const cardValue = (value: number) => {
  const rank = (value % 13) + 1;
  return rank === 1 ? 11 : Math.min(10, rank);
};
export const canSplit = (hand: Hand, cash: number) =>
  hand.cards.length === 2 &&
  !hand.split &&
  !hand.doubled &&
  hand.cards[0] % 13 === hand.cards[1] % 13 &&
  cash >= hand.own;
export const canDouble = (hand: Hand, cash: number) =>
  hand.cards.length === 2 && !hand.doubled && cash >= hand.own;
export function settleTime(table: Casino) {
  return 1600 + Math.max(0, table.dealer.length - 2) * 900 + table.hands.length * 2600 + 2400;
}
export function score(cards: number[]) {
  let soft = 0,
    total = 0;
  for (const value of cards) {
    const rank = (value % 13) + 1;
    total += rank === 1 ? 11 : Math.min(10, rank);
    if (rank === 1) soft++;
  }
  while (total > 21 && soft) {
    total -= 10;
    soft--;
  }
  return total;
}
export const natural = (values: number[]) =>
  values.length === 2 && score(values) === 21;
export function payout(hand: Hand, dealer: number[]) {
  const total = hand.own + hand.free,
    points = score(hand.cards),
    house = score(dealer);
  const blackjack = natural(hand.cards) && !hand.split;
  if (points > 21) return 0;
  if (natural(dealer)) return blackjack ? total : 0;
  if (blackjack) return rate(total, 25000);
  return house > 21 || points > house
    ? total * 2
    : points === house
      ? total
      : 0;
}
export function joinCasino(
  table: Casino,
  id: string,
  amount: number,
  cash: number,
) {
  if (!table.seats.includes(id) || table.hands.some((hand) => hand.id === id))
    throw Error("Einsatzfenster geschlossen");
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount % (M / 2) ||
    amount > cash ||
    amount > stakeLimit(table, id)
  )
    throw Error("Unzulässiger Einsatz");
  table.hands.push({ id, own: amount, free: 0, cards: [], done: false });
}
export function splitHand(table: Casino, index: number) {
  const hand = table.hands[index];
  const second: Hand = { id: hand.id, own: hand.own, free: 0, cards: [hand.cards.pop()!], done: false, split: true };
  hand.split = true;
  table.hands.splice(index + 1, 0, second);
  hand.cards.push(table.shoe.pop()!);
  second.cards.push(table.shoe.pop()!);
  hand.done = score(hand.cards) >= 21;
  second.done = score(second.cards) >= 21;
}
export function deal(table: Casino, rng: Random) {
  table.hands.sort(
    (left, right) =>
      table.seats.indexOf(left.id) - table.seats.indexOf(right.id),
  );
  table.shoe = shuffle(
    Array.from({ length: 312 }, (_, index) => index % 52),
    rng,
  );
  for (let turn = 0; turn < 2; turn++) {
    for (const hand of table.hands) hand.cards.push(table.shoe.pop()!);
    table.dealer.push(table.shoe.pop()!);
  }
  for (const hand of table.hands)
    hand.done = natural(hand.cards) || natural(table.dealer);
}
export function dealerFinish(table: Casino) {
  if (
    table.hands.some((hand) => score(hand.cards) <= 21 && !natural(hand.cards))
  )
    while (score(table.dealer) < 17) table.dealer.push(table.shoe.pop()!);
}

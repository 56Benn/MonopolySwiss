import { board, M, rate, taxes } from "../game/board.ts";
import { couponCap } from "../game/cards.ts";
import { score, stakeLimit } from "../game/casino.ts";
import { buildBlock, buildPrice, members, quotedRent, repayAmount } from "../game/economy.ts";
import type { Command, Difficulty, Bundle } from "../game/model.ts";
import type { View } from "../game/view.ts";

const floorM = (amount: number) => Math.max(0, Math.floor(amount / M) * M);
export function decide(v: View, level: Difficulty): Command | null {
  const me = v.players.find((person) => person.id === v.me)!;
  if (me.out || v.paused || v.phase === "over" || v.phase === "lobby") return null;
  const owner = (id: number) => v.assets[id].owner;
  const ownedBy = (who: string) => board.filter((tile) => owner(tile.id) === who);
  const familyOf = (id: number) => members(id).filter((tile) => tile.id !== id);
  const tradeable = (id: number) => members(id).every((tile) => !v.assets[tile.id].levels.length);
  const expectedRent = (id: number) => {
    const tile = board[id], asset = v.assets[id];
    if (!asset.owner || asset.loan || tile.group < 0) return 0;
    if (v.players.find((person) => person.id === asset.owner)?.jail) return 0;
    const count = members(id).filter((other) => owner(other.id) === asset.owner && !v.assets[other.id].loan).length;
    return quotedRent(tile.group, asset.value, count, count === members(id).length, asset.levels.length, 7, v.settings.rent);
  };
  const exposure = board.reduce((risk, tile) => {
    const distance = (tile.id - me.pos + 40) % 40;
    if (owner(tile.id) === me.id || distance < 2 || distance > 6 * v.settings.dice) return risk;
    return Math.max(risk, expectedRent(tile.id));
  }, 0);
  const reserve = (level === "Einfach" ? 90 : level === "Mittel" ? 60 : 45) * M + exposure * (level === "Einfach" ? 0.6 : level === "Mittel" ? 0.8 : 1);
  const free = v.own.cash - reserve,
    active = v.players[v.turn].id === me.id;
  /** Wert einer Firma für einen Platz: Branchenfortschritt zählt mehr als der reine Kurs. */
  const worthFor = (id: number, who: string) => {
    const tile = board[id], asset = v.assets[id], family = familyOf(id);
    const held = family.filter((other) => owner(other.id) === who).length;
    const blocked = family.some((other) => owner(other.id) && owner(other.id) !== who);
    const multiplier = held === family.length ? 1.6 : held ? 1.2 : blocked ? 0.7 : tile.group >= 8 ? 0.95 : 0.9;
    return (asset.value - asset.loan) * multiplier;
  };
  const completesFor = (id: number, who: string) => familyOf(id).every((other) => owner(other.id) === who);
  const rivals = v.players.filter((person) => !person.out && person.id !== me.id);
  const denial = (id: number) => rivals.some((person) => completesFor(id, person.id) && familyOf(id).length > 0);
  const bundleWorth = (bundle: Bundle, receiver: string) =>
    bundle.cash + bundle.cards.length * 10 * M + bundle.assets.reduce((total, id) => total + worthFor(id, receiver), 0);

  const table = v.casino;
  if (v.phase === "casinoInvite" && table && !table.arrived.includes(me.id)) return { type: "CASINO_ENTER" };
  if (v.phase === "casinoJoin" && table && !table.answers.includes(me.id))
    return { type: "CASINO_JOIN", yes: v.own.cash >= M && (table.host === me.id || free > 100 * M) };
  if (v.phase === "casinoBet" && table?.seats.includes(me.id) && !table.hands.some((hand) => hand.id === me.id))
    return { type: "PLACE_CASINO_BET", amount: Math.min(Math.floor(v.own.cash / (M / 2)) * (M / 2), table.host === me.id ? table.bonus : M, stakeLimit(table, me.id)) };
  if (v.phase === "blackjack" && table?.actor === me.id) {
    const hand = table.hands[table.cursor], points = score(hand.cards), up = score(table.dealer),
      pair = hand.cards.length === 2 && hand.cards[0] % 13 === hand.cards[1] % 13;
    if (pair && !hand.split && [0, 7].includes(hand.cards[0] % 13) && v.own.cash >= hand.stake) return { type: "BLACKJACK_SPLIT" };
    if (hand.cards.length === 2 && !hand.doubled && (points === 10 || points === 11) && up < 10 && v.own.cash >= hand.stake) return { type: "BLACKJACK_DOUBLE" };
    return { type: points < 12 || (points < 17 && up >= 7) ? "BLACKJACK_HIT" : "BLACKJACK_STAND" };
  }

  if (v.phase === "roll") {
    const trade = v.trades.find((other) => other.to === me.id && other.status === "Offen");
    if (trade) {
      const proposer = trade.from;
      const incoming = bundleWorth(trade.give, me.id);
      let outgoing = trade.want.cash + trade.want.cards.length * 10 * M;
      for (const id of trade.want.assets) {
        outgoing += worthFor(id, me.id);
        if (completesFor(id, proposer)) outgoing += v.assets[id].value * (level === "Einfach" ? 0.3 : 0.6);
      }
      const affordable = trade.want.cash - trade.give.cash <= Math.max(0, free + reserve * 0.3);
      const margin = level === "Einfach" ? 0.97 : level === "Mittel" ? 1.03 : 1.08;
      return { type: "TRADE", id: trade.id, op: affordable && incoming >= outgoing * margin ? "accept" : "reject" };
    }
  }

  if (v.phase === "auction") {
    const sale = v.auction!;
    if (sale.leader === me.id || sale.passed.includes(me.id)) return null;
    const value = v.assets[sale.tile].value;
    const fair = worthFor(sale.tile, me.id) * (denial(sale.tile) ? 1.15 : 1);
    const cap = floorM(Math.min(v.own.cash - reserve * 0.8, fair * (level === "Einfach" ? 0.7 : level === "Mittel" ? 0.85 : 0.95)));
    const step = Math.max(M, floorM(value * 0.05));
    if (fair < value * 0.5 || sale.bid + M > cap) return { type: "PASS_BID" };
    // Große Sprünge Richtung Obergrenze halten Auktionen kurz.
    return { type: "BID", amount: Math.min(cap, Math.max(sale.bid + step, floorM(value * 0.4), floorM(sale.bid + (cap - sale.bid) / 2))) };
  }

  if (!active) return null;

  if (v.phase === "bus" && v.bus?.length) {
    const appeal = (id: number) => {
      const tile = board[id], asset = v.assets[id];
      if (tile.group >= 0 && !asset.owner) return asset.value <= v.own.cash - reserve * 0.5 ? worthFor(id, me.id) * 0.3 : 0;
      if (tile.group >= 0 && asset.owner === me.id) return 2 * M;
      if (tile.group >= 0) return -expectedRent(id);
      return tile.base ? -(taxes[id] ? Math.max(tile.base, v.own.cash * 0.1) : tile.base) : tile.id === 20 ? 10 * M : 0;
    };
    const best = [...v.bus].sort((left, right) => appeal(right.target) - appeal(left.target))[0];
    return { type: "BUS_CHOOSE", steps: best.steps };
  }

  if (v.phase === "debt" && v.debt?.purchase) return { type: v.own.cash >= v.debt.amount ? "CONFIRM_PAYMENT" : "DECLINE" };
  if (v.phase === "debt" && v.debt) {
    if (v.own.cash >= v.debt.amount) return { type: "CONFIRM_PAYMENT" };
    const owned = ownedBy(me.id);
    const levelled = [...owned].sort((left, right) => v.assets[right.id].levels.length - v.assets[left.id].levels.length)[0];
    if (levelled && v.assets[levelled.id].levels.length) return { type: "ASSET", tile: levelled.id, op: "reduce" };
    const cheap = [...owned].sort((left, right) => worthFor(left.id, me.id) - worthFor(right.id, me.id));
    const loan = cheap.find((tile) => !v.assets[tile.id].loan);
    if (loan) return { type: "ASSET", tile: loan.id, op: "loan" };
    const sale = cheap.find((tile) => rate(v.assets[tile.id].value, 6000) > v.assets[tile.id].loan);
    return sale ? { type: "ASSET", tile: sale.id, op: "sell" } : { type: "CONFIRM_PAYMENT" };
  }

  if (v.phase === "buy") {
    const tile = board[me.pos], price = v.assets[me.pos].value - (v.own.cards.includes("C22") ? Math.min(couponCap, rate(v.assets[me.pos].value, 1500)) : 0);
    if (v.own.cash < price) return { type: "DECLINE" };
    const after = v.own.cash - price, family = familyOf(me.pos), held = family.filter((other) => owner(other.id) === me.id).length;
    const strategic = held > 0 || (level === "Schwer" && denial(me.pos));
    const worthwhile = worthFor(me.pos, me.id) >= price * (level === "Einfach" ? 1 : 0.85) || strategic || tile.group >= 8;
    const buy = worthwhile && (after >= reserve || (strategic && after >= reserve * 0.5));
    return buy ? { type: "BUY_COMPANY", coupon: v.own.cards.includes("C22") } : { type: "DECLINE" };
  }

  if (v.phase === "choice" || v.phase === "insurance") return { type: "REACT", yes: v.phase === "insurance" };

  if (v.phase === "roll") {
    // Darlehen vor der Fälligkeit tilgen, sobald es die Reserve erlaubt; kurz vor Frist auch knapper.
    const loan = ownedBy(me.id)
      .filter((tile) => v.assets[tile.id].loan)
      .sort((left, right) => (v.assets[left.id].due ?? Infinity) - (v.assets[right.id].due ?? Infinity))[0];
    if (loan) {
      const cost = repayAmount(v.assets[loan.id].loan), urgent = (v.assets[loan.id].due ?? Infinity) - v.round <= 1;
      if (cost <= (urgent ? v.own.cash - reserve * 0.4 : free)) return { type: "ASSET", tile: loan.id, op: "repay" };
    }
    if (level !== "Einfach") {
      const proposal = propose();
      if (proposal) return proposal;
      const candidates = ownedBy(me.id)
        .filter((tile) => !buildBlock(v, me.id, tile.id) && familyOf(tile.id).every((other) => owner(other.id) === me.id))
        .sort((left, right) => v.assets[left.id].levels.length - v.assets[right.id].levels.length || v.assets[right.id].value - v.assets[left.id].value);
      const build = candidates.find((tile) => buildPrice(v.assets[tile.id].value) <= free);
      if (build) return { type: "ASSET", tile: build.id, op: "build" };
    }
    return me.jail && v.own.cards.some((id) => id === "C19" || id === "C20") ? { type: "LAWYER" } : { type: "ROLL_DICE" };
  }
  return null;

  function propose(): Command | null {
    const asked = new Set(v.trades.filter((trade) => trade.from === me.id && trade.round >= v.round - 1).flatMap((trade) => trade.want.assets));
    const wanted = board
      .filter((tile) => {
        const holder = owner(tile.id);
        if (tile.group < 0 || tile.group >= 8 || !holder || holder === me.id || asked.has(tile.id) || !tradeable(tile.id) || v.assets[tile.id].loan) return false;
        if (v.counts[`${me.id}:${holder}`]) return false;
        const family = familyOf(tile.id), held = family.filter((other) => owner(other.id) === me.id).length;
        return held > 0 && held >= family.length - 1;
      })
      .sort((left, right) => worthFor(right.id, me.id) - worthFor(left.id, me.id))[0];
    if (!wanted) return null;
    const partner = owner(wanted.id)!, value = v.assets[wanted.id].value;
    const seed = (v.round * 7 + wanted.id * 3 + me.token) % 3;
    const mine = ownedBy(me.id).filter((tile) => tile.group !== wanted.group && tradeable(tile.id) && !v.assets[tile.id].loan && !familyOf(tile.id).some((other) => owner(other.id) === me.id));
    const swap = [...mine].sort((left, right) => Number(completesFor(right.id, partner)) - Number(completesFor(left.id, partner)) || Math.abs(v.assets[left.id].value - value) - Math.abs(v.assets[right.id].value - value))[0];
    const premium = 1.1 + seed * 0.08;
    if (swap && seed !== 2) {
      const gap = floorM(Math.max(0, value * premium - v.assets[swap.id].value));
      const cash = seed === 0 ? Math.min(gap, floorM(free)) : Math.min(floorM(gap * 0.6), floorM(free));
      if (v.assets[swap.id].value + cash >= value * 0.95)
        return { type: "PROPOSE_TRADE", to: partner, give: { cash, assets: [swap.id], cards: [] }, want: { cash: 0, assets: [wanted.id], cards: [] } };
    }
    const cash = floorM(value * premium);
    if (cash <= free) return { type: "PROPOSE_TRADE", to: partner, give: { cash, assets: [], cards: [] }, want: { cash: 0, assets: [wanted.id], cards: [] } };
    return null;
  }
}

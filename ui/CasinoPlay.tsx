import { score, natural } from "../game/casino";
import { money } from "../game/board";
import type { View } from "../game/view";

const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "B", "D", "K"];
const suits = ["♠", "♥", "♦", "♣"];
const suitNames = ["Pik", "Herz", "Karo", "Kreuz"];

export function PlayingCards({ cards, hidden = false }: { cards: number[]; hidden?: boolean }) {
  return <div className="playing-cards">{cards.map((value, index) => {
    const suit = Math.floor(value / 13), rank = ranks[value % 13];
    return <span key={index} className={`playing-card ${suit === 1 || suit === 2 ? "red-suit" : ""}`} role="img" aria-label={`${suitNames[suit]} ${rank}`}><b>{rank}</b><i>{suits[suit]}</i></span>;
  })}{hidden && <span className="playing-card card-back" role="img" aria-label="Verdeckte Dealerkarte">SM</span>}</div>;
}

export function CasinoMat({v, seat}: {v: View; seat?: string}) {
  const table = v.casino!;
  const bet = v.phase === "casinoBet";
  const hand = table.hands.find(other => other.id === seat) ?? table.hands[0];
  const name = v.players.find(other => other.id === hand?.id)?.name;
  return <section className="casino-mat" aria-label="Blackjack-Kartentisch">
    <header><small>BLACKJACK</small><span>{bet ? "01 · Einsatz" : "02 · Spielen"}</span></header>
    {bet ? <div className="casino-intro"><div className="felt-mark" aria-hidden="true">21</div><h2>Näher an 21 als die Bank</h2><p>Über 21 verlierst du. Ein Ass zählt 1 oder 11, Bildkarten zählen 10.</p><small>{table.answers.length} von {v.players.filter(person => !person.out).length} Plätzen haben entschieden</small></div> : <>
      <div className="hand-lane"><div className="hand-label"><strong>Bank / Dealer</strong><span>{score(table.dealer)} offen</span></div><PlayingCards cards={table.dealer} hidden /></div>
      {hand && <div className="hand-lane"><div className="hand-label"><strong>{hand.id === v.me ? "Deine Hand" : name}</strong><span>{score(hand.cards)} Punkte</span></div><PlayingCards cards={hand.cards} /></div>}
    </>}
  </section>;
}

export function CasinoReceipt({v}: {v: View}) {
  const result = v.result;
  if (!result) return null;
  const dealer = score(result.dealer);
  return <details className="casino-receipt" open={v.phase === "manage" || undefined}>
    <summary>Casino-Abrechnung</summary>
    {!result.hands.length ? <p>Alle haben gepasst. Kein Einsatz, keine Auszahlung.</p> : <>
      <p>Bank: <strong>{dealer} Punkte</strong>{dealer > 21 ? " · über 21" : ""}</p>
      <PlayingCards cards={result.dealer} />
      {result.hands.map(hand => {
        const total = score(hand.cards);
        const verdict = !hand.paid ? (total > 21 ? "Verloren · über 21" : "Verloren") : total === dealer && natural(hand.cards) === natural(result.dealer) ? "Gleichstand" : natural(hand.cards) ? "Blackjack gewonnen" : "Gewonnen";
        return <div className="receipt-line" key={hand.id}><strong>{v.players.find(person => person.id === hand.id)?.name} · {verdict}</strong><span>{total} Punkte · Auszahlung {money(hand.paid)} CHF</span></div>;
      })}</>}
  </details>;
}
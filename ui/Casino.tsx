import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Clock3, DoorOpen, Eye, Spade } from "lucide-react";
import { cardValue, dealStep, score } from "../game/casino";
import { M, money, tokenColors } from "../game/board";
import type { View } from "../game/view";
import { Avatar, type Sender } from "./panels";
import { playSound } from "./tableSound";

const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "B", "D", "K"];
const suits = ["♠", "♥", "♦", "♣"];
const suitNames = ["Pik", "Herz", "Karo", "Kreuz"];
type Point = { x: number; y: number };
function useNow(interval = 100) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}
function useSize() {
  const ref = useRef<HTMLDivElement>(null), [size, setSize] = useState({ w: 800, h: 460 });
  useLayoutEffect(() => {
    const node = ref.current!;
    const measure = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}
export function CasinoInvite({ v, send }: { v: View; send: Sender }) {
  const table = v.casino!, host = v.players.find((person) => person.id === table.host), mine = table.host === v.me;
  const now = useNow(250), left = Math.max(0, Math.ceil((v.deadline - now) / 1000));
  const focus = useRef<HTMLButtonElement>(null);
  useEffect(() => { focus.current?.focus(); }, []);
  return <div className="casino-invite" role="dialog" aria-modal="true" aria-label="Casino-Einladung">
    <motion.section initial={{ scale: 0.86, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: "easeOut" }}>
      <span className="invite-seal"><Spade size={30} /></span>
      <small>{mine ? "CASINO-BONUS" : "EINLADUNG"}</small>
      {mine ? <>
        <h2>Du hast {money(table.bonus)} bekommen</h2>
        <p>Behalte das Geld oder spiele damit Blackjack. Im Casino setzt du bis zu {money(table.bonus * 4)} CHF.</p>
        <div className="invite-actions">
          <button onClick={() => send({ type: "CASINO_SKIP" })}>Annehmen</button>
          <button ref={focus} className="primary" onClick={() => send({ type: "CASINO_ENTER" })}>Annehmen & ins Casino</button>
        </div>
      </> : <>
        <h2>Einladung ins Casino</h2>
        <p>{host?.name} lädt den Tisch zu einer Runde Blackjack ein. Einsatz bis {money(table.bonus)} CHF.</p>
        <div className="invite-actions"><button ref={focus} className="primary" onClick={() => send({ type: "CASINO_ENTER" })}>Ins Casino gehen</button></div>
      </>}
      <small className="invite-clock" role="timer">Automatisch im Casino in {left} s</small>
    </motion.section>
  </div>;
}
function Card({ value, at, from, hidden, flip, appear, sound }: { value: number; at: Point; from: Point; hidden?: boolean; flip?: boolean; appear: number; sound: boolean }) {
  const fresh = Date.now() - appear < 700;
  useEffect(() => { if (fresh && sound) playSound("card"); }, [fresh, sound]);
  const suit = Math.floor(value / 13), rank = ranks[value % 13], points = cardValue(value);
  return <motion.div
    className={`bj-card ${hidden ? "back" : suit === 1 || suit === 2 ? "red" : ""}`}
    role="img"
    aria-label={hidden ? "Verdeckte Karte" : `${suitNames[suit]} ${rank}, Wert ${points === 11 ? "1 oder 11" : points}`}
    initial={!fresh ? false : flip ? { x: at.x, y: at.y, rotateY: 90 } : { x: from.x, y: from.y, rotate: -14, opacity: 0.2 }}
    animate={{ x: at.x, y: at.y, rotate: 0, opacity: 1, rotateY: 0 }}
    transition={{ duration: flip ? 0.45 : 0.65, ease: [0.2, 0.75, 0.3, 1] }}
  >
    {hidden ? <span>SM</span> : <>
      <b>{rank}<i>{suits[suit]}</i></b>
      <em>{suits[suit]}</em>
      <small>{points === 11 ? "1/11" : points}</small>
    </>}
  </motion.div>;
}
function Stack({ amount, from, to, label }: { amount: number; from: Point; to: Point; label?: string }) {
  return <motion.div className="money-stack" initial={{ x: from.x, y: from.y, opacity: 0.4, scale: 0.85 }} animate={{ x: to.x, y: to.y, opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: "easeInOut" }}>
    <i /><i /><i /><b>{label ?? money(amount)}</b>
  </motion.div>;
}
export function CasinoFloor({ v, send, sound, leave }: { v: View; send: Sender; sound: boolean; leave: () => void }) {
  const table = v.casino!, now = useNow(100), [felt, { w, h }] = useSize();
  const [amount, setAmount] = useState(""), [confirmHit, setConfirmHit] = useState(false);
  const [flight, setFlight] = useState<{ amount: number; from: Point; at: number } | null>(null);
  const input = useRef<HTMLInputElement>(null), balance = useRef<HTMLDivElement>(null);
  const seats = table.seats.length ? table.seats : [];
  const count = Math.max(1, seats.length);
  const cw = Math.max(30, Math.min(66, w * (count <= 2 ? 0.068 : count <= 4 ? 0.056 : 0.047))), ch = cw * 1.42, gap = 5;
  const shoe = { x: w * 0.88 - cw / 2, y: h * 0.06 };
  const dealer = { x: w / 2, y: h * 0.08 };
  const seatPoint = (index: number) => {
    const angle = ((25 + (130 * (index + 0.5)) / count) * Math.PI) / 180;
    return { x: w / 2 + w * 0.37 * Math.cos(angle), y: h * 0.3 + h * 0.36 * Math.sin(angle) };
  };
  const settle = table.settledAt || 0, dealt = table.dealtAt || 0, hands = table.hands, result = v.result;
  const extra = Math.max(0, table.dealer.length - 2);
  const handTime = (index: number) => settle + 1600 + extra * 900 + index * 2600;
  const order = (card: number, hand: number) => dealt + (card * (hands.length + 1) + hand) * dealStep;
  const handIndexes = (id: string) => hands.map((hand, index) => ({ hand, index })).filter((item) => item.hand.id === id);
  const cardAt = (anchor: Point, slot: number, row0: number) => ({ x: anchor.x + ((slot % 4) - 1.5) * (cw + gap) - cw / 2, y: anchor.y + (row0 + Math.floor(slot / 4)) * (ch + gap) });
  const me = v.players.find((person) => person.id === v.me)!, myHands = handIndexes(v.me);
  const mySeat = seats.indexOf(v.me), actor = v.phase === "blackjack" ? hands[table.cursor] : undefined;
  const pending = result ? myHands.reduce((total, { index }) => total + (now < handTime(index) + 2100 ? result.hands[index]?.paid ?? 0 : 0), 0) : 0;
  const limit = table.host === v.me ? table.bonus * 4 : table.bonus;
  const center = (element: HTMLElement | null): Point => {
    const box = felt.current?.getBoundingClientRect(), rect = element?.getBoundingClientRect();
    return box && rect ? { x: rect.left - box.left + rect.width / 2 - 30, y: rect.top - box.top } : { x: w / 2, y: h };
  };
  const lastFlight = useRef(0);
  useEffect(() => {
    if (!flight) return;
    const timer = setTimeout(() => setFlight(null), 1100);
    return () => clearTimeout(timer);
  }, [flight]);
  const verdicts = useRef(new Set<string>());
  useEffect(() => {
    if (!sound || !result) return;
    result.hands.forEach((hand, index) => {
      const key = `${settle}:${index}`;
      if (now >= handTime(index) && !verdicts.current.has(key)) {
        verdicts.current.add(key);
        playSound(hand.id === v.me ? (hand.net > 0 ? "win" : hand.net < 0 ? "lose" : "money") : "money");
      }
    });
  });
  const left = v.deadline ? Math.max(0, v.deadline - now) : 0;
  const arrived = table.arrived.length, deciding = table.answers.length;
  const watcher = !seats.includes(v.me) || (["blackjack", "casinoSettle"].includes(v.phase) && !myHands.length);
  const dealerCards = settle ? table.dealer : table.dealer.length ? [table.dealer[0], -1] : [];
  const dealerShown = dealerCards.filter((_, index) => index < 2 || now >= settle + 1600 + (index - 2) * 900);
  return <section className="casino-floor" aria-label="Blackjack-Tisch">
    <header className="casino-top">
      <span><Spade size={16} />BLACKJACK · {v.phase === "casinoInvite" ? "Ankunft" : v.phase === "casinoJoin" ? "Teilnahme" : v.phase === "casinoBet" ? "Einsätze" : v.phase === "blackjack" ? "Spiel" : "Abrechnung"}</span>
      {watcher && <span className="spectators"><Eye size={15} />Zuschauermodus</span>}
      {watcher && <button onClick={leave}><DoorOpen size={15} />Zurück zum Brett</button>}
    </header>
    <div className="bj-table" ref={felt} style={{ ["--card-w" as string]: `${cw}px` }}>
      <div className="bj-felt" aria-hidden="true"><span>BLACKJACK</span><small>Bank zieht bis 16 · steht ab 17</small><small className="arc">Blackjack zahlt 3 : 2</small></div>
      <div className="bj-shoe" style={{ left: shoe.x, top: shoe.y }} aria-label="Kartenschlitten" role="img"><i /><i /><i /></div>
      <div className="bj-dealer-label" style={{ left: dealer.x, top: dealer.y + ch + 10 }}>
        <strong>Dealer</strong>
        {dealt > 0 && <small>{settle && now >= settle + 700 ? `${score(dealerShown)} Punkte` : `${score(table.dealer.slice(0, 1))} + ?`}</small>}
      </div>
      {dealt > 0 && dealerCards.map((value, index) => {
        const appear = index < 2 ? order(index, hands.length) : settle + 1600 + (index - 2) * 900;
        if (now < appear) return null;
        const hole = index === 1 && (!settle || now < settle + 700);
        const at = { x: dealer.x + (index - (dealerShown.length - 1) / 2) * (cw + gap) - cw / 2, y: dealer.y };
        return <Card key={`d${index}${hole ? "h" : ""}`} value={hole ? 0 : value} hidden={hole} flip={index === 1 && !hole} appear={index === 1 && !hole ? settle + 700 : appear} sound={sound} from={shoe} at={at} />;
      })}
      {seats.map((id, seat) => {
        const person = v.players.find((other) => other.id === id)!, anchor = seatPoint(seat), mine = handIndexes(id);
        const active = actor?.id === id;
        let rows = 0;
        const spot = { x: anchor.x - 30, y: anchor.y - 30 };
        return <div key={id} className="bj-seat-layer">
          {mine.map(({ hand, index }) => {
            const start = rows;
            rows += Math.max(1, Math.ceil(hand.cards.length / 4));
            const verdict = result && settle && now >= handTime(index) ? result.hands[index] : null;
            return <div key={index}>
              {hand.cards.map((value, slot) => {
                const appear = slot < 2 && !hand.split ? order(slot, index) : 0;
                if (appear && now < appear) return null;
                return <Card key={slot} value={value} appear={appear || now} sound={sound} from={shoe} at={cardAt({ x: anchor.x, y: anchor.y }, slot, start)} />;
              })}
              {verdict && <span className="bj-verdict" data-result={verdict.net > 0 ? "win" : verdict.net < 0 ? "lose" : "push"} style={{ left: anchor.x, top: anchor.y - 100 - (mine.length > 1 ? (index - mine[0].index) * 22 : 0) }}>{verdict.net > 0 ? "Gewonnen" : verdict.net < 0 ? "Verloren" : "Unentschieden"}</span>}
              {(!verdict || now < handTime(index) + 900) && hand.stake > 0 && !(verdict && verdict.net < 0 && now >= handTime(index)) && !(flight && id === v.me && now < flight.at + 950) && <Stack amount={hand.stake} from={spot} to={spot} />}
              {verdict && verdict.net < 0 && now < handTime(index) + 1000 && <Stack amount={hand.stake} from={spot} to={{ x: dealer.x - 30, y: dealer.y + ch / 2 }} />}
              {verdict && verdict.net > 0 && now < handTime(index) + 1200 && <Stack amount={verdict.paid - verdict.stake!} label={`+${money(verdict.paid - verdict.stake!)}`} from={{ x: dealer.x - 30, y: dealer.y + ch / 2 }} to={spot} />}
              {verdict && verdict.paid > 0 && now >= handTime(index) + 1200 && now < handTime(index) + 2200 && <Stack amount={verdict.paid} from={spot} to={id === v.me ? center(balance.current) : { x: anchor.x - 30, y: anchor.y - 66 }} />}
            </div>;
          })}
          <div className="bj-seat" data-active={active} style={{ left: anchor.x, top: anchor.y - 36, borderColor: tokenColors[person.token] }}>
            <Avatar token={person.token} photo={person.photo} />
            <span><b>{person.id === v.me ? "Du" : person.name}</b><small>{mine.length ? mine.map(({ hand }) => score(hand.cards)).join(" / ") + " Pkt." : v.phase === "casinoBet" ? "setzt …" : "dabei"}</small></span>
            {active && <i className="seat-timer" style={{ width: `${Math.min(100, (left / 10000) * 100)}%` }} />}
          </div>
        </div>;
      })}
      {flight && mySeat >= 0 && <Stack key={flight.at} amount={flight.amount} from={flight.from} to={{ x: seatPoint(mySeat).x - 30, y: seatPoint(mySeat).y - 30 }} />}
      {v.phase === "casinoInvite" && <div className="bj-center" role="status"><Clock3 size={18} />Alle kommen an · {arrived}/{table.queue.length}</div>}
      {v.phase === "casinoJoin" && (table.answers.includes(v.me) ? <div className="bj-center" role="status">{seats.includes(v.me) ? "Du spielst mit." : "Du schaust zu."} Entscheidungen: {deciding}/{table.queue.length}</div>
        : <div className="bj-center bj-choice" role="dialog" aria-label="Teilnahme">
          <strong>Spielst du mit?</strong>
          <small role="timer">{Math.ceil(left / 1000)} s</small>
          <div><button onClick={() => send({ type: "CASINO_JOIN", yes: false })}>Nicht teilnehmen</button><button className="primary" disabled={me.cash! < M / 2} onClick={() => send({ type: "CASINO_JOIN", yes: true })}>Teilnehmen</button></div>
        </div>)}
    </div>
    <footer className="bj-controls">
      <div className="bj-balance" ref={balance}><small>KONTOSTAND</small><b>{money(v.own.cash - pending)} CHF</b></div>
      {v.phase === "casinoBet" && seats.includes(v.me) && !myHands.length && <form className="bj-bet" onSubmit={(event) => {
        event.preventDefault();
        const value = Math.round(Number(amount) * 2) * (M / 2);
        if (Date.now() - lastFlight.current < 1500) return;
        lastFlight.current = Date.now();
        setFlight({ amount: value, from: center(input.current), at: Date.now() });
        if (sound) playSound("money");
        send({ type: "PLACE_CASINO_BET", amount: value });
      }}>
        <label>Dein Einsatz (in M)<input ref={input} type="number" min="0.5" step="0.5" max={Math.min(limit, v.own.cash) / M} required value={amount} placeholder={`0.5 – ${Math.min(limit, v.own.cash) / M}`} onChange={(event) => setAmount(event.target.value)} /></label>
        <button className="primary" disabled={!amount || Number(amount) < 0.5 || (Number(amount) * 2) % 1 !== 0 || Number(amount) * M > Math.min(limit, v.own.cash)}>Setzen</button>
        <button type="button" onClick={() => send({ type: "PLACE_CASINO_BET", amount: null })}>Doch nicht spielen</button>
        <small role="timer">Noch {Math.ceil(left / 1000)} s · höchstens {money(limit)} CHF</small>
      </form>}
      {v.phase === "casinoBet" && (myHands.length > 0 || !seats.includes(v.me)) && <p role="status">{myHands.length ? `Dein Einsatz: ${money(myHands[0].hand.stake)} CHF.` : "Du schaust zu."} Die anderen setzen noch · {Math.ceil(left / 1000)} s</p>}
      {v.phase === "blackjack" && actor && (actor.id === v.me ? <div className="bj-actions">
        <span className="decision-clock" role="timer"><i style={{ width: `${Math.min(100, (left / 10000) * 100)}%` }} />{Math.ceil(left / 1000)} s</span>
        <button onClick={() => (score(actor.cards) >= 19 ? setConfirmHit(true) : send({ type: "BLACKJACK_HIT" }))}>Karte ziehen</button>
        <button className="primary" onClick={() => send({ type: "BLACKJACK_STAND" })}>Bleiben</button>
        {actor.cards.length === 2 && !actor.doubled && v.own.cash >= actor.stake && <button onClick={() => send({ type: "BLACKJACK_DOUBLE" })}>Verdoppeln</button>}
        {actor.cards.length === 2 && !actor.split && actor.cards[0] % 13 === actor.cards[1] % 13 && v.own.cash >= actor.stake && <button onClick={() => send({ type: "BLACKJACK_SPLIT" })}>Teilen</button>}
      </div> : <p role="status">{v.players.find((person) => person.id === actor.id)?.name} entscheidet · {Math.ceil(left / 1000)} s</p>)}
      {v.phase === "casinoSettle" && <p role="status">Der Dealer deckt auf und rechnet von rechts nach links ab.</p>}
    </footer>
    {confirmHit && actor && <div className="bj-confirm" role="alertdialog" aria-label="Wirklich ziehen?">
      <p>Du hast {score(actor.cards)} Punkte. Willst du wirklich noch eine Karte ziehen?</p>
      <div><button onClick={() => setConfirmHit(false)}>Nein, bleiben lassen</button><button className="primary" onClick={() => { setConfirmHit(false); send({ type: "BLACKJACK_HIT" }); }}>Ja, Karte ziehen</button></div>
    </div>}
  </section>;
}

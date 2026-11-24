import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Battery,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Bot,
  BriefcaseBusiness,
  Dices,
  Flag,
  Handshake,
  Home,
  Lock,
  Mail,
  Menu,
  MessagesSquare,
  Monitor,
  Newspaper,
  Pause,
  Smartphone,
  Spade,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { board, colours, M, money, tokenColors } from "../game/board";
import { card, gamble } from "../game/cards";
import { repayAmount } from "../game/economy";
import type { View } from "../game/view";
import type { Bundle } from "../game/model";
import { Avatar, type Sender } from "./panels";
import { FieldEmblem } from "./FieldTile";
import { signalBars, signalText, type Presence } from "./presence";
import { BankSettlement, PaidScreen, TransferSheet, type PayRequest, type Receipt } from "./Settlement";
import type { useTrip } from "./TurnDisplay";
import { Chats, News, Portfolio, Trading, loanDue } from "./HandsetApps";
import { emptyDraft, type Note, type Page, type Tab, type TradeDraft } from "./handsetTypes";

type Trip = ReturnType<typeof useTrip>;
const apps: [Tab, typeof Home][] = [["Tisch", Home], ["Portfolio", BriefcaseBusiness], ["Handel", ArrowLeftRight], ["News", Newspaper], ["Chat", MessagesSquare]];

export function SignalIcon({ bars }: { bars: number }) {
  if (!bars) return <WifiOff size={15} className="signal-off" aria-label="Getrennt" />;
  return <span className="signal-bars" data-level={bars} role="img" aria-label={`Verbindung ${signalText[bars]}`}>{[1, 2, 3, 4].map((step) => <i key={step} data-on={step <= bars} />)}</span>;
}
function BatteryIcon({ level, charging }: { level: number | null; charging: boolean | null }) {
  if (level === null) return null;
  const Icon = charging ? BatteryCharging : level > 0.8 ? BatteryFull : level > 0.45 ? BatteryMedium : level > 0.15 ? BatteryLow : Battery;
  return <span className="battery" data-low={level <= 0.15} title={`Akku ${Math.round(level * 100)} %${charging ? " · lädt" : ""}`}><Icon size={16} /><small>{Math.round(level * 100)}%</small></span>;
}
export function DeviceStatus({ person, presence }: { person: View["players"][number]; presence?: Presence }) {
  const bars = person.bot ? 4 : signalBars(person.online, presence?.rtt);
  const DeviceIcon = person.bot ? Bot : presence?.device === "mobile" ? Smartphone : Monitor;
  return <span className="device-state" title={`${person.bot ? "Bot" : presence?.device === "mobile" ? "Mobilgerät" : "Computer"} · Verbindung ${signalText[bars]}${presence?.rtt ? ` (${presence.rtt} ms)` : ""}`}>
    <SignalIcon bars={bars} />
    {!person.bot && presence && <BatteryIcon level={presence.battery} charging={presence.charging} />}
    <DeviceIcon size={15} aria-label={person.bot ? "Bot" : presence?.device === "mobile" ? "Mobilgerät" : "Computer"} />
  </span>;
}
export function Balance({ value, effects }: { value: number; effects: boolean }) {
  const shown = useRef(value), label = useRef<HTMLElement>(null);
  useEffect(() => {
    const from = shown.current;
    shown.current = value;
    if (!label.current) return;
    if (!effects || from === value) {
      label.current.textContent = `${money(value)} CHF`;
      return;
    }
    const step = Math.max(M / 100, Math.abs(value - from) / 12);
    const controls = animate(from, value, {
      duration: 1.5,
      delay: 1.1,
      ease: "linear",
      onUpdate: (amount) => {
        if (label.current) label.current.textContent = `${money(from + Math.round((amount - from) / step) * step)} CHF`;
      },
      onComplete: () => {
        if (label.current) label.current.textContent = `${money(value)} CHF`;
      },
    });
    return () => controls.stop();
  }, [value, effects]);
  return <b ref={label} data-balance>{money(value)} CHF</b>;
}
function FieldChip({ id, label, pick }: { id: number; label: string; pick: (id: number) => void }) {
  const tile = board[id];
  return <button className="field-chip" style={{ borderTopColor: colours[tile.group] ?? "#b99d65" }} onClick={() => pick(id)} title={`${tile.name} öffnen`}>
    <small>{label}</small>
    <span className="field-chip-art"><FieldEmblem tile={tile} /></span>
    <b>{tile.short}</b>
    <small>Feld {String(id).padStart(2, "0")}</small>
  </button>;
}
function TurnRoute({ v, trip, pick }: { v: View; trip: Trip; pick: (id: number) => void }) {
  const p = v.players[v.turn],
    move = v.movement?.player === p.id ? v.movement : null,
    walking = trip.moving && !!move,
    arrived = !!move && !trip.moving && move.path.length > 0 && move.start !== undefined;
  const from = move && move.start !== undefined && (walking || arrived) ? move.start : p.pos;
  return <div className="turn-route" data-moving={walking}>
    <FieldChip id={from} label={arrived ? "Vorheriges Feld" : walking ? "Start" : "Aktuelles Feld"} pick={pick} />
    <span className="route-arrow" aria-hidden="true"><ArrowRight size={22} /></span>
    <div className="route-slot">
      <AnimatePresence>
        {arrived && <motion.div key={`${move!.at}`} initial={{ x: "-118%", opacity: 0, scale: 0.92 }} animate={{ x: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.5, ease: [0.3, 0.7, 0.3, 1] }}>
          <FieldChip id={p.pos} label="Neues Feld" pick={pick} />
        </motion.div>}
      </AnimatePresence>
      {walking && <span className="route-travel" role="status">{trip.rolling ? "Würfel rollen …" : "unterwegs …"}</span>}
    </div>
  </div>;
}
function RollButton({ send }: { send: Sender }) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.key !== " " && event.key !== "Enter") || event.repeat || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=slider], dialog, .field-card")) return;
      if (target?.closest("button, a") && !target.closest(".phone-tabs, .roll-button")) return;
      if (document.querySelector("dialog[open], .casino-invite, .field-decision, .link-overlay")) return;
      event.preventDefault();
      send({ type: "ROLL_DICE" });
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [send]);
  return <button className="primary wide roll-button" aria-label="Würfeln" aria-keyshortcuts="Space Enter" onClick={() => send({ type: "ROLL_DICE" })}><Dices size={20} />Würfeln<small>Leertaste / Enter</small></button>;
}
export function activityText(v: View, presence: Record<string, Presence>) {
  const p = v.players[v.turn], me = p.id === v.me, name = me ? "Du" : p.name;
  const verb = (self: string, other: string) => `${name} ${me ? self : other}`;
  if (v.paused) return "Partie pausiert";
  if (v.tradeUntil) return "Eine Handelsanfrage wartet auf Antwort";
  if (v.casino) return "Casino-Runde läuft";
  if (v.phase === "auction") return `${verb("nimmst", "nimmt")} an einer Auktion teil`;
  if (v.phase === "debt") return v.payment?.raising ? `${verb("beschaffst", "beschafft")} Geld für eine Zahlung` : `${verb("machst", "macht")} eine Zahlung`;
  if (v.phase === "bus") return `${verb("wählst", "wählt")} ein Busziel`;
  if (v.phase === "travel") return `${verb("fährst", "fährt")} über das Brett`;
  if (v.phase === "buy") return `${verb("entscheidest", "entscheidet")} über einen Kauf`;
  if (v.phase === "choice" || v.phase === "insurance") return `${verb("entscheidest", "entscheidet")} über eine Karte`;
  if (presence[p.id]?.activity === "trade") return `${verb("schaust", "schaut")} ins Handelsmenü`;
  if (v.turnBuilds > 0 && v.phase === "roll") return `${verb("baust", "baut")} Firmen aus`;
  return me ? "Du bist am Zug" : `Warten auf ${p.name}`;
}
function TurnActions({ v, send, trip, pay, home, toCasino, status }: { v: View; send: Sender; trip: Trip; pay: (request: PayRequest) => void; home: () => void; toCasino: () => void; status: string }) {
  const p = v.players[v.turn], me = v.players.find((other) => other.id === v.me)!, active = p.id === v.me;
  const [bid, setBid] = useState("");
  const button = (text: string, cmd: Parameters<Sender>[0], disabled = false, primary = false) => <button className={primary ? "primary wide" : "wide"} disabled={disabled} onClick={() => send(cmd)}>{text}</button>;
  if (v.tradeUntil) return <p role="status" className="turn-note">Handelsentscheidung ausstehend. Danach geht der Zug weiter.</p>;
  if (v.paused) return <>{<p className="turn-note"><Pause size={15} /> Die Partie ist pausiert.</p>}{button("Partie fortsetzen", { type: "RESUME" }, false, true)}</>;
  if (v.phase === "over") return <div className="game-result">
    <h3>{v.winners.length ? `Sieg: ${v.winners.map((id) => v.players.find((other) => other.id === id)?.name).join(" & ")}` : "Unentschieden"}</h3>
    <p>Grösster Deal: {money(v.stats?.deal ?? 0)} CHF · Grösster Casino-Gewinn: {money(v.stats?.casino ?? 0)} CHF</p>
    <button className="primary wide" onClick={home}>Zur Startansicht</button>
  </div>;
  if (v.casino) return <><p className="turn-note"><Spade size={15} /> Casino-Runde läuft.</p><button className="wide" onClick={toCasino}>Zum Casino</button></>;
  if (trip.moving) return <p className="turn-note" role="status">{trip.rolling ? "Die Würfel rollen …" : `${p.name} fährt über das Brett.`}</p>;
  return <>
    {v.lastCard && <p key={`${v.rolls}-${v.lastCard}`} className="card-notice">{card(v.lastCard).name}</p>}
    {active && v.phase === "roll" && <>
      {p.jail > 0 && <div className="jail-actions">
        <button className="wide" disabled={me.cash! < 50 * M} onClick={() => pay({ amount: 50 * M, reason: "Freikauf aus dem Gefängnis", to: "Spielbank", cmd: { type: "BAIL" } })}>Freikaufen · {money(50 * M)}</button>
        {button("Anwaltskarte einsetzen", { type: "LAWYER" }, !v.own.cards.some((id) => id === "C19" || id === "C20"))}
        {button("Haftzug abwarten", { type: "JAIL_WAIT" })}
      </div>}
      <RollButton send={send} />
    </>}
    {active && v.phase === "bus" && v.bus && <div className="bus-box" role="group" aria-label="Busziel wählen">
      <p><b>Bus!</b> Klicke ein markiertes Feld auf dem Brett oder wähle hier:</p>
      {v.bus.map((option) => <button key={option.target} className="wide" onClick={() => send({ type: "BUS_CHOOSE", steps: option.steps })}>{option.steps} Felder → {board[option.target].short}</button>)}
    </div>}
    {!active && v.phase === "bus" && <p className="turn-note">{status}</p>}
    {active && v.phase === "buy" && <p className="turn-note">Entscheide auf dem Brett, ob du kaufst.</p>}
    {active && v.phase === "debt" && <p className="turn-note">{v.payment?.raising ? "Beschaffe das fehlende Geld im Handy. Solange es fehlt, läuft keine Frist." : "Bestätige die Überweisung im Handy."}</p>}
    {!active && v.phase === "debt" && v.payment && <FundingBox v={v} />}
    {active && v.phase === "choice" && <>{button(`Sicher +${gamble.safe}M`, { type: "REACT", yes: false })}{button(`50/50: +${gamble.win}M oder −${gamble.loss}M`, { type: "REACT", yes: true })}</>}
    {active && v.phase === "insurance" && <>{button("Versicherung einsetzen", { type: "REACT", yes: true })}{button("Schaden selbst bezahlen", { type: "REACT", yes: false })}</>}
    {active && v.phase === "manage" && <p className="turn-note">{v.extra ? "Pasch! Dein Zusatzwurf folgt automatisch." : "Der nächste Platz übernimmt automatisch."}</p>}
    {!active && !["auction", "bus"].includes(v.phase) && <p className="turn-note activity" role="status">{status}</p>}
    {v.auction && <div className="auction-box">
      <p><b>Auktion: {board[v.auction.tile].name}</b><br />Höchstgebot {money(v.auction.bid)} · {v.auction.leader ? `führend: ${v.players.find((seat) => seat.id === v.auction!.leader)?.name}` : "noch kein Gebot"} · ohne Zeitlimit</p>
      {v.auction.passed.includes(me.id) ? <p>Du hast gepasst.</p> : v.auction.leader === me.id ? <p>Du hältst das Höchstgebot.</p> : !me.out && <>
        <form onSubmit={(event) => { event.preventDefault(); send({ type: "BID", amount: Math.round(Number(bid) * M) }); setBid(""); }}>
          <label>Eigenes Gebot (in M)<input type="number" required min={(v.auction.bid + M) / M} max={v.own.cash / M} step="any" placeholder={`Mindestens ${(v.auction.bid + M) / M}`} value={bid} onChange={(event) => setBid(event.target.value)} /></label>
          <button className="primary wide" disabled={!bid || Number(bid) * M < v.auction.bid + M || Number(bid) * M > v.own.cash}>Gebot abgeben</button>
        </form>
        {button("Für diese Auktion passen", { type: "PASS_BID" })}
      </>}
    </div>}
  </>;
}
function FundingBox({ v }: { v: View }) {
  const payment = v.payment!, p = v.players[v.turn], to = v.players.find((person) => person.id === payment.to)?.name ?? "Spielbank";
  const verbs = { loan: "beleiht", reduce: "verkauft eine Ausbaustufe von", sell: "verkauft an die Bank:" } as const;
  return <div className="funding-box" role="status" aria-live="polite">
    <p><b>{payment.raising ? `${p.name} beschafft Geld` : `${p.name} kann jetzt zahlen`}</b><br />{money(payment.amount)} · {payment.reason} → {to}</p>
    {payment.steps.length > 0 ? <ul>{payment.steps.map((step, index) => <li key={index} data-op={step.op}>{verbs[step.op]} {board[step.tile].short}<b>+{money(step.amount)}</b></li>)}</ul> : payment.raising && <small>Noch nichts beliehen oder verkauft.</small>}
  </div>;
}
function TurnCard(props: { v: View; send: Sender; trip: Trip; pay: (request: PayRequest) => void; pick: (id: number) => void; home: () => void; toCasino: () => void; status: string }) {
  const { v, trip, pick } = props, p = v.players[v.turn], active = p.id === v.me;
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    if (!v.deadline) return;
    const timer = setInterval(() => setClock(Date.now()), 500);
    return () => clearInterval(timer);
  }, [v.deadline]);
  const left = v.deadline && !v.tradeUntil && !v.paused && ["roll", "buy", "debt", "choice", "insurance", "auction"].includes(v.phase) ? Math.max(0, Math.ceil((v.deadline - clock) / 1000)) : 0;
  return <section className="turn-card" data-active={active} style={{ borderColor: tokenColors[p.token] }} aria-label="Aktueller Zug">
    <header>
      <Avatar token={p.token} photo={p.photo} />
      <div><small>AM ZUG · RUNDE {v.round}</small><strong>{active ? "Du bist am Zug" : p.name}</strong></div>
      {left > 0 && <span className="turn-clock" data-low={left <= 15} role="timer">{left} s</span>}
    </header>
    {v.phase !== "over" && <TurnRoute v={v} trip={trip} pick={pick} />}
    {p.jail > 0 && <p className="jail-note"><Lock size={14} /> Im Gefängnis · {3 - p.jail} von 3 Runden abgesessen</p>}
    <TurnActions {...props} />
  </section>;
}
function Seats({ v, presence, tradeWith }: { v: View; presence: Record<string, Presence>; tradeWith: (id: string) => void }) {
  const me = v.players.find((person) => person.id === v.me)!;
  return <section className="seat-list" aria-label="Spieler am Tisch">
    {v.players.map((person) => {
      const trade = v.phase === "roll" && person.id !== v.me && !person.out && !me.out && (v.counts[`${v.me}:${person.id}`] ?? 0) < 2;
      return <div key={person.id} className="seat-row" data-current={v.players[v.turn].id === person.id} data-out={person.out} style={{ borderLeftColor: tokenColors[person.token] }}>
        <Avatar token={person.token} photo={person.photo} />
        <div className="seat-main">
          <strong>{person.name}{person.id === v.me ? " · Du" : ""}</strong>
          <small>{person.out ? "Ausgeschieden" : `${person.cash === undefined ? "Konto verborgen" : `${money(person.cash)} CHF`} · ${person.propertyCount} ${person.propertyCount === 1 ? "Firma" : "Firmen"}`}{person.jail > 0 && !person.out ? " · Gefängnis" : ""}</small>
        </div>
        <DeviceStatus person={person} presence={presence[person.id]} />
        {trade && <button className="seat-trade" onClick={() => tradeWith(person.id)}><Handshake size={15} />Handel anbieten</button>}
      </div>;
    })}
  </section>;
}
function TableVotes({ v, send }: { v: View; send: Sender }) {
  const [confirm, setConfirm] = useState(false);
  const me = v.players.find((person) => person.id === v.me)!;
  if (v.phase === "over" || me.out) return null;
  const voters = v.players.filter((person) => person.online && !person.bot && !person.out).length;
  const opener = v.host === v.me || v.settings.competitive;
  const vote = (issue: "pause" | "quit", label: string) => {
    const running = v.voteType === issue, blocked = (v.voteType !== null && !running) || (!v.voteType && !opener) || v.votes.includes(v.me) || v.paused || !!v.tradeUntil;
    return <button disabled={blocked} title={!opener && !v.voteType ? "Nur die Spielleitung eröffnet Abstimmungen" : undefined} onClick={() => send({ type: "VOTE", issue })}>{issue === "pause" ? <Pause size={15} /> : <Flag size={15} />}{label}{running ? ` · ${v.votes.length}/${voters}` : ""}</button>;
  };
  return <section className="table-votes" aria-label="Abstimmungen und Aufgabe">
    {vote("pause", "Für Pause stimmen")}
    {vote("quit", "Für Unentschieden stimmen")}
    {confirm ? <div className="resign-confirm" role="alertdialog" aria-label="Aufgeben bestätigen">
      <p>Wirklich aufgeben? Nur du scheidest aus, dein Besitz geht an die Bank.</p>
      <div><button onClick={() => setConfirm(false)}>Abbrechen</button><button className="danger" onClick={() => { setConfirm(false); send({ type: "RESIGN" }); }}>Aufgeben</button></div>
    </div> : <button className="danger" onClick={() => setConfirm(true)}><TriangleAlert size={15} />Bankrott melden</button>}
  </section>;
}
const ledgerKind = (reason: string) =>
  /^Miete/.test(reason) ? "Miete" : /^Kauf|^Auktion/.test(reason) ? "Kauf" : /^Handel/.test(reason) ? "Handel" : /^(Ausbau|Tilgung|Freikauf)/.test(reason) ? "Ausgabe" : /^(Bankverkauf|Rückbau|Beleihung)/.test(reason) ? "Finanzierung" : /^(Casino|Blackjack)/.test(reason) ? "Casino" : /^START|Startguthaben/.test(reason) ? "Einnahme" : "Rechnung";
function Transactions({ v }: { v: View }) {
  return <div className="ledger">
    {!v.own.ledger.length && <p>Noch keine Zahlungen.</p>}
    {[...v.own.ledger].reverse().filter((entry) => entry.delta !== 0).map((entry, index) => <div className="ledger-row" key={index} data-kind={ledgerKind(entry.reason)}>
      <span>{entry.reason}<small>{ledgerKind(entry.reason)}</small></span>
      <b className={entry.delta < 0 ? "negative" : "positive"}>{entry.delta > 0 ? "+" : "−"}{money(Math.abs(entry.delta))}</b>
    </div>)}
  </div>;
}
export function TradeDecision({ v, send }: { v: View; send: Sender }) {
  const trade = v.trades.find((item) => item.status === "Offen")!;
  const incoming = trade.to === v.me;
  const [now, setNow] = useState(Date.now);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((v.tradeUntil - now) / 1000));
  const other = v.players.find((person) => person.id === (incoming ? trade.from : trade.to));
  const list = (bundle: Bundle) => <ul className="deal-list">
    {bundle.cash > 0 && <li><b>{money(bundle.cash)} CHF</b></li>}
    {bundle.assets.map((id) => <li key={id} style={{ borderLeftColor: colours[board[id].group] }}>{board[id].short}<small>{money(v.assets[id].value)}</small></li>)}
    {bundle.cards.map((id) => <li key={id}>{card(id).name}</li>)}
    {!bundle.cash && !bundle.assets.length && !bundle.cards.length && <li>Nichts</li>}
  </ul>;
  return <section className="device-screen deal-screen">
    <div className="deal-clock"><ArrowLeftRight size={20} /><span role="timer">{remaining} s</span></div>
    <h2 ref={heading} tabIndex={-1}>{incoming ? "Handelsanfrage" : "Anfrage gesendet"}</h2>
    <p>{incoming ? `Von ${other?.name}` : `${other?.name} entscheidet.`}</p>
    <div className="deal-sides"><div><small>DU GIBST</small>{list(incoming ? trade.want : trade.give)}</div><div><small>DU ERHÄLTST</small>{list(incoming ? trade.give : trade.want)}</div></div>
    {incoming && <div className="deal-buttons"><button disabled={!remaining} onClick={() => send({ type: "TRADE", id: trade.id, op: "reject" })}>Ablehnen</button><button className="primary" disabled={!remaining} onClick={() => send({ type: "TRADE", id: trade.id, op: "accept" })}>Annehmen</button></div>}
    <p className="muted-line">Ohne Antwort wird die Anfrage automatisch abgelehnt.</p>
  </section>;
}
function LoanAlert({ v, pick }: { v: View; pick: (id: number) => void }) {
  const urgent = board.filter((tile) => v.assets[tile.id].owner === v.me && loanDue(v, tile.id)?.urgent);
  if (!urgent.length || v.phase === "over") return null;
  return <section className="loan-alert" role="alert">
    <TriangleAlert size={17} />
    <div><b>Darlehen bald fällig</b>
      {urgent.map((tile) => <button key={tile.id} onClick={() => pick(tile.id)}>{tile.short}: {money(repayAmount(v.assets[tile.id].loan))} · {loanDue(v, tile.id)!.text}</button>)}
      <small>Tilge vor dem Würfeln über die Feldkarte, sonst wird die Rückzahlung zu Zugbeginn Pflicht.</small>
    </div>
  </section>;
}
function NoteBanner({ note, dismiss, open }: { note: Note; dismiss: () => void; open: () => void }) {
  const dragged = useRef(false), done = useRef(dismiss);
  useEffect(() => { done.current = dismiss; }, [dismiss]);
  useEffect(() => {
    const timer = setTimeout(() => done.current(), 3000);
    return () => clearTimeout(timer);
  }, [note.id]);
  const Icon = note.kind === "chat" ? (note.thread ? Mail : MessagesSquare) : note.kind === "trade" ? Handshake : note.kind === "casino" ? Spade : note.kind === "jail" ? Lock : Newspaper;
  return <motion.button
    className="phone-note"
    data-kind={note.kind}
    data-good={note.good}
    role="status"
    initial={{ y: -96, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: -96, opacity: 0 }}
    transition={{ duration: 0.32, ease: "easeOut" }}
    drag="y"
    dragConstraints={{ top: -140, bottom: 0 }}
    dragElastic={{ top: 0.7, bottom: 0 }}
    onDragStart={() => { dragged.current = true; }}
    onDragEnd={(_, info) => { if (info.offset.y < -24) dismiss(); setTimeout(() => { dragged.current = false; }, 0); }}
    onClick={() => { if (!dragged.current) open(); }}
  >
    <Icon size={18} />
    <span><b>{note.title}</b><small>{note.text}</small></span>
  </motion.button>;
}
export type HandsetProps = {
  v: View;
  send: Sender;
  tab: Tab;
  setTab: (tab: Tab) => void;
  page: Page;
  setPage: (page: Page) => void;
  thread: string | null;
  setThread: (thread: string | null) => void;
  draft: TradeDraft;
  setDraft: (draft: TradeDraft) => void;
  presence: Record<string, Presence>;
  unread: Record<string, number>;
  muted: string[];
  toggleMute: (id: string) => void;
  pick: (id: number) => void;
  pay: (request: PayRequest) => void;
  request: PayRequest | null;
  cancelRequest: () => void;
  receipt: Receipt | null;
  paid: (receipt: Receipt) => void;
  trip: Trip;
  effects: boolean;
  note: Note | null;
  dismissNote: () => void;
  openNote: (note: Note) => void;
  menu: ReactNode;
  home: () => void;
  toCasino: () => void;
  report?: (activity: "trade" | null) => void;
};
export function Handset(props: HandsetProps) {
  const { v, send, tab, setTab, page, setPage, draft, setDraft, presence, pick, pay, request, receipt, trip, effects, note, report } = props;
  useEffect(() => { report?.(tab === "Handel" && !page ? "trade" : null); }, [tab, page, report]);
  const status = activityText(v, presence);
  const decision = v.trades.find((item) => item.status === "Offen");
  const invoice = v.phase === "debt" && !!v.debt;
  const own = presence[v.me];
  const unreadTotal = Object.values(props.unread).reduce((total, count) => total + count, 0);
  const tradeWith = (id: string) => {
    setDraft({ ...emptyDraft(), view: "compose", contact: id });
    setTab("Handel");
  };
  const screen = receipt ? <PaidScreen receipt={receipt} />
    : invoice ? <BankSettlement key={`${v.epoch}:${v.debt?.reason}`} v={v} send={send} paid={props.paid} />
    : request ? <TransferSheet request={request} v={v} send={send} paid={props.paid} cancel={props.cancelRequest} />
    : decision ? <TradeDecision key={decision.id} v={v} send={send} />
    : null;
  return <>
    <div className="device-status" aria-hidden="true">
      <span>SM MOBILE</span>
      <i />
      <span>{own && <><SignalIcon bars={signalBars(true, own.rtt)} /><BatteryIcon level={own.battery} charging={own.charging} /></>}</span>
    </div>
    <AnimatePresence>{note && <NoteBanner key={note.id} note={note} dismiss={props.dismissNote} open={() => props.openNote(note)} />}</AnimatePresence>
    {screen ?? <>
      <header className="device-heading">
        {page ? <button className="icon" title="Zurück" onClick={() => setPage(null)}><ArrowLeft size={18} /></button> : null}
        <h2>{page ?? (tab === "Tisch" ? "Spieltisch" : tab)}</h2>
        <button className="icon" title="Menü" aria-pressed={page === "Menü"} onClick={() => setPage(page === "Menü" ? null : "Menü")}><Menu size={18} /></button>
      </header>
      <div className="device-screen" key={`${tab}:${page}`}>
        {page === "Menü" ? props.menu
          : page === "Transaktionen" ? <Transactions v={v} />
          : tab === "Tisch" ? <>
            <section className="account-card">
              <div><small>DEIN KONTO</small><Balance value={v.own.cash} effects={effects} /></div>
              <button onClick={() => setPage("Transaktionen")}>Transaktionen ansehen</button>
            </section>
            <LoanAlert v={v} pick={pick} />
            <TurnCard v={v} send={send} trip={trip} pay={pay} pick={pick} home={props.home} toCasino={props.toCasino} status={status} />
            <Seats v={v} presence={presence} tradeWith={tradeWith} />
            <TableVotes v={v} send={send} />
          </>
          : tab === "Portfolio" ? <Portfolio v={v} pick={pick} />
          : tab === "Handel" ? <Trading v={v} send={send} draft={draft} setDraft={setDraft} pick={pick} />
          : tab === "News" ? <News v={v} pick={pick} />
          : <Chats v={v} send={send} thread={props.thread} setThread={props.setThread} unread={props.unread} muted={props.muted} toggleMute={props.toggleMute} />}
      </div>
      <nav className="phone-tabs" aria-label="Handy-Apps">
        {apps.map(([label, Icon]) => <button key={label} aria-label={label} aria-pressed={tab === label && !page} onClick={() => { setPage(null); setTab(label); }}>
          <Icon size={18} />{label}
          {label === "Chat" && unreadTotal > 0 && <i aria-label={`${unreadTotal} ungelesen`}>{unreadTotal}</i>}
        </button>)}
      </nav>
    </>}
    <button className="home-indicator" title="Zum Spieltisch" onClick={() => { setPage(null); setTab("Tisch"); }}><span /></button>
  </>;
}

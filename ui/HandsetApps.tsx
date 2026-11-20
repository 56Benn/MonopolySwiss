import { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BellOff,
  CheckCheck,
  Coins,
  Dices,
  Handshake,
  Info,
  Landmark,
  Lock,
  Pin,
  Send,
  Spade,
  TrendingUp,
  Users,
} from "lucide-react";
import { board, colours, groups, M, money, rate, type Tile } from "../game/board";
import { cards, card } from "../game/cards";
import type { View } from "../game/view";
import type { Bundle } from "../game/model";
import { Avatar, type Sender } from "./panels";
import { companyLogo } from "./companyLogos";
import { chatThread } from "./notifications";
import { messageText } from "./chatText";
import { refundShare } from "../game/economy";
import { emptyBundle, emptyDraft, type TradeDraft } from "./handsetTypes";

const holdings = (v: View, owner: string) =>
  groups.map((name, index) => {
    const all = board.filter((tile) => tile.group === index);
    return { name, index, total: all.length, tiles: all.filter((tile) => v.assets[tile.id].owner === owner) };
  }).filter((group) => group.tiles.length);
export function cardHelp(id: string) {
  return id === "C21" ? "Übernimmt bei einer Schadenskarte bis zu 30M." : id === "C22" ? "Beim nächsten Kauf einlösbar: 15 % Rabatt, höchstens 10M." : "Statt der Kaution einsetzen, um das Gefängnis sofort zu verlassen.";
}
function Trend({ history }: { history: number[] }) {
  if (history.length < 2) return <span className="trend" data-flat="true">–</span>;
  const before = history.at(-2)!, after = history.at(-1)!, change = (after / before - 1) * 100;
  if (after === before) return <span className="trend" data-flat="true">±0 %</span>;
  return <span className={`trend ${after > before ? "positive" : "negative"}`} title={`Letzte Änderung: ${money(before)} → ${money(after)}`}>
    {after > before ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
    {Math.abs(change).toLocaleString("de-CH", { maximumFractionDigits: 1 })} %
  </span>;
}
function Holding({ v, tile, pick, tag, action }: { v: View; tile: Tile; pick: (id: number) => void; tag?: string; action?: { label: string; run: () => void; disabled?: boolean } }) {
  const asset = v.assets[tile.id];
  return <div className="holding">
    <button className="holding-main" onClick={() => pick(tile.id)}>
      {companyLogo(tile) ? <img src={companyLogo(tile)} alt="" /> : <span className="holding-dot" style={{ background: colours[tile.group] }} />}
      <span>{tile.short}<small>{asset.levels.length ? (asset.levels.length >= 5 ? "Hotel" : `${"★".repeat(asset.levels.length)} ${asset.levels.length} Geldstapel`) : asset.loan ? `belehnt ${money(asset.loan)}` : groups[tile.group]}</small></span>
      <b>{money(asset.value)}</b>
      <Trend history={asset.history} />
    </button>
    {tag && <em className="set-tag"><BadgeCheck size={13} />{tag}</em>}
    {action && !action.disabled && <button className="holding-action" onClick={action.run}>{action.label}</button>}
  </div>;
}
export function Portfolio({ v, pick }: { v: View; pick: (id: number) => void }) {
  const mine = v.assets.filter((asset) => asset.owner === v.me);
  const firms = mine.reduce((total, asset) => total + asset.value, 0),
    build = mine.reduce((total, asset) => total + asset.levels.reduce((sum, cost) => sum + rate(cost, refundShare), 0), 0),
    loans = mine.reduce((total, asset) => total + asset.loan, 0);
  return <>
    <section className="worth-card">
      <small>NETTOVERMÖGEN</small>
      <h2>{money(v.own.worth)} CHF</h2>
      <div className="worth-grid">
        <div><small>Bargeld</small><b>{money(v.own.cash)}</b></div>
        <div><small>Firmen</small><b>{money(firms)}</b></div>
        <div><small>Ausbauwert</small><b>{money(build)}</b></div>
        <div data-negative={loans > 0}><small>Darlehen</small><b>{loans ? "−" : ""}{money(loans)}</b></div>
        {v.own.reserved > 0 && <div><small>Gebunden</small><b>{money(v.own.reserved)}</b></div>}
      </div>
      {v.settings.win === "goal" && <div className="goal"><progress value={v.own.worth} max={v.settings.goal * M} /><small>Ziel: {money(v.settings.goal * M)}</small></div>}
    </section>
    {!mine.length && <p className="empty-note">Noch keine Firmen im Portfolio.</p>}
    {holdings(v, v.me).map((group) => <section className="industry" key={group.index}>
      <h3 style={{ borderColor: colours[group.index] }}>{group.name}<small>{group.tiles.length}/{group.total}</small></h3>
      {group.tiles.map((tile) => <Holding key={tile.id} v={v} tile={tile} pick={pick} />)}
    </section>)}
    {v.own.cards.length > 0 && <section className="industry">
      <h3>Weitere Karten</h3>
      {v.own.cards.map((id) => <div key={id} className="extra-card" title={cardHelp(id)}><Info size={15} /><span><b>{card(id).name}</b><small>{cardHelp(id)}</small></span></div>)}
    </section>}
    {v.phase === "over" && <section className="industry"><h3>Schlussstand</h3>{v.players.map((person) => <div key={person.id} className="ledger-row"><span>{person.name}</span><b>{money(person.worth ?? 0)}</b></div>)}</section>}
  </>;
}
export function setHelp(v: View, other: string) {
  const help = new Map<number, "complete" | "add">();
  for (let group = 0; group < groups.length; group++) {
    const tiles = board.filter((tile) => tile.group === group);
    if (!tiles.some((tile) => v.assets[tile.id].owner === v.me)) continue;
    const missing = tiles.filter((tile) => v.assets[tile.id].owner !== v.me);
    const theirs = missing.filter((tile) => v.assets[tile.id].owner === other);
    for (const tile of theirs) help.set(tile.id, theirs.length === missing.length ? "complete" : "add");
  }
  return help;
}
function BundleForm({ v, title, id, value, change }: { v: View; title: string; id: string; value: Bundle; change: (bundle: Bundle) => void }) {
  const known = id === v.me ? v.own.cards : cards.filter((item) => item.effect.kind === "keep").map((item) => item.id);
  const available = v.players.find((person) => person.id === id)?.cash;
  const help = id === v.me ? new Map() : setHelp(v, id);
  return <fieldset className="bundle">
    <legend>{title}</legend>
    <label className="cash-field">Geld (in M)
      <input type="number" min="0" max={available === undefined ? undefined : available / M} step="0.5" value={value.cash / M || ""} placeholder="0" onChange={(event) => change({ ...value, cash: Math.round(Number(event.target.value) * M) })} />
    </label>
    <small>{available === undefined ? "Guthaben privat" : `Verfügbar: ${money(available)} CHF`}</small>
    {!holdings(v, id).length && <small className="empty-note">Keine Firmen.</small>}
    {holdings(v, id).map((group) => <section className="industry" key={group.index}>
      <h3 style={{ borderColor: colours[group.index] }}>{group.name}<small>{group.tiles.length}/{group.total}</small></h3>
      {group.tiles.map((tile) => {
        const locked = board.some((other) => other.group === tile.group && v.assets[other.id].levels.length > 0);
        return <label className="check company-choice" key={tile.id} data-locked={locked}>
        <input type="checkbox" disabled={locked} checked={value.assets.includes(tile.id)} onChange={(event) => change({ ...value, assets: event.target.checked ? [...value.assets, tile.id] : value.assets.filter((other) => other !== tile.id) })} />
        {companyLogo(tile) && <img alt="" src={companyLogo(tile)} />}
        <span>{tile.short}<small>{locked ? "ausgebaut · nicht handelbar" : `${money(v.assets[tile.id].value)}${v.assets[tile.id].loan > 0 ? ` · belehnt ${money(v.assets[tile.id].loan)}` : ""}`}</small></span>
        {help.has(tile.id) && !locked && <em className="set-tag"><BadgeCheck size={13} />{help.get(tile.id) === "complete" ? "Vervollständigt dein Set" : "Ergänzt dein Set"}</em>}
      </label>;
      })}
    </section>)}
    {known.length > 0 && <div className="card-choices">
      <small>{id === v.me ? "Eigene Karten" : "Karte anfragen"}</small>
      {known.map((key) => <label className="check" key={key}><input type="checkbox" checked={value.cards.includes(key)} onChange={(event) => change({ ...value, cards: event.target.checked ? [...value.cards, key] : value.cards.filter((other) => other !== key) })} />{card(key).name}</label>)}
    </div>}
  </fieldset>;
}
export function Trading({ v, send, draft, setDraft, pick }: { v: View; send: Sender; draft: TradeDraft; setDraft: (draft: TradeDraft) => void; pick: (id: number) => void }) {
  const me = v.players.find((person) => person.id === v.me)!;
  const partner = v.players.find((person) => person.id === draft.contact && !person.out);
  const used = (id: string) => v.counts[`${v.me}:${id}`] ?? 0;
  const open = v.phase === "roll" && !me.out;
  if (partner && draft.view === "cards") {
    const help = setHelp(v, partner.id), owned = holdings(v, partner.id);
    return <section className="partner-cards">
      <button className="back-link" onClick={() => setDraft(emptyDraft())}><ArrowLeft size={16} />Alle Spieler</button>
      <header className="partner-head"><Avatar token={partner.token} photo={partner.photo} /><div><strong>{partner.name}</strong><small>{partner.cash === undefined ? "Konto verborgen" : `${money(partner.cash)} CHF`} · {partner.propertyCount} Firmen</small></div></header>
      {!owned.length && <p className="empty-note">{partner.name} besitzt noch keine Firmen.</p>}
      {owned.map((group) => <section className="industry" key={group.index}>
        <h3 style={{ borderColor: colours[group.index] }}>{group.name}<small>{group.tiles.length}/{group.total}</small></h3>
        {group.tiles.map((tile) => <Holding key={tile.id} v={v} tile={tile} pick={pick} tag={help.has(tile.id) ? help.get(tile.id) === "complete" ? "Vervollständigt dein Set" : "Ergänzt dein Set" : undefined} action={{ label: "Anfragen", disabled: !open || used(partner.id) >= 2 || board.some((other) => other.group === tile.group && v.assets[other.id].levels.length > 0), run: () => setDraft({ view: "compose", contact: partner.id, give: emptyBundle(), want: { ...emptyBundle(), assets: [tile.id] } }) }} />)}
      </section>)}
    </section>;
  }
  if (partner && draft.view === "compose") {
    const { give, want } = draft, total = give.cash + want.cash + give.assets.length + want.assets.length + give.cards.length + want.cards.length;
    const invalid = !open || used(partner.id) >= 2 || !total || give.cash > v.own.cash || want.cash > (partner.cash ?? Infinity) || give.cash < 0 || want.cash < 0;
    return <section className="trade-composer">
      <button className="back-link" onClick={() => setDraft(emptyDraft())}><ArrowLeft size={16} />Alle Spieler</button>
      <header className="partner-head"><Avatar token={partner.token} photo={partner.photo} /><div><strong>Anfrage an {partner.name}</strong><small>Noch {2 - used(partner.id)} Anfragen in dieser Runde</small></div></header>
      {!open && <p className="turn-note">Handel ist vor dem Würfeln möglich.</p>}
      <BundleForm v={v} title="Du gibst" id={v.me} value={give} change={(bundle) => setDraft({ ...draft, give: bundle })} />
      <BundleForm v={v} title="Du erhältst" id={partner.id} value={want} change={(bundle) => setDraft({ ...draft, want: bundle })} />
      <button className="primary wide send-offer" disabled={invalid} onClick={() => send({ type: "PROPOSE_TRADE", to: partner.id, give, want })}><Send size={16} />Anfrage senden</button>
    </section>;
  }
  const partners = v.players.filter((person) => person.id !== v.me && !person.out)
    .map((person) => ({ person, help: setHelp(v, person.id) }))
    .sort((left, right) => right.help.size - left.help.size);
  return <>
    {!open && <p className="turn-note">Anfragen sind vor dem Würfeln möglich. Die andere Person entscheidet sofort, das Spiel wartet höchstens 30 Sekunden.</p>}
    {partners.map(({ person, help }) => <article key={person.id} className="partner-card" data-suggested={help.size > 0}>
      <header className="partner-head"><Avatar token={person.token} photo={person.photo} /><div><strong>{person.name}</strong><small>{person.cash === undefined ? "Konto verborgen" : `${money(person.cash)} CHF`} · {person.propertyCount} {person.propertyCount === 1 ? "Firma" : "Firmen"}</small></div>{help.size > 0 && <span className="suggested">Vorgeschlagen</span>}</header>
      <div className="partner-actions">
        <button className="primary" disabled={!open || used(person.id) >= 2} onClick={() => setDraft({ ...emptyDraft(), view: "compose", contact: person.id })}><Send size={15} />Anfrage schicken</button>
        <button onClick={() => setDraft({ ...emptyDraft(), view: "cards", contact: person.id })}>Karten anzeigen</button>
      </div>
      {help.size > 0 && <footer className="partner-hint"><BadgeCheck size={14} />{[...help.values()].includes("complete") ? "Besitzt Karten, die dein Set vervollständigen" : "Besitzt Karten, die du für deine Sets brauchst"}</footer>}
    </article>)}
    {!partners.length && <p className="empty-note">Keine Handelspartner mehr am Tisch.</p>}
  </>;
}
const roundLabel = (round: number, current: number) => round === current ? "Diese Runde" : round === current - 1 ? "Letzte Runde" : "Älteres";
function EventLine({ event }: { event: View["events"][number] }) {
  const Icon = event.kind === "Markt" ? TrendingUp : event.kind === "Casino" ? Spade : event.kind === "Konto" ? Landmark : event.kind === "Zug" ? (/Gefängnis/.test(event.text) ? Lock : Dices) : event.kind === "Spiel" ? Coins : Info;
  const direction = event.kind === "Markt" ? (/−\d/.test(event.text) ? "negative" : "positive") : "";
  return <div className="news-item" data-kind={event.kind}>
    <Icon size={16} />
    <span>
      <b className={direction}>{event.text}</b>
      <small>{event.cause ? `${event.cause} · ` : ""}{new Date(event.time).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}</small>
    </span>
  </div>;
}
export function News({ v }: { v: View; pick: (id: number) => void }) {
  const jailed = v.players.filter((person) => person.jail > 0 && !person.out);
  const events = [...v.events].filter((event) => event.kind !== "Lobby").reverse();
  const sections = ["Diese Runde", "Letzte Runde", "Älteres"].map((title) => ({ title, items: events.filter((event) => roundLabel(event.round ?? 0, v.round) === title) }));
  return <>
    {jailed.length > 0 && <section className="jail-board" aria-label="Gefängnis">
      {jailed.map((person) => <div key={person.id}><Lock size={15} /><span><b>{person.name} sitzt im Gefängnis</b><small>{3 - person.jail} von 3 Runden abgesessen</small></span></div>)}
    </section>}
    {sections.slice(0, 2).map((section) => <section key={section.title} className="news-section">
      <h3>{section.title}</h3>
      {!section.items.length ? <p className="empty-note">Keine Meldungen.</p> : section.items.map((event) => <EventLine key={event.seq} event={event} />)}
    </section>)}
    {sections[2].items.length > 0 && <details className="news-section older">
      <summary>Älteres <small>{sections[2].items.length}</small></summary>
      {sections[2].items.map((event) => <EventLine key={event.seq} event={event} />)}
    </details>}
  </>;
}
const clockText = (time: number) => {
  const date = new Date(time), today = new Date();
  return date.toDateString() === today.toDateString() ? date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }) : date.toLocaleDateString("de-CH", { weekday: "short" });
};
export function Chats({ v, send, thread, setThread, unread, muted, toggleMute }: { v: View; send: Sender; thread: string | null; setThread: (thread: string | null) => void; unread: Record<string, number>; muted: string[]; toggleMute: (id: string) => void }) {
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const visible = v.chat.filter((message) => !muted.includes(message.from));
  const messages = thread === null ? [] : visible.filter((message) => chatThread(message, v.me) === thread);
  const last = messages.at(-1)?.id;
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [thread, last]);
  const person = (id: string) => v.players.find((other) => other.id === id);
  if (thread === null) {
    const threads = ["", ...v.players.filter((other) => other.id !== v.me && !other.bot).map((other) => other.id)]
      .map((id) => ({ id, last: visible.filter((message) => chatThread(message, v.me) === id).at(-1) }));
    const direct = threads.slice(1).sort((left, right) => (right.last?.time ?? 0) - (left.last?.time ?? 0));
    return <div className="chat-list" role="list">
      {[threads[0], ...direct].map(({ id, last: preview }) => {
        const other = person(id), count = unread[id] ?? 0;
        return <button key={id || "table"} role="listitem" className="chat-row" data-unread={count > 0} onClick={() => setThread(id)}>
          {id ? <Avatar token={other?.token ?? 0} photo={other?.photo} /> : <span className="group-avatar"><Users size={19} /></span>}
          <span className="chat-row-main">
            <b>{id ? other?.name ?? "Ausgeschieden" : "Tischchat"}{!id && <Pin size={12} aria-label="Angeheftet" />}</b>
            <small>{preview ? `${preview.system ? "Handel: " : preview.from === v.me ? "Du: " : !id ? `${preview.name}: ` : ""}${messageText(preview)}` : id ? "Noch keine Nachrichten" : "Alle am Tisch"}</small>
          </span>
          <span className="chat-row-meta">
            {preview && <small>{clockText(preview.time)}</small>}
            {count > 0 && <i className="unread-badge">{count}</i>}
          </span>
        </button>;
      })}
      {v.players.every((other) => other.id === v.me || other.bot) && <p className="empty-note">Direktchats gibt es nur mit Personen, nicht mit Bots.</p>}
    </div>;
  }
  const other = person(thread), closed = !!thread && !other;
  return <div className="chat-thread">
    <header className="chat-head">
      <button className="icon" title="Alle Chats" onClick={() => setThread(null)}><ArrowLeft size={18} /></button>
      {thread ? <Avatar token={other?.token ?? 0} photo={other?.photo} /> : <span className="group-avatar"><Users size={17} /></span>}
      <strong>{thread ? other?.name ?? "Ausgeschieden" : "Tischchat"}</strong>
      {thread && other && <button className="icon" title={muted.includes(thread) ? "Stummschaltung aufheben" : "Stummschalten"} onClick={() => toggleMute(thread)}>{muted.includes(thread) ? <BellOff size={16} /> : <Bell size={16} />}</button>}
    </header>
    <div className="bubbles" ref={log} role="log" aria-label={thread ? "Privater Verlauf" : "Tischchat-Verlauf"}>
      {!messages.length && <p className="empty-note">{thread ? "Noch keine Direktnachrichten." : "Noch keine Nachrichten am Tisch."}</p>}
      {messages.map((message, index) => {
        if (message.system) return <p key={message.id} className="system-note" data-system="trade"><Handshake size={14} /><span>{message.text}</span><small>{new Date(message.time).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}</small></p>;
        const sender = person(message.from), mine = message.from === v.me, first = messages[index - 1]?.from !== message.from;
        return <div key={message.id} className={`bubble-row ${mine ? "outgoing" : "incoming"}`} data-first={first}>
          {!thread && !mine && (first ? <Avatar token={sender?.token ?? 0} photo={sender?.photo} /> : <span className="avatar-gap" />)}
          <p className="bubble">
            {!thread && !mine && first && <b style={{ color: sender ? ["#ed6553", "#d8b15c", "#48ab91", "#6b9dc0", "#ba90a7", "#9a8f6a"][sender.token] : undefined }}>{message.name}</b>}
            <span>{messageText(message)}</span>
            <small>{new Date(message.time).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}{mine && <CheckCheck size={14} />}</small>
          </p>
        </div>;
      })}
    </div>
    <form className="chat-compose" onSubmit={(event) => {
      event.preventDefault();
      if (!draft.trim() || closed) return;
      send({ type: "CHAT", text: draft, ...(thread ? { to: thread } : {}) });
      setDraft("");
    }}>
      <input aria-label="Nachricht" maxLength={300} placeholder={thread ? `Nachricht an ${other?.name ?? ""}` : "Nachricht an den Tisch"} value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button title="Nachricht senden" disabled={!draft.trim() || closed}><Send size={17} /></button>
    </form>
  </div>;
}

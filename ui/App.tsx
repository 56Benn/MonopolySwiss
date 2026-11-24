import { Component, Fragment, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AudioLines,
  Box,
  BookOpen,
  Building2,
  Compass,
  Crosshair,
  DoorOpen,
  GraduationCap,
  Hotel,
  Images,
  Lock,
  PanelLeft,
  PanelRight,
  PanelTop,
  Settings2,
  Spade,
  Smartphone,
  WifiOff,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { board, colours, groups, money, taxes, tokenColors } from "../game/board";
import { rent } from "../game/economy";
import { TurnDisplay, useTrip } from "./TurnDisplay";
import { portraitUrl } from "./portrait";
import { FieldEmblem, FieldTile } from "./FieldTile";
import { FieldCard } from "./FieldCard";
import { PurchaseOffer, type PayRequest, type Receipt } from "./Settlement";
import { playSound, unlockSound } from "./tableSound";
import { TableGuide } from "./TableGuide";
import { BoardStamp } from "./BoardFeed";
import { boardIdentity } from "./boardIdentity";
import { fieldPrint } from "./fieldPrint";
import type { View } from "../game/view";
import type { Command } from "../game/model";
import { connect, forget, type Channel, type Link, type Mode } from "./transport";
import { Entry, Welcome, Rules, Lobby, Modal, phaseNames, Help, icons } from "./panels";
import { Handset, activityText } from "./Handset";
import { emptyDraft, type Note, type Page, type Tab, type TradeDraft } from "./handsetTypes";
import { CasinoFloor, CasinoInvite } from "./Casino";
import { Spark } from "./Spark";
import { chatThread } from "./notifications";
import { chatLanguage, messageText } from "./chatText";
import type { Presence } from "./presence";
import "@fontsource-variable/manrope";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./style.css";
import "./simpleBoard.css";
import "./phone.css";
const Table = lazy(() => import("../three/Table"));
const PhotoDice = lazy(() => import("../three/Table").then((module) => ({ default: module.PhotoDice })));
const demo = [
  { pos: 0, token: 0 },
  { pos: 15, token: 3 },
  { pos: 27, token: 5 },
  { pos: 7, token: 1 },
];
function webgl() {
  try {
    const canvas = document.createElement("canvas"),
      gl = canvas.getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
class SceneGuard extends Component<{ children: ReactNode; fallback: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}
function Mark() {
  return (
    <svg className="mark" viewBox="0 0 42 42" aria-hidden="true">
      <rect x="1" y="1" width="40" height="40" rx="8" fill="#db5446" />
      <path d="M8 28 18 13l4 6 3-4 9 13h-5l-4-6-3 4-4-7-6 9z" fill="#fff5e0" />
    </svg>
  );
}
function Flat({ pick, v, pieces, dice, marks = [] }: { pick: (id: number) => void; v: View | null; pieces: { pos: number; token: number; photo?: string }[]; dice: ReactNode; marks?: number[] }) {
  const [inspected, inspect] = useState<number | null>(null);
  const selected = inspected === null ? null : board[inspected];
  const holder = selected && v?.players.find((person) => person.id === v.assets[selected.id].owner);
  return (
    <div className="flat photo-board" onPointerLeave={() => inspect(null)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) inspect(null); }}>
      <div className="flat-mid" style={{ backgroundColor: boardIdentity.feltDark, backgroundImage: `repeating-radial-gradient(ellipse at -22% 78%, transparent 0 15px, #b3cfa216 16px, transparent 17px), linear-gradient(145deg, ${boardIdentity.feltLight}, ${boardIdentity.feltDark})` }}>
        {selected ? (
          <div className="flat-inspect">
            <small>FELD {String(selected.id).padStart(2, "0")} · {groups[selected.group] ?? "Sonderfeld"}</small>
            <div className="inspect-stamp" style={{ background: fieldPrint(selected, holder?.token).paper }}><FieldEmblem tile={selected} owner={holder?.token} /></div>
            <b>{selected.name}</b>
            {selected.base > 0 && <span>{taxes[selected.id] ? taxes[selected.id].label : `${money(v?.assets[selected.id].value ?? selected.base)} CHF`}</span>}
            {selected.group >= 0 && <small>{holder?.name ?? "Bank"}</small>}
          </div>
        ) : <BoardStamp />}
        {dice}
      </div>
      {board.map((tile) => {
        const occupants = pieces.filter((person) => person.pos === tile.id), owner = v?.players.find((person) => person.id === v.assets[tile.id].owner);
        const marker = occupants.find((person) => person.token === v?.players[v.turn].token) ?? occupants[0];
        const side = Math.floor(tile.id / 10), step = tile.id % 10, level = v?.assets[tile.id].levels.length ?? 0;
        const [col, row] = [[11 - step, 11], [1, 11 - step], [1 + step, 1], [11, 1 + step]][side];
        return (
          <Fragment key={tile.id}>
          <button
            title={tile.name}
            aria-label={`Feld ${tile.id}: ${tile.name}`}
            data-occupied={!!marker}
            data-owned={!!owner}
            data-bus={marks.includes(tile.id) || undefined}
            aria-description={[owner && `Besitz: ${owner.name}`, level && (level >= 5 ? "Hotel" : `${level} Ausbaustufen`), ...occupants.map((person) => v?.players.find((seat) => seat.token === person.token)?.name)].filter(Boolean).join(" · ") || undefined}
            style={{ gridColumn: col, gridRow: row, outlineColor: tokenColors[owner?.token ?? -1] }}
            onFocus={() => inspect(tile.id)}
            onPointerEnter={(event) => { if (event.pointerType !== "touch") inspect(tile.id); }}
            onClick={() => pick(tile.id)}
          >
            <FieldTile tile={tile} owner={owner?.token} value={v?.assets[tile.id].value ?? tile.base} level={level} rent={v && owner && tile.group !== 9 ? rent(v, tile.id, 7) : null} />
            <small className="flat-pieces">
              {occupants.map((person) => {
                const Icon = icons[person.token];
                return <i key={person.token} className="flat-token" data-token={person.token} title={v?.players.find((seat) => seat.token === person.token)?.name ?? `Figur ${person.token + 1}`} style={{ backgroundColor: tokenColors[person.token] }}>
                  {person.photo ? <img alt="" src={portraitUrl(person.photo)} /> : <Icon strokeWidth={2.6} />}
                </i>;
              })}
            </small>
          </button>
          {level > 0 && <span className="flat-level" data-tile={tile.id} data-side={side} data-hotel={level >= 5 || undefined} title={level >= 5 ? "Hotel" : `${level} Ausbaustufen`} style={{ gridColumn: col, gridRow: row }}>
            {level >= 5 ? <Hotel aria-hidden="true" /> : Array.from({ length: level }, (_, index) => <i key={index} aria-hidden="true">★</i>)}
          </span>}
          </Fragment>
        );
      })}
    </div>
  );
}
type Flight = { id: string; net: number; text: string; from: { x: number; y: number }; to: { x: number; y: number } };
type Banner = { id: string; kind: "turn" | "warn"; text: string };
function LinkOverlay({ link, takeover, retry, leave }: { link: Link; takeover: boolean; retry: () => void; leave: () => void }) {
  const [now, setNow] = useState(Date.now);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { button.current?.focus({ preventScroll: true }); }, [link.state]);
  const wait = Math.max(0, Math.ceil((link.retryAt - now) / 1000));
  return <div className="link-overlay" role="alertdialog" aria-modal="true" aria-labelledby="link-title" aria-describedby="link-state">
    <div className="link-card" data-state={link.state}>
      <WifiOff size={36} aria-hidden="true" />
      <h2 id="link-title">Verbindung verloren</h2>
      <p id="link-state" role="status" aria-live="polite">
        {link.state === "closed" ? "Dieser Platz ist nicht mehr verfügbar." : link.state === "connecting" ? `Verbinde neu …${link.attempt ? ` (Versuch ${link.attempt})` : ""}` : `Neuer Versuch in ${wait} s (Versuch ${link.attempt})`}
      </p>
      {link.state !== "closed" && <span className="link-spinner" aria-hidden="true" />}
      <small>{link.state === "closed" ? "Kehre zur Startansicht zurück und tritt dem Raum erneut bei." : `Eingaben sind gesperrt, bis die Verbindung wieder steht. Dein Platz bleibt reserviert${takeover ? "; nach 90 Sekunden entscheidet vorübergehend ein Bot für dich" : ""}.`}</small>
      {link.state === "closed" ? <button ref={button} className="primary" onClick={leave}>Zur Startansicht</button> : <button ref={button} onClick={retry} disabled={link.state === "connecting"}>Jetzt neu verbinden</button>}
    </div>
  </div>;
}
export function App() {
  const [v, setView] = useState<View | null>(null),
    [modal, setModal] = useState(""),
    [mode, setMode] = useState<Mode>("local"),
    [busy, setBusy] = useState(false),
    [error, notice] = useState(""),
    [status, setStatus] = useState("Bereit"),
    [field, setField] = useState<number | null>(null),
    [tab, setTabState] = useState<Tab>("Tisch"),
    [page, setPage] = useState<Page>(null),
    [thread, setThread] = useState<string | null>(null),
    [draft, setDraft] = useState<TradeDraft>(emptyDraft),
    [presence, setPresence] = useState<Record<string, Presence>>({}),
    [link, setLink] = useState<Link>({ state: "online", attempt: 0, retryAt: 0 }),
    [request, setRequest] = useState<PayRequest | null>(null),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [notes, setNotes] = useState<Note[]>([]),
    [away, setAway] = useState(false),
    [banner, setBanner] = useState<Banner | null>(null),
    [flight, setFlight] = useState<Flight | null>(null),
    [cam, setCam] = useState("overview:0"),
    [gl] = useState(webgl),
    [boardMode, setBoardMode] = useState<"photos" | "3d">(() => {
      const saved = localStorage.getItem("sm-board-style");
      if (saved === "photos" || saved === "simple" || saved === "classic") return "photos";
      return gl ? "3d" : "photos";
    }),
    [side, setSide] = useState<"left" | "right">(() => (localStorage.getItem("sm-phone-side") === "left" ? "left" : "right")),
    [quality, setQuality] = useState(localStorage.getItem("sm-quality") ? localStorage.getItem("sm-quality") !== "low" : !matchMedia("(max-width:760px)").matches),
    [effects, setEffects] = useState(() => localStorage.getItem("sm-effects") !== "off" && !matchMedia("(prefers-reduced-motion: reduce)").matches),
    [sound, setSound] = useState(localStorage.getItem("sm-sound") !== "off"),
    [visible, setVisible] = useState(!document.hidden),
    [read, setRead] = useState<Record<string, number>>(() => JSON.parse(sessionStorage.getItem("sm-chat-reads") ?? "{}")),
    [muted, setMuted] = useState<string[]>(() => JSON.parse(localStorage.getItem("sm-muted") ?? "[]")),
    [lang, setLang] = useState(chatLanguage),
    [marketFilter, setMarketFilter] = useState("");
  const channel = useRef<Channel | null>(null);
  const report = useCallback((activity: "trade" | null) => channel.current?.activity?.(activity), []);
  const flat = boardMode !== "3d";
  const decision = v?.trades.find((item) => item.status === "Offen");
  const invoice = v?.phase === "debt" && !!v.debt && v.players[v.turn].id === v.me;
  const trip = useTrip(v);
  const changeTab = useCallback((next: Tab) => {
    setTabState(next);
    setPage(null);
    setThread(null);
  }, []);
  function chooseBoard(next: typeof boardMode) {
    const available = next === "3d" && !gl ? "photos" : next;
    setBoardMode(available);
    localStorage.setItem("sm-board-style", available);
  }
  function chooseSide(next: "left" | "right") {
    setSide(next);
    localStorage.setItem("sm-phone-side", next);
  }
  const initialCode = new URLSearchParams(location.search).get("raum") ?? "";
  const go = (next: Mode) => {
    setMode(next);
    setModal("entry");
    notice("");
  };
  const send = useCallback((cmd: Command) => channel.current?.send(cmd), []);
  const start = async (next: Mode, name: string, token: number, code: string, restore = false, photo?: string) => {
    setBusy(true);
    notice("");
    try {
      const conn = await connect(next, name, token, code, setView, notice, setStatus, restore, photo, setPresence, setLink);
      channel.current?.close();
      channel.current = conn;
      localStorage.setItem("sm-name", name);
      setModal("");
    } catch (e) {
      notice(e instanceof Error ? e.message : "Verbindung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const saved = localStorage.getItem("sm-mode");
    if (initialCode && initialCode !== JSON.parse(localStorage.getItem("sm-online") ?? "{}").code) {
      setMode("join");
      setModal("entry");
    } else if (saved) void start(saved === "local" ? "local" : "resume", localStorage.getItem("sm-name") ?? "Gast", 0, "", true);
    const change = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => {
      document.removeEventListener("visibilitychange", change);
      channel.current?.close();
    };
  }, []);
  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => notice(""), 6000);
    return () => clearTimeout(timeout);
  }, [error]);
  useEffect(() => {
    if (!sound) return;
    window.addEventListener("pointerdown", unlockSound);
    window.addEventListener("keydown", unlockSound);
    return () => {
      window.removeEventListener("pointerdown", unlockSound);
      window.removeEventListener("keydown", unlockSound);
    };
  }, [sound]);
  useEffect(() => {
    if (!v || tab !== "Chat" || thread === null || !visible) return;
    const last = v.chat.filter((message) => chatThread(message, v.me) === thread).at(-1)?.id;
    const key = `${v.id}:${v.me}:${thread}`;
    if (!last || (read[key] ?? 0) >= last) return;
    const updated = { ...Object.fromEntries(Object.entries(read).slice(-120)), [key]: last };
    setRead(updated);
    sessionStorage.setItem("sm-chat-reads", JSON.stringify(updated));
  }, [v, tab, thread, read, visible]);
  const unread: Record<string, number> = {};
  if (v)
    for (const message of v.chat) {
      const key = chatThread(message, v.me);
      if (message.from !== v.me && !muted.includes(message.from) && message.id > (read[`${v.id}:${v.me}:${key}`] ?? 0)) unread[key] = (unread[key] ?? 0) + 1;
    }
  const toggleMute = (id: string) => {
    const updated = muted.includes(id) ? muted.filter((other) => other !== id) : [...muted, id];
    setMuted(updated);
    localStorage.setItem("sm-muted", JSON.stringify(updated));
  };
  const leave = async () => {
    channel.current?.close();
    channel.current = null;
    await forget();
    setView(null);
    setModal("");
    setStatus("Bereit");
    setLink({ state: "online", attempt: 0, retryAt: 0 });
    setPresence({});
    setDraft(emptyDraft());
    changeTab("Tisch");
    history.replaceState(null, "", location.pathname);
  };
  const lastDecision = useRef("");
  useEffect(() => {
    if (decision?.id && lastDecision.current !== decision.id) {
      if (sound) playSound("phone");
      setRequest(null);
    } else if (!decision && lastDecision.current) {
      const deal = v?.trades.find((item) => item.id === lastDecision.current);
      if (deal) {
        const good = deal.status === "Angenommen";
        const result: Note = { id: `t${deal.id}`, kind: "trade", title: `Handel ${deal.status.toLocaleLowerCase("de-CH")}`, text: good ? "Der Tausch wurde gebucht." : "Es wurde nichts getauscht.", tab: "Handel", good };
        setNotes((previous) => {
          const [shown, ...rest] = previous;
          return (shown ? [shown, result, ...rest] : [result]).slice(0, 5);
        });
        if (sound) playSound(good ? "accepted" : "rejected");
      }
      setDraft(emptyDraft());
    }
    lastDecision.current = decision?.id ?? "";
  }, [decision, sound, v?.trades]);
  useEffect(() => {
    if (!receipt) return;
    const timer = setTimeout(() => setReceipt(null), 2500);
    return () => clearTimeout(timer);
  }, [receipt]);
  const seen = useRef<{ key: string; events: number; chat: number } | null>(null);
  useEffect(() => {
    if (!v) return;
    const key = `${v.id}:${v.me}`, events = v.events.at(-1)?.seq ?? 0, chat = v.chat.at(-1)?.id ?? 0;
    const before = seen.current;
    seen.current = { key, events, chat };
    if (!before || before.key !== key) return;
    const fresh: Note[] = [];
    for (const message of v.chat) {
      if (message.id <= before.chat || message.from === v.me || muted.includes(message.from)) continue;
      const room = chatThread(message, v.me);
      if (tab === "Chat" && thread === room && visible) continue;
      fresh.push({ id: `c${message.id}`, kind: message.system ? "trade" : "chat", title: message.system ? "Handel" : message.to ? message.name : `Tischchat · ${message.name}`, text: messageText(message, lang), tab: "Chat", thread: room });
    }
    for (const event of v.events) {
      if (event.seq <= before.events || event.kind === "Lobby" || /^Handel: /.test(event.text) || (event.kind === "Zug" && / würfelt | mit dem Bus /.test(event.text))) continue;
      fresh.push({ id: `e${event.seq}`, kind: event.kind === "Casino" ? "casino" : /Gefängnis/.test(event.text) ? "jail" : "news", title: event.kind === "Markt" ? event.cause ?? "Marktbewegung" : event.kind === "Casino" ? "Casino" : event.kind === "Konto" ? "Konto" : "Spieltisch", text: event.text, tab: "News" });
    }
    if (fresh.length) setNotes((previous) => {
      const [shown, ...rest] = previous, chats = fresh.filter((item) => item.kind === "chat"), news = fresh.filter((item) => item.kind !== "chat");
      return (shown ? [shown, ...chats, ...rest, ...news] : [...chats, ...rest, ...news]).slice(0, 5);
    });
  }, [v]);
  const note = notes[0] ?? null;
  useEffect(() => {
    if (note && sound) playSound("message");
  }, [note?.id]);
  const turnKey = v && !["lobby", "over"].includes(v.phase) && v.players[v.turn].id === v.me ? `${v.id}:${v.round}:${v.turn}` : "";
  const lastTurn = useRef("");
  useEffect(() => {
    if (!turnKey || lastTurn.current === turnKey) return;
    lastTurn.current = turnKey;
    setBanner({ id: turnKey, kind: "turn", text: "Du bist am Zug" });
    if (sound) playSound("turn");
  }, [turnKey]);
  const warned = useRef("");
  const watchClock = !!v && !v.paused && !v.tradeUntil && v.players[v.turn].id === v.me && ["roll", "buy", "debt"].includes(v.phase) && v.deadline > 0;
  useEffect(() => {
    if (!watchClock || !v) return;
    const key = `${v.deadline}`;
    if (warned.current === key) return;
    const delay = v.deadline - 15000 - Date.now();
    if (delay < -12000) return;
    const timer = setTimeout(() => {
      warned.current = key;
      setBanner({ id: `w${key}`, kind: "warn", text: `Deine Zeit läuft ab · noch ${Math.max(1, Math.ceil((v.deadline - Date.now()) / 1000))} s` });
      if (sound) playSound("warn");
    }, Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [watchClock, v?.deadline]);
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), banner.kind === "turn" ? 2200 : 2800);
    return () => clearTimeout(timer);
  }, [banner]);
  const lastView = useRef<View | null>(null);
  useEffect(() => {
    const old = lastView.current;
    lastView.current = v;
    if (!sound || !old || !v || old.id !== v.id) return;
    if (v.rolls !== old.rolls && !v.movement?.transfer) playSound("roll");
    if (!old.casino && v.casino) playSound("casino");
    if (v.players.some((seat, index) => seat.jail > 0 && !old.players[index]?.jail)) playSound("jail");
    const entry = v.own.ledger.at(-1), prev = old.own.ledger.at(-1);
    if (entry && (entry.time !== prev?.time || entry.reason !== prev?.reason || entry.delta !== prev?.delta) && !/^(Casino|Blackjack)/.test(entry.reason)) playSound(entry.reason.startsWith("Kauf") ? "buy" : entry.reason.startsWith("Bankverkauf") ? "sell" : entry.delta > 0 ? "money" : "pay");
  }, [v, sound]);
  useEffect(() => {
    if (sound && trip.moving && !trip.rolling && !trip.reveal) playSound("step");
  }, [sound, trip.position, trip.moving, trip.rolling, trip.reveal]);
  const balanceOffset = useRef(118);
  const lastLedger = useRef("");
  useEffect(() => {
    if (!v) return;
    const entry = v.own.ledger.at(-1);
    const key = entry ? `${v.id}:${entry.time}:${entry.reason}:${entry.delta}:${v.own.ledger.filter((item) => item.time === entry.time).length}` : `${v.id}:leer`;
    const previous = lastLedger.current;
    lastLedger.current = key;
    if (!previous || previous === key || !entry || !effects || v.phase === "lobby") return;
    const batch = v.own.ledger.filter((item) => item.time === entry.time && !/^(Casino|Blackjack)/.test(item.reason) && !/^(Startguthaben)/.test(item.reason));
    const net = batch.reduce((total, item) => total + item.delta, 0);
    if (!net) return;
    const phone = document.querySelector(".device-frame")?.getBoundingClientRect(), stage = document.querySelector(".table-stage")?.getBoundingClientRect();
    if (!phone || !stage) return;
    const label = document.querySelector("[data-balance]")?.getBoundingClientRect();
    const shown = !!label && label.height > 0 && label.top >= phone.top && label.bottom <= phone.bottom;
    if (shown) balanceOffset.current = label.top + label.height / 2 - phone.top;
    const below = phone.top >= stage.bottom - 4;
    const y = phone.top + balanceOffset.current;
    const account = shown ? { x: label.left + label.width / 2, y: label.top + label.height / 2 } : below ? { x: phone.left + phone.width / 2, y } : { x: side === "right" ? phone.left : phone.right, y };
    const board = below ? { x: stage.left + stage.width / 2, y: stage.bottom - 30 } : { x: side === "right" ? stage.left + stage.width * 0.12 : stage.right - stage.width * 0.12, y: account.y };
    setFlight({ id: key, net, text: batch.length > 1 ? `${batch.length} Buchungen` : batch[0]?.reason ?? "", from: net > 0 ? board : account, to: net > 0 ? account : board });
  }, [v, effects, side]);
  useEffect(() => {
    if (!flight) return;
    const timer = setTimeout(() => setFlight(null), 3000);
    return () => clearTimeout(timer);
  }, [flight]);
  useEffect(() => {
    if (!v?.casino) setAway(false);
  }, [v?.casino]);
  useEffect(() => {
    if (v?.phase !== "debt") return;
    setRequest(null);
  }, [v?.phase]);
  const pay = (next: PayRequest) => {
    setRequest(next);
    if (sound) playSound("phone");
  };
  const paid = (next: Receipt) => {
    setRequest(null);
    setReceipt(next);
    if (sound) playSound("pay");
  };
  const openNote = (item: Note) => {
    setNotes((previous) => previous.filter((other) => other.id !== item.id));
    changeTab(item.tab);
    if (item.thread !== undefined) setThread(item.thread);
  };
  const tradeFor = (owner: string, tile: number) => {
    setDraft({ ...emptyDraft(), view: "compose", contact: owner, want: { cash: 0, assets: [tile], cards: [] } });
    changeTab("Handel");
  };
  const pieces = v ? v.players.filter((p) => !p.out).map((p) => (trip.moving && v.movement?.player === p.id ? { ...p, pos: trip.position ?? p.pos } : p)) : demo;
  const myBus = v?.phase === "bus" && v.players[v.turn].id === v.me && !v.paused && !v.tradeUntil ? v.bus ?? [] : [];
  const pickField = (id: number) => {
    const option = myBus.find((item) => item.target === id);
    if (option) send({ type: "BUS_CHOOSE", steps: option.steps });
    else setField(id);
  };
  const table = v?.casino;
  const invited = !!table && v?.phase === "casinoInvite" && table.queue.includes(v.me) && !table.arrived.includes(v.me) && !trip.moving;
  const isCasino = !!table && !trip.moving && !away && (v?.phase !== "casinoInvite" || table.arrived.includes(v.me));
  const phase = v ? phaseNames[v.phase] : "Tischvorschau";
  const diceValues = v?.dice ?? [5, 3], printedDice = <b className="printed-dice">{diceValues.join(" · ")}</b>;
  const flatBoard = <Flat pick={pickField} v={v} pieces={pieces} marks={myBus.map((item) => item.target)} dice={<div className="photo-dice" role="img" aria-label={`Würfel: ${diceValues.join(", ")}`}>{flat && gl ? <SceneGuard fallback={printedDice}><Suspense fallback={printedDice}><PhotoDice values={diceValues} at={v?.movement?.transfer ? 0 : trip.at} motion={effects} /></Suspense></SceneGuard> : printedDice}</div>} />;
  const purchase = v?.phase === "buy" && !v.paused && !trip.moving && v.players[v.turn].id === v.me;
  const camera = (key: string) => setCam(`${key}:${Date.now()}`);
  const testing = !!v && !v.code && v.host === v.me && !["lobby", "over"].includes(v.phase);
  const testReady = testing && v!.phase === "roll" && v!.players[v!.turn].id === v!.me && !trip.moving && !v!.tradeUntil && !v!.paused;
  const blocked = (!!decision && decision.to === v?.me) || invoice || invited;
  const offline = !!v?.code && link.state !== "online";
  const viewSwitch = (
    <div className="view-switch board-mode" role="group" aria-label="Brettansicht">
      {([["photos", "Fotobrett", Images], ["3d", "3D", Box]] as const).map(([key, label, Icon]) => (
        <button key={key} disabled={key === "3d" && !gl} title={key === "3d" && !gl ? "3D benötigt WebGL" : undefined} aria-pressed={boardMode === key} onClick={() => chooseBoard(key)}><Icon size={15} />{label}</button>
      ))}
    </div>
  );
  const menu = (
    <div className="phone-menu">
      <button onClick={() => setModal("guide")}><GraduationCap size={17} />Tischtour</button>
      <button onClick={() => setModal("market")}><Activity size={17} />Marktübersicht</button>
      <button onClick={() => setModal("rules")}><BookOpen size={17} />Regelheft</button>
      <button onClick={() => setModal("prefs")}><Settings2 size={17} />Darstellung & Ton</button>
      <div className="menu-row"><span>Brett</span>{viewSwitch}</div>
      <div className="menu-row"><span>Handy</span><div className="view-switch" role="group" aria-label="Handy-Seite">
        <button aria-pressed={side === "left"} onClick={() => chooseSide("left")}><PanelLeft size={15} />Links</button>
        <button aria-pressed={side === "right"} onClick={() => chooseSide("right")}><PanelRight size={15} />Rechts</button>
      </div></div>
      <small className="muted-line">{v ? (v.code ? `Raum ${v.code} · ${status}` : "Lokaler Tisch") : "Tisch bereit"}</small>
      {v && <button className="danger" onClick={() => setModal("leave")}><DoorOpen size={17} />{v.phase === "over" ? "Neue Lobby" : "Tisch verlassen"}</button>}
    </div>
  );
  const phone = !v ? <>
    <div className="device-status" aria-hidden="true"><span>SM MOBILE</span><i /><span /></div>
    <header className="device-heading"><h2>Swiss Market</h2></header>
    <div className="device-screen pregame"><Welcome choose={go} rules={() => setModal("rules")} />{menu}</div>
  </> : v.phase === "lobby" ? <>
    <div className="device-status" aria-hidden="true"><span>SM MOBILE</span><i /><span /></div>
    <header className="device-heading"><h2>Lobby</h2></header>
    <div className="device-screen pregame"><Lobby v={v} send={send} notice={notice} />{menu}</div>
  </> : <Handset
    v={v}
    send={send}
    tab={tab}
    setTab={changeTab}
    page={page}
    setPage={setPage}
    thread={thread}
    setThread={setThread}
    draft={draft}
    setDraft={setDraft}
    presence={presence}
    unread={unread}
    muted={muted}
    toggleMute={toggleMute}
    pick={setField}
    pay={pay}
    request={request}
    cancelRequest={() => setRequest(null)}
    receipt={receipt}
    paid={paid}
    trip={trip}
    effects={effects}
    note={note}
    dismissNote={() => setNotes((previous) => previous.slice(1))}
    openNote={openNote}
    menu={menu}
    report={report}
    home={() => void leave()}
    toCasino={() => setAway(false)}
  />;
  return (
    <div className={`shell desk-shell club-table app-shell ${effects ? "" : "reduce"}`} data-phone={side}>
      <div className="game-view" inert={blocked || offline}>
        <section className={`table-area ${isCasino ? "casino-area" : ""}`} aria-label="Interaktiver Spieltisch">
          <div className="surface-top">
            <div className="brand"><Mark /><div>SWISS MARKET<small>HELVETIC BOARD CLUB</small></div></div>
            <h1 className="sr-only">{isCasino ? "Das Casino." : "Der Spieltisch."}</h1>
            <div className="table-tag"><span className="dot" />{v && v.phase !== "lobby" ? `RUNDE ${String(v.round).padStart(2, "0")}` : "TISCH 01"}<i /> {isCasino ? "BLACKJACK" : v && v.phase !== "lobby" && v.phase !== "over" ? activityText(v, presence) : phase.toUpperCase()}</div>
          </div>
          <div className="table-stage">
            <AnimatePresence mode="wait" initial={false}>
              {isCasino && v ? (
                <motion.div key="casino" className="stage-layer" initial={{ opacity: 0, scale: 0.9, filter: "blur(6px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 1.08, filter: "blur(6px)" }} transition={{ duration: effects ? 0.8 : 0 }}>
                  <CasinoFloor v={v} send={send} sound={sound} leave={() => setAway(true)} />
                </motion.div>
              ) : (
                <motion.div key="board" className="stage-layer" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: effects ? 0.7 : 0 }}>
                  <div className="scene" inert={purchase}>
                    {!visible ? null : flat || !gl ? flatBoard : (
                      <SceneGuard fallback={flatBoard}>
                        <Suspense fallback={flatBoard}>
                          <Table
                            pieces={pieces}
                            pick={pickField}
                            marks={myBus.map((item) => item.target)}
                            dice={v?.dice ?? [5, 3]}
                            roll={v?.rolls ?? 0}
                            cameraMode={cam}
                            quality={quality}
                            motion={effects}
                            active={v ? pieces.findIndex((seat) => seat.token === v.players[v.turn].token) : undefined}
                            prices={v?.assets.map((asset) => asset.value).join(",")}
                            rents={v?.assets.map((asset, id) => (asset.owner && board[id].group !== 9 ? rent(v, id, 7) : 0)).join(",")}
                            rolledAt={v?.movement?.transfer ? 0 : trip.at}
                            levels={v?.assets.map((asset) => asset.levels.length)}
                            owners={v?.assets.map((asset) => v.players.find((p) => p.id === asset.owner)?.token ?? -1)}
                          />
                        </Suspense>
                      </SceneGuard>
                    )}
                  </div>
                  {v && <TurnDisplay v={v} trip={trip} />}
                  {myBus.length > 0 && <div className="bus-hint" role="status">Bus: Klicke eines der markierten Felder ({myBus.map((item) => board[item.target].short).join(", ")})</div>}
                  {purchase && <PurchaseOffer v={v} send={send} />}
                  {field !== null && !purchase && <FieldCard key={field} id={field} v={v} close={() => setField(null)} send={send} pay={pay} trade={tradeFor} />}
                  {table && away && <button className="back-to-casino" onClick={() => setAway(false)}><Spade size={16} />Zurück ins Casino</button>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="surface-bottom" inert={purchase}>
            {testing && <div className="test-drive" role="group" aria-label="Temporäre Testfahrten">
              <small>TEST</small>
              <button disabled={!testReady} onClick={() => send({ type: "TEST_TRAVEL", target: "jail" })}><Lock size={15} />Test Gefängnis</button>
              <button disabled={!testReady} onClick={() => send({ type: "TEST_TRAVEL", target: "casino" })}><Spade size={15} />Test Casino</button>
            </div>}
            <div className="board-tools">
              {!isCasino && gl && !flat && <div className="camera-tools">
                <button title="Übersicht" aria-pressed={cam.startsWith("overview")} onClick={() => camera("overview")}><Compass /></button>
                <button title="Aktiver Spieler" onClick={() => camera("focus")}><Crosshair /></button>
                <button title="Draufsicht" onClick={() => camera("top")}><PanelTop /></button>
              </div>}
              {viewSwitch}
            </div>
          </div>
        </section>
      </div>
      <aside className="device-frame" aria-label="Spielhandy" inert={offline}>
        {phone}
        {error && <p className="device-error" role="alert">{error}</p>}
      </aside>
      {invited && v && !offline && <CasinoInvite v={v} send={send} />}
      {offline && <LinkOverlay link={link} takeover={!!v?.settings.takeover} retry={() => channel.current?.reconnect?.()} leave={() => void leave()} />}
      <AnimatePresence>
        {banner && <motion.div key={banner.id} className={`turn-banner ${banner.kind}`} role="status" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.45 }}>
          {banner.kind === "turn" ? <Smartphone size={22} /> : <Activity size={22} />}<strong>{banner.text}</strong>
        </motion.div>}
      </AnimatePresence>
      <AnimatePresence>
        {flight && <div key={flight.id} aria-hidden="true" className={`money-flight ${flight.net < 0 ? "debit" : "credit"}`}>
          {[0, 1, 2, 3, 4].map((note) => <motion.i key={note} className="flight-note"
            initial={{ x: flight.from.x, y: flight.from.y, opacity: 0, rotate: (note - 2) * 9 }}
            animate={{ x: [flight.from.x, flight.to.x + (note - 2) * 6], y: [flight.from.y, flight.to.y + (note % 2 ? -4 : 4)], opacity: [0, 1, 1, 0], rotate: [(note - 2) * 9, (note - 2) * -6] }}
            transition={{ duration: 1.9, delay: note * 0.11, times: flight.net > 0 ? [0, 0.15, 0.8, 1] : [0, 0.1, 0.65, 1], ease: "easeInOut" }}><span>CHF</span></motion.i>)}
          <motion.b className="flight-amount"
            initial={{ x: flight.from.x, y: flight.from.y, opacity: 0 }}
            animate={{ x: [flight.from.x, flight.to.x], y: [flight.from.y - 30, flight.to.y - 30], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.6, times: [0, 0.6, 0.85, 1], ease: "easeInOut" }}>
            {flight.net > 0 ? "+" : "−"}{money(Math.abs(flight.net))}<small>{flight.text}</small>
          </motion.b>
        </div>}
      </AnimatePresence>
      {modal === "entry" && (
        <Modal title={mode === "local" ? "Lokal gegen Bots" : mode === "create" ? "Lobby erstellen" : "Mit Code beitreten"} close={() => setModal("")}>
          <Entry mode={mode} initialCode={initialCode} busy={busy} enter={(name, token, code, photo) => void start(mode, name, token, code, false, photo)} />
          {error && <p role="alert" className="negative">{error}</p>}
        </Modal>
      )}
      {modal === "rules" && <Modal title="Regelheft" close={() => setModal("")}><Rules /></Modal>}
      {modal === "guide" && <TableGuide close={() => setModal("")} />}
      {modal === "prefs" && (
        <Modal title="Darstellung & Ton" close={() => setModal("")}>
          <div className="setting">
            <label className="check"><input type="checkbox" checked={sound} onChange={(event) => { setSound(event.target.checked); localStorage.setItem("sm-sound", event.target.checked ? "on" : "off"); }} /><AudioLines size={17} />Spielton</label>
            <Help label="Spielton" />
          </div>
          <div className="setting">
            <label className="check"><input type="checkbox" checked={effects} onChange={(event) => { setEffects(event.target.checked); localStorage.setItem("sm-effects", event.target.checked ? "on" : "off"); }} />Bewegung & Effekte</label>
            <Help label="Bewegung & Effekte" />
          </div>
          <div className="setting">
            <label>Renderqualität<select value={quality ? "high" : "low"} onChange={(event) => { setQuality(event.target.value === "high"); localStorage.setItem("sm-quality", event.target.value); }}><option value="high">Hoch · weiche Schatten</option><option value="low">Sparsam · ohne Schatten</option></select></label>
            <Help label="Renderqualität" />
          </div>
          <div className="setting">
            <label>Handy-Seite<select value={side} onChange={(event) => chooseSide(event.target.value === "left" ? "left" : "right")}><option value="right">Rechts</option><option value="left">Links</option></select></label>
          </div>
          <div className="setting">
            <label>Sprache der Chat-Sprüche<select value={lang} onChange={(event) => { const next = event.target.value === "en" ? "en" : "de"; setLang(next); localStorage.setItem("sm-lang", next); }}><option value="de">Deutsch</option><option value="en">English</option></select></label>
          </div>
        </Modal>
      )}
      {modal === "market" && (
        <Modal title="Marktübersicht" close={() => setModal("")}>
          <label>Firma oder Branche<input placeholder="Markt durchsuchen" value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)} /></label>
          {board.filter((t) => t.group >= 0 && `${t.name} ${groups[t.group]}`.toLowerCase().includes(marketFilter.toLowerCase())).map((t) => (
            <button className="asset-row wide" key={t.id} onClick={() => { setField(t.id); setModal(""); }}>
              <Building2 size={16} color={colours[t.group]} />
              <span>{t.name}<small>{groups[t.group]}</small></span>
              <Spark values={v?.assets[t.id].history ?? [t.base]} />
              <b>{money(v?.assets[t.id].value ?? t.base)}</b>
            </button>
          ))}
        </Modal>
      )}
      {modal === "leave" && (
        <Modal title="Tisch verlassen?" close={() => setModal("")}>
          <p>{v?.code ? "Der Raum bleibt für andere Plätze bestehen." : "Der lokale Spielstand auf diesem Gerät wird entfernt."}</p>
          <button className="primary wide" onClick={() => void leave()}>Tisch verlassen</button>
        </Modal>
      )}
      {error && !modal && !v && (
        <div role="status" className="toast">{error}<button onClick={() => notice("")} title="Meldung schliessen"><X size={15} /></button></div>
      )}
    </div>
  );
}

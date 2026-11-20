import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Plus,
  Users,
  Hash,
  BookOpen,
  Bot,
  Copy,
  Check,
  LockKeyhole,
  Unlock,
  X,
  Dices,
  Flag,
  Mountain,
  TrainFront,
  Watch,
  BriefcaseBusiness,
  Landmark,
  Diamond,
  Radio,
  CircleHelp,
} from "lucide-react";
import {
  defaults,
  presets,
  type Settings,
  type Command,
  type Difficulty,
} from "../game/model";
import type { View } from "../game/view";
import { tokens, tokenColors } from "../game/board";
import type { Mode } from "./transport";
import { PortraitCamera } from "./PortraitCamera";
import { makePortrait, portraitUrl } from "./portrait";
export const icons = [
  Mountain,
  TrainFront,
  Watch,
  BriefcaseBusiness,
  Landmark,
  Diamond,
];
export const phaseNames = {
  travel: "Unterwegs",
  lobby: "Lobby",
  roll: "Zugbeginn",
  bus: "Busziel wählen",
  buy: "Kaufentscheidung",
  auction: "Auktion",
  manage: "Zugabschluss",
  debt: "Schuldenklärung",
  choice: "Risikokapital",
  insurance: "Versicherung",
  casinoInvite: "Casino · Einladung",
  casinoJoin: "Casino · Teilnahme",
  casinoBet: "Casino · Einsatz",
  blackjack: "Blackjack",
  casinoSettle: "Casino · Abrechnung",
  over: "Spielende",
};
export type Sender = (cmd: Command) => void;
export const propertyLabel = (count: number) =>
  `${count} ${count === 1 ? "Besitzfeld" : "Besitzfelder"}`;
export function Modal({
  title,
  children,
  close,
  className,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      className={className}
      ref={ref}
      aria-label={title}
      onCancel={close}
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
    >
      <div className="dialog-inner">
        <header>
          <h2>{title}</h2>
          <button className="icon" title="Schliessen" onClick={close}>
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Avatar({ token, photo }: { token: number; photo?: string }) {
  const Icon = icons[token];
  return (
    <span className="avatar" style={{ color: tokenColors[token] }}>
      {photo ? (
        <img className="portrait" src={portraitUrl(photo)} alt="" />
      ) : (
        <Icon size={20} />
      )}
    </span>
  );
}
export function Welcome({
  choose,
  rules,
}: {
  choose: (mode: Mode) => void;
  rules: () => void;
}) {
  return (
    <aside className="rail welcome">
      <div className="rail-kicker">
        <span className="line" />
        SPIELLOBBY
      </div>
      <h2>Platz nehmen.</h2>
      <p>Eröffne einen privaten Spieltisch oder spiele lokal gegen Bots.</p>
      <div className="entry-actions">
        <button className="primary" onClick={() => choose("create")}>
          <Plus />
          Lobby erstellen
          <ArrowRight />
        </button>
        <button onClick={() => choose("join")}>
          <Hash />
          Mit Code beitreten
          <ArrowRight />
        </button>
        <button onClick={() => choose("local")}>
          <Bot />
          Lokal gegen Bots
          <ArrowRight />
        </button>
      </div>
      <div className="rail-divider" />
      <div className="rail-kicker">TISCHREGELN</div>
      <dl className="facts">
        <div>
          <dt>
            <Users />
            Spielerplätze
          </dt>
          <dd>2 – 6</dd>
        </div>
        <div>
          <dt>
            <Landmark />
            Startguthaben
          </dt>
          <dd>500M CHF</dd>
        </div>
        <div>
          <dt>
            <Dices />
            Würfel
          </dt>
          <dd>2 × D6</dd>
        </div>
      </dl>
      <button className="text-action" onClick={rules}>
        <BookOpen size={16} />
        Regelheft öffnen
        <ArrowRight size={14} />
      </button>
    </aside>
  );
}
export function Entry({
  mode,
  initialCode,
  enter,
  busy,
}: {
  mode: Mode;
  initialCode: string;
  enter: (name: string, token: number, code: string, photo?: string) => void;
  busy: boolean;
}) {
  const [name, setName] = useState(localStorage.getItem("sm-name") ?? ""),
    [token, setToken] = useState(mode === "join" ? 1 : 0),
    [code, setCode] = useState(initialCode);
  const [photo, setPhoto] = useState<string>(),
    [photoOpen,setPhotoOpen]=useState(false),
    [photoError, setPhotoError] = useState(""),
    [processing, setProcessing] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!processing) enter(name.trim(), token, code, photo);
      }}
    >
      <p>
        {mode === "local"
          ? "Dieser Tisch wird auf deinem Gerät gespeichert."
          : "Privater Online-Tisch · ohne Registrierung"}
      </p>
      <label>
        Gastname
        <input
          autoFocus
          placeholder="Dein Name"
          maxLength={22}
          required
          pattern=".*\S.*"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {mode === "join" && (
        <label>
          Raumnummer
          <input
            placeholder="000000"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
        </label>
      )}
      <fieldset>
        <legend>Spielfigur</legend>
        <div className="tokens">
          {tokens.map((label, index) => (
            <button
              type="button"
              aria-pressed={index === token}
              key={label}
              onClick={() => setToken(index)}
            >
              <Avatar token={index} />
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <details className="photo-picker" onToggle={event=>setPhotoOpen(event.currentTarget.open)}>
        <summary>Figurenkopf mit eigenem Foto</summary>
        {photoOpen && <PortraitCamera select={setPhoto} report={setPhotoError}/>}
        <label>
          Profilfoto für diesen Tisch
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={processing}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              event.target.value = "";
              setProcessing(true);
              setPhotoError("");
              try {
                setPhoto(await makePortrait(file));
              } catch (error) {
                setPhotoError(
                  error instanceof Error
                    ? error.message
                    : "Bild konnte nicht geladen werden.",
                );
              } finally {
                setProcessing(false);
              }
            }}
          />
        </label>
        <small>
          Alle am Tisch sehen die Miniatur. Das Originalbild bleibt auf deinem
          Gerät.
        </small>
        {photo && (
          <div className="pretrade">
            <Avatar token={token} photo={photo} />
            <button type="button" onClick={() => setPhoto(undefined)}>
              Foto entfernen
            </button>
          </div>
        )}
        {photoError && <p role="alert">{photoError}</p>}
      </details>
      <button className="primary wide" disabled={busy || processing}>
        {busy
          ? "Verbindung läuft …"
          : mode === "local"
            ? "Lokalen Tisch öffnen"
            : mode === "create"
              ? "Lobby eröffnen"
              : "Beitreten"}
        <ArrowRight />
      </button>
    </form>
  );
}
export function Rules() {
  return (
    <article className="rules">
      <p>
        Alle Beträge sind fiktive Spielwerte in CHF. Es gibt weder Echtgeld noch
        echte Börsenkurse.
      </p>
      {[
        [
          "Ziel & Zug",
          "Der letzte zahlungsfähige Platz gewinnt. Alternativ endet die Partie beim ersten Konkurs oder beim gewählten Nettovermögensziel. Ein Zug gehört einem Platz, eine Spielrunde umfasst jeden aktiven Platz einmal.",
        ],
        [
          "Würfeln & START",
          "Handeln und ausbauen vor dem Wurf. Nach der Feldentscheidung endet der Zug automatisch. Der optionale Tempowürfel zeigt 1, 2, 3 Zusatzschritte, Bus (du wählst auf dem Brett: erster Würfel, zweiter Würfel oder Summe; nie direkt ins Gefängnis) oder Freifeld (zum nächsten freien Besitz). Nur die ersten zwei Würfel entscheiden über Pasch. Der dritte Pasch führt direkt in Haft. START vorwärts überqueren oder erreichen: einmal 50M. Leertaste oder Enter würfelt.",
        ],
        [
          "Firmen & Miete",
          "Kauf auf dem Brett wählen und im Handy innert 10 Sekunden bezahlen. Fehlt das Geld, bleibt nur Passen. Bei Verzicht bleibt das Feld bei der Bank. Auktionen gibt es nur bei Verkäufen und ohne Zeitlimit. Preise steigen entlang des Bretts. Miete in % des aktuellen Werts: 6 %, volle Branche 12 %, 1–4 Geldstapel 30 / 55 / 90 / 125 %, Hotel 170 %. Wer im Gefängnis sitzt, erhält keine Miete.",
        ],
        [
          "Ausbau & Liquidität",
          "Eine Stufe kostet 45 % des aktuellen Werts, sofort per Ausbauknopf. Nach vier Geldstapeln folgt das Hotel. Stufen und Firmen verkaufen ist nur möglich, um eine offene Zahlung zu begleichen; eine Stufe bringt 60 % ihres ursprünglichen Preises. Beleihung: 50 %, Tilgung plus 10 %. Bankverkauf: 60 % des Werts abzüglich Darlehen.",
        ],
        [
          "Flughäfen & VC",
          "1 / 2 / 3 / 4 unbeliehene Flughäfen: 10 / 20 / 40 / 80 % des Flughafenwerts. VC: Bewegungssumme × 1.6 % oder bei beiden VC 4 % des Werts. Keine Ausbaustufen.",
        ],
        [
          "Markt & Karten",
          "Ereignisse verändern Firmenwerte und damit Mieten, Ausbaupreise und Verkaufswerte für alle. Kurse bleiben bei 70–150 % des Startwerts und kehren jede Runde leicht zum Startwert zurück. Chancekarten bewegen Figuren, buchen Geld oder bleiben als handelbare Besitzkarten auf der Hand.",
        ],
        [
          "Gefängnis",
          "50M zahlen, Anwaltskarte spielen oder auf Pasch würfeln. Haft-Pasch bewegt ohne Zusatzwurf. Nach drei erfolglosen Haftzügen ist der vierte Zug frei. Während der Haft gibt es keine Mieteinnahmen.",
        ],
        [
          "Handel & Schulden",
          "Je Empfänger zwei Anfragen pro Spielrunde, nur vor dem Würfeln. Eine Anfrage wird sofort beantwortet; das Spiel wartet höchstens 30 Sekunden. Ausgebaute Branchen sind nicht handelbar. Anfragen, Annahmen und Ablehnungen erscheinen im Tischchat. Miete, Steuern, Bussen und Käufe bestätigst du im Handy innert 10 Sekunden per Wisch nach rechts; Ausbauten werden sofort gebucht. Fehlt Geld für eine Pflichtzahlung, bleiben 40 Sekunden zur Finanzierung, danach baut die Bank ab, beleiht und verkauft. „Bankrott melden“ lässt nur dich ausscheiden; für ein Unentschieden stimmen alle ab.",
        ],
        [
          "Blackjack",
          "Wer auf dem Casino landet, erhält 10M und lädt alle ein. Nach 10 Sekunden sind alle im Casino, danach 5 Sekunden für Teilnehmen oder Zuschauen und 20 Sekunden für den Einsatz: Gastgeber bis 40M, alle anderen bis 10M. Gespielt wird von rechts nach links, je Entscheidung 10 Sekunden (sonst Bleiben). Verdoppeln und Teilen sind möglich. Der Dealer zieht bis 16 und bleibt ab 17. Auszahlung: 2× bei Sieg, 1× bei Gleichstand, 2.5× bei Blackjack.",
        ],
        [
          "Wertung",
          "Nettovermögen = Bargeld inkl. einmalig gezählter Reservierungen + Firmenwerte + halbe bezahlte Ausbaukosten − Darlehen. Gratis-Chips zählen nicht. Bei Gleichstand entscheiden Nettovermögen, Bargeld, dann geteilter Sieg.",
        ],
      ].map(([title, text], index) => (
        <details key={title} open={index === 0}>
          <summary>{title}</summary>
          <p>{text}</p>
        </details>
      ))}
    </article>
  );
}
const hints: Record<string, string> = {
  "Partie endet bei":
    "Letzter zahlungsfähiger Platz, erster Konkurs oder das Erreichen eines Vermögensziels.",
  "Nettovermögensziel (Mio.)":
    "Es zählen Bargeld und Besitz abzüglich Darlehen, nicht nur der Kontostand.",
  "Eigener Zielbetrag":
    "Gib ein Vermögensziel oberhalb des Startguthabens in Millionen CHF ein.",
  Preset:
    "Übernimmt mehrere Tischregeln auf einmal. Danach lassen sie sich einzeln ändern.",
  "Startguthaben (Mio.)": "So viel Spielgeld bekommt jeder Platz zu Beginn.",
  Würfel:
    "Zwei Zahlenwürfel oder zusätzlich der Tempowürfel: 1–3 Zusatzschritte, Bus (höherer Zahlenwurf) oder nächstes freies Besitzfeld.",
  Volatilität:
    "Bestimmt, wie stark zufällige Kursänderungen auf Ereigniskarten ausfallen.",
  Zuglimit:
    "Zeit für Würfeln und Kaufen zusammen. Auktionen, Casino und Schulden haben eigene Fristen.",
  Mietniveau: "Multipliziert jede Miete, auch für Flughäfen und VC.",
  "Vollständige Branche zum Ausbau":
    "Geldstapel sind erst erlaubt, wenn dir alle unbeliehenen Firmen der Branche gehören.",
  "Gleichmässig bauen":
    "Innerhalb einer Branche darf keine Firma mehr als eine Stufe vor den anderen liegen.",
  "Ein Ausbau je Branche und Runde":
    "Pro Spielrunde darfst du in jeder Branche nur eine einzige Stufe kaufen.",
  "Fremde Kontostände verbergen":
    "Nur der eigene Kontostand ist sichtbar. Am Spielende werden alle aufgedeckt.",
  "Marktbewegung je Spielrunde":
    "Nach einer vollständigen Runde ändern sich Branchenkurse um bis zu zwei Prozent.",
  "Auktionen bei Verkauf":
    "Verkaufte Felder werden von der Bank ohne Zeitlimit versteigert, bis alle anderen gepasst haben. Ein abgelehnter Kauf löst keine Auktion aus. Mindestabstand: 1M.",
  "Bot-Übernahme bei Unterbrechung":
    "Nach 90 Sekunden ohne Verbindung kann ein Bot für den Platz entscheiden.",
  Wettbewerbsmodus:
    "Auch Gäste dürfen Abstimmungen eröffnen. Die Mehrheit der verbundenen menschlichen Plätze entscheidet.",
  Spielton: "Töne für Würfel, Schritte, Buchungen, Gefängnis, Karten im Casino, Mitteilungen und Handel. Der Browser schaltet Ton nach der ersten Interaktion frei.",
  "Bewegung & Effekte":
    "Schaltet Würfel-, Figuren- und Geldeffekte um. Das Würfelergebnis bleibt lesbar.",
  Renderqualität:
    "Weiche Schatten benötigen mehr Grafikleistung. Sparsam eignet sich für ältere Geräte.",
  "2D-Spielbrett": "Zeigt die gleichen Felder und Besitzfarben ohne 3D-Kamera.",
};
export function Help({ label }: { label: string }) {
  const [open, setOpen] = useState(false),
    text =
      hints[label] ??
      "Bestimmt die Risikoreserve und ob der Bot ausbaut oder Gegenangebote macht.";
  return (
    <span className="help">
      <button
        className="help-toggle"
        type="button"
        title={text}
        aria-label={`Hilfe: ${label}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <CircleHelp size={15} />
      </button>
      {open && (
        <span className="help-text" role="note">
          {text}
        </span>
      )}
    </span>
  );
}
function Select({
  label,
  value,
  options,
  change,
}: {
  label: string;
  value: string | number;
  options: (string | [string | number, string])[];
  change: (value: string) => void;
}) {
  return (
    <div className="setting">
      <label>
        {label}
        <select value={value} onChange={(event) => change(event.target.value)}>
          {options.map((item) => {
            const [key, text] = Array.isArray(item) ? item : [item, item];
            return (
              <option value={key} key={key}>
                {text}
              </option>
            );
          })}
        </select>
      </label>
      <Help label={label} />
    </div>
  );
}
export function Lobby({
  v,
  send,
  notice,
}: {
  v: View;
  send: Sender;
  notice: (msg: string) => void;
}) {
  const host = v.host === v.me,
    s = v.settings,
    self = v.players.find((p) => p.id === v.me)!;
  const [goal, setGoal] = useState(String(s.goal));
  const update = (delta: Partial<Settings>) =>
    send({ type: "SETTINGS", settings: { ...defaults, ...s, ...delta } });
  const bool = (
    key: "hidden" | "auto" | "auctions" | "full" | "even" | "perRound" | "takeover" | "competitive",
    text: string,
  ) => (
    <div className="setting" key={key}>
      <label className="check">
        <input
          type="checkbox"
          checked={s[key] ?? defaults[key]}
          onChange={(event) => update({ [key]: event.target.checked })}
        />
        {text}
      </label>
      <Help label={text} />
    </div>
  );
  return (
    <aside className="rail">
      <div className="rail-kicker">
        <Radio size={14} />
        {v.code ? "PRIVATER RAUM" : "LOKALES SPIEL"}
      </div>
      <h2>Deine Lobby</h2>
      {v.code && (
        <button
          className="code wide"
          title="Einladungslink kopieren"
          onClick={() =>
            navigator.clipboard
              .writeText(`${location.origin}/?raum=${v.code}`)
              .then(
                () => notice("Einladungslink kopiert."),
                () => notice(`Raumnummer: ${v.code}`),
              )
          }
        >
          {v.code}
          <Copy size={17} />
        </button>
      )}
      <div className="section-label">
        BESETZUNG <span>{v.players.length} / 6</span>
      </div>
      {v.players.map((p) => (
        <div className="person" key={p.id}>
          <Avatar token={p.token} photo={p.photo} />
          <div>
            <strong>{p.name}</strong>
            <small>
              {p.bot
                ? `Bot · ${p.bot}`
                : p.id === v.host
                  ? "Spielleitung"
                  : "Gast"}{" "}
              · {p.ready ? "Bereit" : "Nicht bereit"}
            </small>
          </div>
          {host && p.id !== v.me && (
            <button
              className="icon"
              title={`${p.name} entfernen`}
              onClick={() => send({ type: "REMOVE", seat: p.id })}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      {host && v.players.length < 6 && (
        <button
          className="subtle wide"
          onClick={() => send({ type: "BOT", level: "Mittel" })}
        >
          <Plus size={16} />
          Bot hinzufügen
        </button>
      )}
      <fieldset className="lobby-rules" disabled={!host}>
        <legend>Tischregeln{!host && " · nur die Spielleitung ändert sie"}</legend>
        <Select
          label="Preset"
          value={Object.keys(presets).find((key) => JSON.stringify({ ...defaults, ...s }) === JSON.stringify(presets[key])) ?? "Individuell"}
          options={["Individuell", ...Object.keys(presets)]}
          change={(value) => { if (presets[value]) send({ type: "SETTINGS", settings: presets[value] }); }}
        />
        <section className="rule-group">
          <h3>Partie</h3>
          <Select label="Partie endet bei" value={s.win} options={[["last", "Alle anderen bankrott"], ["first", "Erster Konkurs"], ["goal", "Nettovermögensziel"]]} change={(value) => update({ win: value as Settings["win"] })} />
          {s.win === "goal" && <>
            <Select label="Nettovermögensziel (Mio.)" value={s.goal} options={Array.from(new Set([1000, 1500, 2000, 3000, 5000, s.goal])).filter((value) => value > s.start).map((value) => [value, String(value)])} change={(value) => update({ goal: +value })} />
            <div className="setting"><label>Eigener Zielbetrag<input type="number" min={s.start + 1} value={goal} onChange={(event) => setGoal(event.target.value)} /></label><Help label="Eigener Zielbetrag" /></div>
            <button type="button" onClick={() => update({ goal: +goal })}>Ziel übernehmen</button>
          </>}
          <Select label="Startguthaben (Mio.)" value={s.start} options={[250, 500, 750, 1000].map((n) => [n, String(n)])} change={(value) => update({ start: +value })} />
          <Select label="Würfel" value={s.dice} options={[[2, "2 Zahlenwürfel"], [3, "2 Zahlenwürfel + Tempowürfel"]]} change={(value) => update({ dice: +value as 2 | 3 })} />
          <Select label="Zuglimit" value={s.limit} options={[[90, "90 Sekunden"], [120, "120 Sekunden"], [0, "Ohne Limit"]]} change={(value) => update({ limit: +value as Settings["limit"] })} />
        </section>
        <section className="rule-group">
          <h3>Wirtschaft</h3>
          <Select label="Mietniveau" value={s.rent} options={[[7500, "Entspannt · 0.75×"], [10000, "Normal · 1×"], [12500, "Hart · 1.25×"]]} change={(value) => update({ rent: +value as Settings["rent"] })} />
          <Select label="Volatilität" value={s.volatility} options={["Ruhig", "Normal", "Wild"]} change={(value) => update({ volatility: value as Settings["volatility"] })} />
          {bool("auto", "Marktbewegung je Spielrunde")}
          {bool("auctions", "Auktionen bei Verkauf")}
          {bool("hidden", "Fremde Kontostände verbergen")}
        </section>
        <section className="rule-group">
          <h3>Bauregeln</h3>
          {bool("full", "Vollständige Branche zum Ausbau")}
          {bool("even", "Gleichmässig bauen")}
          {bool("perRound", "Ein Ausbau je Branche und Runde")}
        </section>
        <section className="rule-group">
          <h3>Tisch</h3>
          {bool("takeover", "Bot-Übernahme bei Unterbrechung")}
          {bool("competitive", "Wettbewerbsmodus")}
          {v.players.filter((p) => p.bot).map((p) => <Select key={p.id} label={`Bot ${p.name}`} value={p.bot!} options={["Einfach", "Mittel", "Schwer"]} change={(value) => send({ type: "BOT", seat: p.id, level: value as Difficulty })} />)}
          {v.code && <button type="button" onClick={() => send({ type: "LOCK" })}>{v.locked ? <LockKeyhole /> : <Unlock />}{v.locked ? "Lobby entsperren" : "Lobby sperren"}</button>}
        </section>
        <p>Regeländerungen setzen die Bereitschaft zurück.</p>
      </fieldset>
      <button
        className={self.ready ? "wide" : "primary wide"}
        onClick={() => send({ type: "READY" })}
      >
        <Check size={17} />
        {self.ready ? "Bereit zurücknehmen" : "Bereit melden"}
      </button>
      {host && (
        <button
          className="primary wide"
          disabled={v.players.length < 2 || v.players.some((p) => !p.ready)}
          onClick={() => send({ type: "START" })}
        >
          <Flag size={16} />
          Partie starten
        </button>
      )}
    </aside>
  );
}
export const face = (value: number) =>
  `${["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "B", "D", "K"][value % 13]}${["♠", "♥", "♦", "♣"][Math.floor(value / 13)]}`;
export const previewSettings = defaults;

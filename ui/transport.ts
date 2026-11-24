import { get, set, del } from "idb-keyval";
import { apply, newGame, player, tick } from "../game/engine";
import { project, type View } from "../game/view";
import { actor, advance, botReadyAt } from "../game/scheduler";
import { migrateBoard, openTrade, tradeWindow, type Game, type Command } from "../game/model";
import { watchDevice, type Presence } from "./presence";
export type Mode = "local" | "create" | "join" | "resume";
export type Link = { state: "online" | "connecting" | "lost" | "closed"; attempt: number; retryAt: number };
export type Channel = { send: (cmd: Command) => void; close: () => void; activity?: (activity: "trade" | null) => void; reconnect?: () => void };
type Sink = (v: View) => void;
type Notice = (message: string) => void;
type PresenceSink = (presence: Record<string, Presence>) => void;
const localKey = "swiss-market:local:v1";
export async function connect(
  mode: Mode,
  name: string,
  token: number,
  code: string,
  sink: Sink,
  notice: Notice,
  status: Notice,
  restore = false,
  photo?: string,
  presence: PresenceSink = () => {},
  link: (state: Link) => void = () => {},
): Promise<Channel> {
  let closed = false;
  if (mode === "local") {
    let s = restore ? await get<Game>(localKey) : undefined;
    if (!s) {
      const human = player(crypto.randomUUID(), name, token);
      human.photo = photo;
      s = newGame(human);
      s = apply(s, human.id, { type: "BOT", level: "Mittel" });
    }
    let state = migrateBoard(s);
    const id = s.host;
    let timer: ReturnType<typeof setTimeout>;
    let queue = Promise.resolve();
    const save = async (next: Game) => {
      await set(localKey, next);
      state = next;
      if (closed) return;
      sink(project(state, id));
      clearTimeout(timer);
      const now = Date.now(),
        bot = actor(state, now);
      const pending = openTrade(state);
      const nextAt = state.paused
        ? 0
        : Math.min(
            pending ? pending.time + tradeWindow : state.deadline || (state.phase === "manage" ? now : Infinity),
            bot
              ? Math.max(
                  now + (["CASINO_ENTER", "CASINO_JOIN", "PLACE_CASINO_BET"].includes(bot.cmd.type) ? 450 : 800),
                  bot.cmd.type === "ROLL_DICE" ||
                    bot.cmd.type === "BUY_COMPANY" ||
                    bot.cmd.type === "DECLINE"
                    ? botReadyAt(state)
                    : 0,
                )
              : Infinity,
          );
      if (nextAt && Number.isFinite(nextAt))
        timer = setTimeout(
          () => enqueue(() => advance(state, Date.now())),
          Math.max(1, nextAt - Date.now()),
        );
    };
    const enqueue = (fn: () => Game) => {
      queue = queue
        .then(async () => {
          if (!closed) await save(fn());
        })
        .catch((error) => notice(error.message));
    };
    await save(state);
    localStorage.setItem("sm-mode", "local");
    status("Lokal");
    const stopDevice = watchDevice((info) => presence({ [id]: { ...info, rtt: null } }));
    return {
      send: (cmd) =>
        enqueue(() => {
          const updated = tick(state, Date.now());
          return updated !== state ? updated : apply(state, id, cmd);
        }),
      close: () => {
        closed = true;
        clearTimeout(timer);
        stopDevice();
      },
    };
  }
  const remembered = JSON.parse(localStorage.getItem("sm-online") ?? "{}");
  const response = await fetch(`/api/${mode}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      token,
      code: mode === "resume" ? remembered.code : code,
      game: remembered.game,
      photo,
    }),
  });
  if (!response.ok)
    throw Error(
      response.status === 403
        ? "Beitritt nicht möglich. Code, freie Figur und Lobby prüfen."
        : response.status === 429
          ? "Zu viele Versuche. Bitte kurz warten."
          : "Online-Dienst nicht erreichbar. Lokal gegen Bots ist ohne Cloud verfügbar.",
    );
  const info = await response.json();
  if (
    !info ||
    typeof info !== "object" ||
    !("code" in info) ||
    typeof info.code !== "string" ||
    !/^\d{6}$/.test(info.code) ||
    !("game" in info) ||
    typeof info.game !== "string"
  )
    throw Error("Ungültige Raumantwort");
  localStorage.setItem("sm-online", JSON.stringify(info));
  localStorage.setItem("sm-mode", "online");
  let socket: WebSocket,
    latest: View | undefined,
    retries = 0,
    timer: ReturnType<typeof setTimeout>,
    rtt: number | null = null,
    activity: "trade" | null = null,
    heard = Date.now(),
    device: Omit<Presence, "rtt"> | undefined;
  const report = () => {
    if (device && socket?.readyState === 1) socket.send(JSON.stringify({ presence: { ...device, rtt, activity } }));
  };
  const stopDevice = watchDevice((info) => {
    device = info;
    report();
  });
  let pulses = 0;
  const pinger = setInterval(() => {
    if (socket?.readyState !== 1) return;
    // Ohne Antwort auf mehrere Pings gilt die Verbindung als tot, auch wenn der Browser sie noch offen hält.
    if (Date.now() - heard > 13000) {
      drop();
      return;
    }
    socket.send(JSON.stringify({ ping: performance.now() }));
    if (++pulses % 4 === 0) report();
  }, 4000);
  const lost = () => {
    if (closed) return;
    clearTimeout(timer);
    const wait = Math.min(15000, 600 * 2 ** retries++);
    status("Verbindung unterbrochen");
    link({ state: "lost", attempt: retries, retryAt: Date.now() + wait });
    timer = setTimeout(open, wait);
  };
  const drop = () => {
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
    lost();
  };
  const open = () => {
    if (closed) return;
    clearTimeout(timer);
    status(retries ? "Verbindung wird wiederhergestellt" : "Verbinden");
    link({ state: "connecting", attempt: retries, retryAt: 0 });
    const previous = socket;
    if (previous) previous.onclose = null;
    previous?.close();
    socket = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/socket?code=${info.code}&game=${info.game}`,
    );
    socket.onopen = () => {
      heard = Date.now();
      socket.send(JSON.stringify({ ping: performance.now() }));
      report();
    };
    socket.onmessage = (event) => {
      heard = Date.now();
      const packet = JSON.parse(event.data);
      if (typeof packet.pong === "number") {
        const measured = performance.now() - packet.pong;
        const first = rtt === null;
        rtt = Math.round(first ? measured : rtt! * 0.6 + measured * 0.4);
        if (first) report();
        return;
      }
      if (packet.presence && typeof packet.presence === "object") presence(packet.presence);
      if (packet.view) {
        const clockOffset =
          typeof packet.serverTime === "number"
            ? Date.now() - packet.serverTime
            : 0;
        latest = {
          ...packet.view,
          clockOffset,
          tradeUntil: packet.view.tradeUntil ? packet.view.tradeUntil + clockOffset : 0,
          deadline: packet.view.deadline
            ? packet.view.deadline + clockOffset
            : 0,
        } as View;
        sink(latest);
        status("Online");
        link({ state: "online", attempt: 0, retryAt: 0 });
        retries = 0;
      }
      if (packet.error) notice(packet.error);
    };
    socket.onclose = (event) => {
      if (closed) return;
      if (event.code === 1008) {
        notice("Dieser Platz ist nicht mehr verfügbar.");
        status("Getrennt");
        link({ state: "closed", attempt: retries, retryAt: 0 });
        return;
      }
      lost();
    };
  };
  const offline = () => drop();
  const online = () => {
    if (socket?.readyState !== 1) {
      retries = Math.max(retries, 1);
      open();
    }
  };
  window.addEventListener("offline", offline);
  window.addEventListener("online", online);
  open();
  return {
    send: (cmd) => {
      if (!latest || socket.readyState !== 1) {
        notice("Keine Verbindung. Bitte erneut versuchen.");
        return;
      }
      socket.send(
        JSON.stringify({
          cmd,
          version: latest.version,
          epoch: latest.epoch,
          actionId: crypto.randomUUID(),
        }),
      );
    },
    close: () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(pinger);
      stopDevice();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      socket?.close();
    },
    activity: (next) => {
      if (next === activity) return;
      activity = next;
      report();
    },
    reconnect: () => {
      retries = Math.max(retries, 1);
      open();
    },
  };
}
export async function forget() {
  localStorage.removeItem("sm-mode");
  localStorage.removeItem("sm-online");
  await del(localKey);
}

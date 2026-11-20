import { get, set, del } from "idb-keyval";
import { apply, newGame, player, tick } from "../game/engine";
import { project, type View } from "../game/view";
import { actor, advance, botReadyAt } from "../game/scheduler";
import { migrateBoard, openTrade, tradeWindow, type Game, type Command } from "../game/model";
import { watchDevice, type Presence } from "./presence";
export type Mode = "local" | "create" | "join" | "resume";
export type Channel = { send: (cmd: Command) => void; close: () => void; activity?: (activity: "trade" | null) => void };
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
                  now + (["CASINO_ENTER", "CASINO_JOIN", "PLACE_CASINO_BET"].includes(bot.cmd.type) ? 450 : 1100),
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
    socket.send(JSON.stringify({ ping: performance.now() }));
    if (++pulses % 4 === 0) report();
  }, 4000);
  const open = () => {
    if (closed) return;
    status(retries ? "Verbindung wird wiederhergestellt" : "Verbinden");
    socket = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/socket?code=${info.code}&game=${info.game}`,
    );
    socket.onopen = () => {
      socket.send(JSON.stringify({ ping: performance.now() }));
      report();
    };
    socket.onmessage = (event) => {
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
        retries = 0;
      }
      if (packet.error) notice(packet.error);
    };
    socket.onclose = (event) => {
      if (closed) return;
      if (event.code === 1008) {
        notice("Dieser Platz ist nicht mehr verfügbar.");
        status("Getrennt");
        return;
      }
      status("Verbindung unterbrochen");
      timer = setTimeout(open, Math.min(15000, 600 * 2 ** retries++));
    };
  };
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
      socket?.close();
    },
    activity: (next) => {
      if (next === activity) return;
      activity = next;
      report();
    },
  };
}
export async function forget() {
  localStorage.removeItem("sm-mode");
  localStorage.removeItem("sm-online");
  await del(localKey);
}

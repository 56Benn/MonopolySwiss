import { botReadyAt } from "../game/scheduler.ts";
import { migrateBoard, openTrade, tradeWindow } from "../game/model.ts";
import { validPortrait } from "../game/portrait.ts";
import { DurableObject } from "cloudflare:workers";
import {
  apply,
  tick,
  newGame,
  player,
  resume,
  suspend,
} from "../game/engine.ts";
import { project } from "../game/view.ts";
import { advance, actor } from "../game/scheduler.ts";
import { secure } from "../game/casino.ts";
import type { Game } from "../game/model.ts";
import { envelope } from "./protocol.ts";
interface Env {
  ROOMS: DurableObjectNamespace<MarketRoom>;
  ASSETS: Fetcher;
}
type Stored = {
  s: Game;
  sessions: Record<string, string>;
  seen: Record<string, string[]>;
  last: number;
  botAt: number;
  finished?: number;
  rates: Record<string, { time: number; count: number }>;
};
type Presence = { device: "mobile" | "desktop"; battery: number | null; charging: boolean | null; rtt: number | null; activity: "trade" | null };
type Attachment = {
  id: string;
  game: string;
  rate?: { since: number; count: number };
  presence?: Presence;
};
export function readPresence(input: unknown): Presence | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const unit = (item: unknown) => item === null || (typeof item === "number" && item >= 0 && item <= 1);
  if (
    (value.device !== "mobile" && value.device !== "desktop") ||
    !unit(value.battery) ||
    (value.charging !== null && typeof value.charging !== "boolean") ||
    (value.rtt !== null && (typeof value.rtt !== "number" || !Number.isFinite(value.rtt) || value.rtt < 0 || value.rtt > 60000)) ||
    (value.activity !== undefined && value.activity !== null && value.activity !== "trade")
  )
    return null;
  return {
    device: value.device,
    battery: value.battery === null ? null : Math.round((value.battery as number) * 100) / 100,
    charging: value.charging as boolean | null,
    rtt: value.rtt === null ? null : Math.round(value.rtt as number),
    activity: value.activity === "trade" ? "trade" : null,
  };
}
const fail = (status = 400, message = "Raum oder Aktion nicht verfügbar") =>
  Response.json({ error: message }, { status });
const codePattern = /^\d{6}$/;
export const makeCode = () => String(secure(1_000_000)).padStart(6, "0");
const err = (error: unknown) =>
  error instanceof Error ? error.message : "Anfrage fehlgeschlagen";
const hash = async (text: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    if (req.headers.get("Origin") !== url.origin) return fail(403);
    const ws =
      url.pathname === "/api/socket" &&
      req.headers.get("Upgrade")?.toLowerCase() === "websocket";
    if (!ws && req.method !== "POST") return fail(405);
    const existing = req.headers
      .get("Cookie")
      ?.match(/(?:^|;\s*)sm_guest=([\da-f-]{36}\.[\da-f-]{36})(?:;|$)/)?.[1];
    const secret = existing ?? `${crypto.randomUUID()}.${crypto.randomUUID()}`;
    const identity = await hash(secret);
    const address = await hash(
      req.headers.get("CF-Connecting-IP") ?? "development",
    );
    const limit = env.ROOMS.getByName(`limit:${address}`);
    if (!(await limit.allow()))
      return fail(429, "Zu viele Anfragen. Bitte kurz warten.");
    const headers = new Headers({
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    if (!existing)
      headers.set(
        "set-cookie",
        `sm_guest=${secret}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${url.protocol === "https:" ? "; Secure" : ""}`,
      );
    try {
      if (ws) {
        const code = url.searchParams.get("code") ?? "";
        if (!existing || !codePattern.test(code)) return fail(403);
        return env.ROOMS.getByName(`room:${code}`).fetch(
          new Request(
            `https://room/socket?game=${encodeURIComponent(url.searchParams.get("game") ?? "")}`,
            { headers: { Upgrade: "websocket", "X-Session": identity } },
          ),
        );
      }
      const raw = await req.text();
      if (raw.length > 10240) return fail(413);
      const body = JSON.parse(raw);
      if (body.photo !== undefined && !validPortrait(body.photo)) return fail();
      if (!["/api/create", "/api/join", "/api/resume"].includes(url.pathname))
        return fail(404);
      if (
        url.pathname !== "/api/resume" &&
        (typeof body.name !== "string" ||
          !body.name.trim() ||
          body.name.trim().length > 22 ||
          !Number.isInteger(body.token) ||
          body.token < 0 ||
          body.token > 5)
      )
        return fail();
      const create = url.pathname === "/api/create";
      for (let attempt = 0; attempt < (create ? 8 : 1); attempt++) {
        const code = create ? makeCode() : body.code;
        if (typeof code !== "string" || !codePattern.test(code)) return fail();
        const result = await env.ROOMS.getByName(`room:${code}`).enter(
          identity,
          code,
          create,
          body.name?.trim(),
          body.token,
          url.pathname === "/api/resume" ? String(body.game) : "",
          body.photo,
        );
        if (result === "collision") continue;
        if (!result) return fail(403);
        return new Response(JSON.stringify(result), { headers });
      }
      return fail(503);
    } catch {
      return fail();
    }
  },
} satisfies ExportedHandler<Env>;
export class MarketRoom extends DurableObject<Env> {
  private async load(){const data=await this.ctx.storage.get<Stored>("room");if(data)migrateBoard(data.s);return data;}
  private transaction<T>(work: () => Promise<T>) {
    return this.ctx.blockConcurrencyWhile(work);
  }
  async allow() {
    return this.transaction(async () => {
      const now = Date.now();
      let bucket = await this.ctx.storage.get<{ time: number; count: number }>(
        "limit",
      );
      if (!bucket || now - bucket.time >= 60000)
        bucket = { time: now, count: 0 };
      if (bucket.count >= 45) return false;
      bucket.count++;
      await this.ctx.storage.put("limit", bucket);
      await this.ctx.storage.setAlarm(bucket.time + 60000);
      return true;
    });
  }
  private async save(data: Stored, now: number) {
    const s = data.s;
    if (s.phase === "over") data.finished ??= now;
    const bot = !s.paused && actor(s, now);
    const quick = bot && ["CASINO_ENTER", "CASINO_JOIN", "PLACE_CASINO_BET"].includes(bot.cmd.type);
    data.botAt = bot ? (data.botAt > now ? data.botAt : now + (quick ? 450 : 800)) : 0;
    if (bot && ["ROLL_DICE", "BUY_COMPANY", "DECLINE"].includes(bot.cmd.type))
      data.botAt = Math.max(data.botAt, botReadyAt(s));
    const due = [
      (data.finished ?? data.last) +
        (s.phase === "over" ? 168 : s.phase === "lobby" ? 24 : 72) * 3600000,
    ];
    if (s.phase !== "over" && s.phase !== "lobby" && !s.paused) {
      const pending = openTrade(s);
      if (pending) due.push(pending.time + tradeWindow);
      else if (s.deadline) due.push(s.deadline);
      else if (s.phase === "manage") due.push(now + 1);
      if (data.botAt) due.push(data.botAt);
      for (const p of s.players)
        if (!p.bot && !p.online && p.away + 90000 > now)
          due.push(p.away + 90000);
    }
    await this.ctx.storage.transaction(async (tx) => {
      await tx.put("room", data);
      await tx.setAlarm(Math.max(now + 1, Math.min(...due)));
    });
  }
  async enter(
    session: string,
    code: string,
    create: boolean,
    name: string,
    token: number,
    game: string,
    photo?: string,
  ) {
    return this.transaction(async () => {
      let data = await this.load();
      if (data && create) return "collision";
      if (!data && !create) return null;
      const now = Date.now();
      if (!data) {
        const host = player(crypto.randomUUID(), name, token);
        host.photo = photo;
        host.online = false;
        host.away = now;
        data = {
          s: newGame(host, code),
          sessions: { [session]: host.id },
          seen: {},
          last: now,
          botAt: 0,
          rates: {},
        };
      } else if (game && game !== data.s.id) return null;
      else if (!data.sessions[session]) {
        if (
          game ||
          data.s.locked ||
          data.s.phase !== "lobby" ||
          data.s.players.length >= 6 ||
          data.s.players.some((p) => p.token === token)
        )
          return null;
        const guest = player(crypto.randomUUID(), name, token);
        guest.photo = photo;
        guest.online = false;
        guest.away = now;
        data.s.players.push(guest);
        data.s.players.forEach((other) => {
          if (!other.bot) other.ready = false;
        });
        data.sessions[session] = guest.id;
        data.s.version++;
      }
      const me = data.sessions[session];
      if (!data.s.players.some((p) => p.id === me)) return null;
      data.last = now;
      await this.save(data, now);
      this.broadcast(data);
      return { code, game: data.s.id, me };
    });
  }
  async fetch(req: Request) {
    return this.transaction(async () => {
      const data = await this.load(),
        session = req.headers.get("X-Session") ?? "",
        id = data?.sessions[session],
        p = data?.s.players.find((other) => other.id === id);
      if (
        !data ||
        !p ||
        new URL(req.url).searchParams.get("game") !== data.s.id
      )
        return fail(403);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ id: p.id, game: data.s.id });
      p.online = true;
      p.away = 0;
      if (!data.s.players.find((other) => other.id === data.s.host)?.online)
        data.s.host = p.id;
      const now = Date.now();
      if (data.s.resumeAt) {
        resume(data.s, now);
      }
      data.last = now;
      await this.save(data, now);
      this.broadcast(data);
      return new Response(null, { status: 101, webSocket: pair[0] });
    });
  }
  private broadcast(data: Stored) {
    for (const socket of this.ctx.getWebSockets()) {
      const att = socket.deserializeAttachment() as Attachment;
      try {
        if (
          att.game !== data.s.id ||
          !data.s.players.some((p) => p.id === att.id)
        ) {
          socket.close(1008, "Platz entfernt");
          continue;
        }
        socket.send(
          JSON.stringify({
            view: project(data.s, att.id),
            serverTime: Date.now(),
          }),
        );
      } catch {
        socket.close(1011, "Verbindung unterbrochen");
      }
    }
  }
  private broadcastPresence(game: string) {
    const sockets = this.ctx.getWebSockets().filter((socket) => socket.readyState === 1);
    const presence: Record<string, Presence> = {};
    for (const socket of sockets) {
      const att = socket.deserializeAttachment() as Attachment;
      if (att.game === game && att.presence) presence[att.id] = att.presence;
    }
    for (const socket of sockets)
      if ((socket.deserializeAttachment() as Attachment).game === game)
        try { socket.send(JSON.stringify({ presence })); } catch { /* Verbindung bereits geschlossen */ }
  }
  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    await this.transaction(async () => {
      try {
        const now = Date.now(),
          att = socket.deserializeAttachment() as Attachment;
        if (!att.rate || now - att.rate.since >= 10000)
          att.rate = { since: now, count: 0 };
        if (att.rate.count >= 35) throw Error("Zu viele Aktionen");
        att.rate.count++;
        socket.serializeAttachment(att);
        if (typeof message !== "string" || message.length > 8192)
          throw Error("Nachricht zu gross");
        const raw = JSON.parse(message);
        if (raw && typeof raw === "object" && "ping" in raw) {
          if (typeof raw.ping === "number") socket.send(JSON.stringify({ pong: raw.ping }));
          return;
        }
        if (raw && typeof raw === "object" && "presence" in raw) {
          const presence = readPresence(raw.presence);
          if (!presence) throw Error("Ungültige Geräteangaben");
          socket.serializeAttachment({ ...att, presence });
          this.broadcastPresence(att.game);
          return;
        }
        const data = await this.load();
        if (!data || data.s.id !== att.game) throw Error("Raum geschlossen");
        const packet = envelope.safeParse(raw);
        if (!packet.success) throw Error("Ungültige Spielabsicht");
        const { actionId, epoch, version, cmd } = packet.data;
        const id = att.id,
          seen = data.seen[id] ?? [];
        if (seen.includes(actionId)) {
          socket.send(
            JSON.stringify({
              ack: actionId,
              view: project(data.s, id),
              serverTime: Date.now(),
            }),
          );
          return;
        }
        const bucket = data.rates[id];
        if (!bucket || now - bucket.time >= 10000)
          data.rates[id] = { time: now, count: 1 };
        else if (++bucket.count > 35) throw Error("Zu viele Aktionen");
        const advanced = tick(data.s, now);
        if (advanced !== data.s) {
          data.s = advanced;
          await this.save(data, now);
          this.broadcast(data);
        }
        if (
          cmd.type !== "CHAT" &&
          (data.s.phase === "lobby"
            ? version !== data.s.version
            : epoch !== data.s.epoch &&
              !["PROPOSE_TRADE", "TRADE", "VOTE", "RESUME", "RESIGN"].includes(cmd.type))
        )
          throw Error("Entscheidung abgelaufen. Bitte erneut prüfen.");
        data.s = apply(data.s, id, cmd, now);
        if (cmd.type === "REMOVE") {
          data.sessions = Object.fromEntries(
            Object.entries(data.sessions).filter(
              ([, seat]) => seat !== cmd.seat,
            ),
          );
          delete data.seen[cmd.seat];
          delete data.rates[cmd.seat];
        }
        data.seen[id] = [...seen, actionId].slice(-128);
        data.last = now;
        await this.save(data, now);
        this.broadcast(data);
        socket.send(JSON.stringify({ ack: actionId }));
      } catch (error) {
        socket.send(JSON.stringify({ error: err(error) }));
      }
    });
  }
  async webSocketClose(socket: WebSocket) {
    await this.transaction(async () => {
      const data = await this.load(),
        att = socket.deserializeAttachment() as Attachment;
      if (
        !data ||
        data.s.id !== att.game ||
        this.ctx
          .getWebSockets()
          .some(
            (other) =>
              other !== socket &&
              other.readyState === 1 &&
              (other.deserializeAttachment() as Attachment).id === att.id,
          )
      )
        return;
      const p = data.s.players.find((other) => other.id === att.id);
      if (!p) return;
      const now = Date.now();
      p.online = false;
      p.away = now;
      if (data.s.host === p.id)
        data.s.host =
          data.s.players.find((other) => other.online && !other.bot)?.id ??
          p.id;
      data.last = now;
      await this.save(data, now);
      this.broadcast(data);
      this.broadcastPresence(att.game);
    });
  }
  async webSocketError(socket: WebSocket) {
    await this.webSocketClose(socket);
  }
  async alarm() {
    await this.transaction(async () => {
      const data = await this.load();
      if (!data) {
        await this.ctx.storage.deleteAll();
        return;
      }
      const now = Date.now(),
        s = data.s;
      const connected = new Set(
        this.ctx
          .getWebSockets()
          .filter((ws) => ws.readyState === 1)
          .map((ws) => (ws.deserializeAttachment() as Attachment).id),
      );
      for (const person of s.players) {
        if (!person.bot && person.online && !connected.has(person.id)) {
          person.online = false;
          person.away = now;
          data.last = now;
        }
      }
      const live = s.players.some((p) => !p.bot && p.online);
      if (
        (s.phase === "over" || !live) &&
        now - (data.finished ?? data.last) >=
          (s.phase === "over" ? 168 : s.phase === "lobby" ? 24 : 72) * 3600000
      ) {
        for (const ws of this.ctx.getWebSockets())
          ws.close(1001, "Raum beendet");
        await this.ctx.storage.deleteAll();
        return;
      }
      if (
        !live &&
        !s.paused &&
        s.phase !== "lobby" &&
        s.phase !== "over" &&
        s.players.filter((p) => !p.bot).every((p) => now - p.away >= 90000)
      ) {
        suspend(s, now);
        s.resumeAt = now;
      } else if (!s.paused) {
        data.s =
          data.botAt && data.botAt <= now ? advance(s, now) : tick(s, now);
      }
      if (live && s.phase !== "over") data.last = now;
      await this.save(data, now);
      this.broadcast(data);
    });
  }
}

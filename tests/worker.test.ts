import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { newGame, player } from "../game/model.ts";
import { M } from "../game/board.ts";
import type { View } from "../game/view.ts";
test(
  "SQLite-Neustart: Raum 012345, Gastbindung, persistenter Auktionsalarm und Deduplizierung",
  { timeout: 30000 },
  async () => {
    const path = await mkdtemp(join(tmpdir(), "swiss-market-test-")),
      origin = "http://market.test",
      code = "012345",
      host = player(crypto.randomUUID(), "Anna", 0),
      other = player(crypto.randomUUID(), "Lara", 1);
    host.cash = other.cash = 500 * M;
    const state = newGame(host, code);
    state.players.push(other);
    state.phase = "auction";
    state.auction = {
      tile: 1,
      bid: M,
      leader: host.id,
      max: Date.now() + 45000,
      queue: [],
    };
    state.deadline = Date.now() + 4500;
    state.round = 1;
    const session = `${crypto.randomUUID()}.${crypto.randomUUID()}`,
      sessionHash = Buffer.from(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(session),
        ),
      ).toString("hex");
    const source = `import main,{MarketRoom as Base} from './server/worker.ts';export default main;export class MarketRoom extends Base {async fixture(data){await this.ctx.storage.put('room',data);await this.ctx.storage.setAlarm(data.s.deadline)} async snapshot(){return await this.ctx.storage.get('room')}}`;
    const bundle = await build({
      stdin: { contents: source, resolveDir: process.cwd() },
      bundle: true,
      format: "esm",
      platform: "browser",
      external: ["cloudflare:workers"],
      write: false,
    });
    const start = () =>
      new Miniflare(
        convertV4MiniflareOptions({
          name: "market-test",
          modules: true,
          script: bundle.outputFiles[0].text,
          compatibilityDate: "2025-10-01",
          durableObjects: {
            ROOMS: { className: "MarketRoom", useSQLite: true },
          },
          resourcePersistencePath: path,
        }),
      );
    let mf = start();
    type Harness = {
      fixture: (data: unknown) => Promise<void>;
      snapshot: () => Promise<{ s: typeof state }>;
    };
    const room = async () => {
      const ns = await mf.getDurableObjectNamespace("ROOMS");
      return ns.get(ns.idFromName("room:" + code)) as unknown as Harness;
    };
    try {
      await (
        await room()
      ).fixture({
        s: state,
        seen: {},
        rates: {},
        sessions: { [sessionHash]: host.id },
        last: Date.now(),
        botAt: 0,
      });
      await mf.dispose();
      mf = start();
      const url = `${origin}/api/socket?code=${code}&game=${state.id}`,
        headers = {
          Origin: origin,
          Cookie: `sm_guest=${session}`,
          Upgrade: "websocket",
        };
      const stranger = await mf.dispatchFetch(`${origin}/api/resume`, {
        method: "POST",
        headers: { Origin: origin },
        body: JSON.stringify({ code, game: state.id, name: "Anna", token: 0 }),
      });
      assert.equal(stranger.status, 403);
      const res = await mf.dispatchFetch(url, { headers });
      assert.equal(res.status, 101);
      const socket = res.webSocket!;
      type Packet = { view?: View; ack?: string; error?: string };
      const messages: Packet[] = [];
      let signal = () => {};
      socket.addEventListener("message", (event) => {
        messages.push(JSON.parse(String(event.data)));
        signal();
      });
      socket.accept();
      const wait = async (predicate: (packet: Packet) => boolean) => {
        const timeout = AbortSignal.timeout(10000);
        while (!messages.some(predicate)) {
          await new Promise<void>((resolve, reject) => {
            const abort = () => reject(Error("Keine Worker-Antwort"));
            signal = () => {
              timeout.removeEventListener("abort", abort);
              resolve();
            };
            timeout.addEventListener("abort", abort, { once: true });
            if (timeout.aborted) abort();
          });
        }
        return messages.find(predicate)!;
      };
      const result = await wait((packet) => packet.view?.phase === "manage");
      assert.equal(result.view!.own.cash, 499 * M);
      assert.equal(result.view!.assets[1].owner, host.id);
      const following = await wait(
        (msg) => msg.view?.phase === "roll" && msg.view.turn === 1,
      );
      const actionId = crypto.randomUUID(),
        packet = JSON.stringify({
          actionId,
          epoch: following.view!.epoch,
          version: following.view!.version,
          cmd: { type: "CHAT", text: "Auktion beendet" },
        });
      socket.send(packet);
      await wait((msg) => msg.ack === actionId);
      messages.length = 0;
      socket.send(packet);
      const duplicate = await wait((msg) => msg.ack === actionId);
      assert.equal(duplicate.view!.turn, 1);
      assert.equal(duplicate.view!.chat.length, 1);
      assert.equal(duplicate.view!.own.cash, 499 * M);
      socket.close(1000);
      assert.equal((await (await room()).snapshot()).s.round, 1);
    } finally {
      await mf.dispose();
      await rm(path, { recursive: true, force: true });
    }
  },
);

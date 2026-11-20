import { z } from "zod";
import type { Command } from "../game/model.ts";
const amount = z.int().nonnegative();
const seat = z.string().uuid();
const tile = z.int().min(0).max(39);
const bundle = z.strictObject({
  cash: amount,
  assets: z.array(tile).max(28),
  cards: z.array(z.enum(["C19", "C20", "C21", "C22"])).max(4),
});
const settings = z.strictObject({
  start: z.literal([250, 500, 750, 1000]),
  dice: z.literal([2, 3]),
  win: z.enum(["last", "first", "goal"]),
  goal: z.int().positive().max(1000000),
  hidden: z.boolean(),
  volatility: z.enum(["Ruhig", "Normal", "Wild"]),
  auto: z.boolean(),
  auctions: z.boolean(),
  limit: z.literal([0, 90, 120]),
  rent: z.literal([7500, 10000, 12500]),
  full: z.boolean(),
  even: z.boolean(),
  perRound: z.boolean(),
  takeover: z.boolean(),
  competitive: z.boolean(),
});
const command: z.ZodType<Command> = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.enum([
      "READY",
      "START",
      "ROLL_DICE",
      "DECLINE",
      "CONFIRM_PAYMENT",
      "PASS_BID",
      "BAIL",
      "LAWYER",
      "JAIL_WAIT",
      "BLACKJACK_HIT",
      "BLACKJACK_STAND",
      "BLACKJACK_DOUBLE",
      "BLACKJACK_SPLIT",
      "CASINO_ENTER",
      "CASINO_SKIP",
      "RESIGN",
      "LOCK",
      "RESUME",
    ]),
  }),
  z.strictObject({ type: z.literal("CASINO_JOIN"), yes: z.boolean() }),
  z.strictObject({ type: z.literal("BUS_CHOOSE"), steps: z.int().min(1).max(12) }),
  z.strictObject({
    type: z.literal("BOT"),
    level: z.enum(["Einfach", "Mittel", "Schwer"]),
    seat: seat.optional(),
  }),
  z.strictObject({ type: z.literal("REMOVE"), seat }),
  z.strictObject({ type: z.literal("SETTINGS"), settings }),
  z.strictObject({ type: z.literal("VOTE"), issue: z.enum(["pause", "quit"]) }),
  z.strictObject({
    type: z.literal("CHAT"),
    text: z.string().trim().min(1).max(300),
    to: seat.optional(),
  }),
  z.strictObject({
    type: z.literal("BUY_COMPANY"),
    coupon: z.boolean().optional(),
  }),
  z.strictObject({ type: z.literal("BID"), amount }),
  z.strictObject({
    type: z.literal("ASSET"),
    tile,
    op: z.enum(["build", "reduce", "loan", "repay", "sell"]),
  }),
  z.strictObject({ type: z.literal("REACT"), yes: z.boolean() }),
  z.strictObject({
    type: z.literal("PLACE_CASINO_BET"),
    amount: amount.nullable(),
  }),
  z.strictObject({
    type: z.literal("PROPOSE_TRADE"),
    to: seat,
    give: bundle,
    want: bundle,
  }),
  z.strictObject({
    type: z.literal("TRADE"),
    id: seat,
    op: z.enum(["accept", "reject", "withdraw"]),
  }),
]);
export const envelope = z.strictObject({
  actionId: z.string().uuid(),
  epoch: amount,
  version: amount,
  cmd: command,
});

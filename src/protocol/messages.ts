import { z } from 'zod';

/**
 * Message schemas and envelope for the Host↔Guest wire protocol. Every message type below
 * has exactly one zod schema, and every exported type is derived from that schema via
 * `z.infer` — there is no hand-written `type` or `interface` duplicating a schema's shape.
 */

const publicBetSchema = z.object({
  playerId: z.string(),
});

const privateBetSchema = z.object({
  playerId: z.string(),
  amount: z.number(),
  prediction: z.enum(['YES', 'NO']),
});

const payoutSchema = z.object({
  playerId: z.string(),
  amount: z.number(),
});

const roundStateSchema = z.object({
  activePlayerId: z.string(),
  challengeId: z.string(),
  /** Public broadcast state: only whether a player has already bet, never the amount/prediction. */
  bets: z.array(publicBetSchema),
  outcome: z.enum(['YES', 'NO']).nullable(),
});

const resolutionStateSchema = z.object({
  activePlayerId: z.string(),
  outcome: z.enum(['YES', 'NO']),
  payouts: z.array(payoutSchema),
});

const playerSchema = z.object({
  playerId: z.string(),
  name: z.string(),
  points: z.number(),
  status: z.enum(['active', 'paused', 'removed']),
  connected: z.boolean(),
});

const gameStateSchema = z.object({
  roomId: z.string(),
  /** `lobby`: pre-game, broadcast on every join/rejoin/leave/disconnect (see round-engine spec 21). */
  status: z.enum(['lobby', 'active', 'ended']),
  activePlayerId: z.string().nullable(),
  players: z.array(playerSchema),
  round: roundStateSchema.nullable(),
  resolution: resolutionStateSchema.nullable(),
});

export type Prediction = z.infer<typeof privateBetSchema.shape.prediction>;
export type Bet = z.infer<typeof publicBetSchema>;
export type PrivateBet = z.infer<typeof privateBetSchema>;
export type Payout = z.infer<typeof payoutSchema>;
export type RoundState = z.infer<typeof roundStateSchema>;
export type ResolutionState = z.infer<typeof resolutionStateSchema>;
export type Player = z.infer<typeof playerSchema>;
export type GameState = z.infer<typeof gameStateSchema>;

// Guest → Host message schemas — no `seq`, per the envelope rules.

const joinMessageSchema = z.object({
  type: z.literal('join'),
  payload: z.object({ name: z.string() }),
});

const rejoinMessageSchema = z.object({
  type: z.literal('rejoin'),
  payload: z.object({ reconnectToken: z.string() }),
});

const placeBetMessageSchema = z.object({
  type: z.literal('placeBet'),
  payload: z.object({ amount: z.number(), prediction: z.enum(['YES', 'NO']) }),
});

const leaveMessageSchema = z.object({
  type: z.literal('leave'),
  payload: z.object({}),
});

// Host → Guest message schemas — every message carries `seq`.

const welcomeMessageSchema = z.object({
  type: z.literal('welcome'),
  seq: z.number(),
  payload: z.object({ playerId: z.string(), reconnectToken: z.string() }),
});

const rejectedMessageSchema = z.object({
  type: z.literal('rejected'),
  seq: z.number(),
  payload: z.object({ reason: z.string(), action: z.string() }),
});

const stateMessageSchema = z.object({
  type: z.literal('state'),
  seq: z.number(),
  payload: gameStateSchema,
});

export type JoinMessage = z.infer<typeof joinMessageSchema>;
export type RejoinMessage = z.infer<typeof rejoinMessageSchema>;
export type PlaceBetMessage = z.infer<typeof placeBetMessageSchema>;
export type PlaceBetPayload = PlaceBetMessage['payload'];
export type LeaveMessage = z.infer<typeof leaveMessageSchema>;
export type WelcomeMessage = z.infer<typeof welcomeMessageSchema>;
export type RejectedMessage = z.infer<typeof rejectedMessageSchema>;
export type StateMessage = z.infer<typeof stateMessageSchema>;

const guestToHostMessageSchema = z.discriminatedUnion('type', [
  joinMessageSchema,
  rejoinMessageSchema,
  placeBetMessageSchema,
  leaveMessageSchema,
]);

const hostToGuestMessageSchema = z.discriminatedUnion('type', [
  welcomeMessageSchema,
  rejectedMessageSchema,
  stateMessageSchema,
]);

export type GuestToHostMessage = z.infer<typeof guestToHostMessageSchema>;
export type HostToGuestMessage = z.infer<typeof hostToGuestMessageSchema>;

/** Parses a raw incoming Guest→Host payload, or `undefined` if it doesn't match the catalog. */
export function parseGuestToHostMessage(raw: unknown): GuestToHostMessage | undefined {
  const result = guestToHostMessageSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

/** Parses a raw incoming Host→Guest payload, or `undefined` if it doesn't match the catalog. */
export function parseHostToGuestMessage(raw: unknown): HostToGuestMessage | undefined {
  const result = hostToGuestMessageSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

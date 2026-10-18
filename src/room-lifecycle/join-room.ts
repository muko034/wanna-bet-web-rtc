import { GuestProtocol } from '../protocol/guest-protocol';
import type { GameState } from '../protocol/messages';
import { PeerUnavailableError, type Transport } from '../transport/transport';
import { isBetRejection, type BetRejection } from '../round-engine/round-engine';
import type { RoomRegistry } from './room-registry';
import { withBase } from '../base-path';

export type JoinResult =
  | { status: 'joined'; playerId: string; reconnectToken: string }
  | { status: 'invalid-room' }
  | { status: 'unreachable' }
  | { status: 'room-full' }
  | { status: 'join-declined' };

export type RejoinResult =
  | { status: 'joined'; playerId: string; reconnectToken: string }
  | { status: 'invalid-room' }
  | { status: 'unreachable' }
  | { status: 'unknown-player' };

/**
 * How long `connectAndSend` waits for `transport.connect()` to settle (or, for a `rejoin`, for
 * the reply to follow) before treating the
 * Host as unreachable. A real WebRTC connection attempt that gets no response at all (the
 * Host is gone without cleanly deregistering, a network partition) never rejects on its
 * own — there is no PeerJS error event for "nothing answered" — so without this timeout the
 * returned promise would hang forever instead of resolving `unreachable`.
 */
const CONNECT_TIMEOUT_MS = 8_000;

/** How long a Guest tolerates hearing nothing from the Host (three missed heartbeats) before treating the link as lost. */
export const HOST_SILENCE_TIMEOUT_MS = 9_000;

type ConnectHooks = {
  /** With `false`, the timeout bounds only opening the connection, not the Host's reply. */
  replyTimeout?: boolean;
  /** Runs right after the request left. */
  onSent?: () => void;
  /** Runs the moment the Host's `welcome` or `rejected` arrives, before the returned promise settles. */
  onReply?: () => void;
};

function afterTimeout(ms: number): Promise<'timed-out'> {
  return new Promise((resolve) => setTimeout(() => resolve('timed-out'), ms));
}

/**
 * Shared Guest-side connect flow underlying `joinRoom`/`rejoinRoom`: derives `code`'s
 * Transport ID via `registry` (a pure, local computation — no shared lookup involved),
 * connects, sends via `send`, and awaits the Host's `welcome`/`rejected` reply — mapping a
 * `rejected` reply's reason via `onRejected`. Races the connect attempt against `timeout`,
 * resolving `unreachable` if nothing (success or error) comes back within `CONNECT_TIMEOUT_MS`.
 * With `replyTimeout: false` the timeout covers only opening the connection: once the request is
 * sent, the reply may take as long as the Host needs (a Join Request waits for a person), and a
 * silent Host is caught by the Guest's host-silence watcher instead.
 */
function connectAndSend<Result extends { status: string }>(
  transport: Transport,
  registry: RoomRegistry,
  code: string,
  send: (protocol: GuestProtocol) => void,
  onRejected: (reason: string) => Result,
  timeout: (ms: number) => Promise<'timed-out'> = afterTimeout,
  { replyTimeout = true, onSent, onReply }: ConnectHooks = {},
): Promise<Result | { status: 'joined'; playerId: string; reconnectToken: string } | { status: 'invalid-room' } | { status: 'unreachable' }> {
  const transportId = registry.transportIdFor(code);
  let connected = false;

  const connectAttempt = new Promise<Result | { status: 'joined'; playerId: string; reconnectToken: string } | { status: 'invalid-room' } | { status: 'unreachable' }>((resolve) => {
    transport
      .connect(transportId)
      .then(() => {
        connected = true;
        const protocol = new GuestProtocol(transport);
        protocol.on('welcome', (payload) => {
          onReply?.();
          resolve({ status: 'joined', playerId: payload.playerId, reconnectToken: payload.reconnectToken });
        });
        protocol.on('rejected', (payload) => {
          onReply?.();
          resolve(onRejected(payload.reason));
        });
        send(protocol);
        onSent?.();
      })
      .catch((error) => resolve({ status: error instanceof PeerUnavailableError ? 'invalid-room' : 'unreachable' }));
  });

  const timedOut = timeout(CONNECT_TIMEOUT_MS).then((): Promise<{ status: 'unreachable' }> =>
    !replyTimeout && connected ? new Promise(() => {}) : Promise.resolve({ status: 'unreachable' }),
  );
  return Promise.race([connectAttempt, timedOut]);
}

/**
 * Guest-side join flow, for a Guest with no stored identity yet: sends `join` and awaits
 * the Host's `welcome`/`rejected` reply. Reports a clear, distinct result for an invalid
 * Room Code (no Host reachable under its derived id), an unreachable Host, a full
 * Room and a declined Join Request, rather than leaving the caller to interpret a raw
 * connection failure. After Start the Host holds the request until the Host answers, so there is
 * no reply timeout: only opening the connection is bounded. `onSent` runs once the
 * `join` has left, which is when the Guest starts to wait; `onReply` runs the moment the Host answers.
 */
export function joinRoom(
  transport: Transport,
  registry: RoomRegistry,
  code: string,
  name: string,
  timeout: (ms: number) => Promise<'timed-out'> = afterTimeout,
  hooks: Pick<ConnectHooks, 'onSent' | 'onReply'> = {},
): Promise<JoinResult> {
  return connectAndSend(
    transport,
    registry,
    code,
    (protocol) => protocol.join({ name }),
    (reason) => (
      reason === 'ROOM_FULL' ? { status: 'room-full' } :
      reason === 'JOIN_DECLINED' ? { status: 'join-declined' } :
      { status: 'invalid-room' }
    ),
    timeout,
    { ...hooks, replyTimeout: false },
  );
}

/**
 * Guest-side rejoin flow, for a Guest presenting a `reconnectToken` stored from a prior
 * session (a dropped connection or page reload): sends `rejoin` instead of `join`, so the
 * Host matches it back to the existing player record rather than creating a new one. A
 * `reconnectToken` the Host no longer recognizes resolves as `unknown-player`, distinct
 * from an invalid Room Code, so the caller can fall back to a fresh `joinRoom` instead of
 * showing a "Room doesn't exist" message.
 */
export function rejoinRoom(
  transport: Transport,
  registry: RoomRegistry,
  code: string,
  reconnectToken: string,
  timeout: (ms: number) => Promise<'timed-out'> = afterTimeout,
): Promise<RejoinResult> {
  return connectAndSend(
    transport,
    registry,
    code,
    (protocol) => protocol.rejoin({ reconnectToken }),
    () => ({ status: 'unknown-player' }),
    timeout,
  );
}

/**
 * Watches a Guest's own `transport` for a `state` message announcing the game has started
 * (`status: 'active'`). This is the Guest's only cue to leave the "waiting for the Host to
 * start" screen — there is no separate "game started" message, just the first `state`
 * broadcast, since Round Engine state itself carries no earlier status a Guest could act on.
 */
export function watchForGameStart(transport: Transport, onGameStarted: () => void, isAccepting: () => boolean = () => true): void {
  const protocol = new GuestProtocol(transport);
  protocol.on('state', (payload) => {
    if (isAccepting() && payload.snapshot.status === 'active') {
      onGameStarted();
    }
  });
}

/** Calls `onGameEnded` when the Host's `state` broadcast has `status: 'ended'`, i.e. the Host Left. */
export function watchForGameEnd(transport: Transport, onGameEnded: () => void): void {
  const protocol = new GuestProtocol(transport);
  protocol.on('state', (payload) => {
    if (payload.snapshot.status === 'ended') {
      onGameEnded();
    }
  });
}

/**
 * Watches a Guest's own `transport` for `state` messages, handing `onGameState` each snapshot
 * unless its `epoch` and `version` both equal the last pair seen — the Host's periodic
 * heartbeat repeats an unchanged snapshot, which must not re-render. A lower `version` is
 * still applied, and a different `epoch` (a restarted Host) always is.
 */
export function watchGameState(transport: Transport, onGameState: (state: GameState) => void, isAccepting: () => boolean = () => true): void {
  const protocol = new GuestProtocol(transport);
  let last: { epoch: string; version: number } | null = null;
  protocol.on('state', ({ epoch, version, snapshot }) => {
    if (!isAccepting()) {
      return;
    }
    if (last?.epoch === epoch && last.version === version) {
      return;
    }
    last = { epoch, version };
    onGameState(snapshot);
  });
}

/**
 * Watches a Guest's own `transport` for the Host's `welcome`. Returns whether it has arrived: until then this
 * connection is not bound to a player, so the `state` broadcasts it hears (the Host sends them to
 * every open connection) must not take the Guest anywhere.
 */
export function watchForWelcome(transport: Transport): () => boolean {
  let welcomed = false;
  new GuestProtocol(transport).on('welcome', () => {
    welcomed = true;
  });
  return () => welcomed;
}

/**
 * Watches a Guest's own `transport` for the Host going quiet: every `state` (heartbeat
 * included) is a sign of life, and `HOST_SILENCE_TIMEOUT_MS` without one means the link is
 * dead even though no `close` was ever reported. Returns `arm`, which starts the
 * countdown: call it once the Host has confirmed the connection, so a Host that never sends a
 * first `state` is caught too, without a slow join tripping it earlier. Every `state` also
 * (re)starts the countdown. Fires once, and not at all after the
 * connection was already reported dropped.
 */
export function watchForHostSilence(transport: Transport, onHostSilent: () => void): () => void {
  const protocol = new GuestProtocol(transport);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stop = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const start = () => {
    stop();
    timer = setTimeout(() => {
      timer = null;
      onHostSilent();
    }, HOST_SILENCE_TIMEOUT_MS);
  };
  protocol.on('state', start);
  transport.onConnectionChange((_peerId, connected) => {
    if (!connected) {
      stop();
    }
  });
  return start;
}

/**
 * Watches a Guest's own `transport` for its connection to the Host being lost. A single
 * `connected: false` notification is enough to call it — there is no way to tell a brief
 * network blip apart from the Host being gone for good at the moment it happens, so both
 * are reported identically here. `onConnectionDropped` is the caller's cue to drive the
 * shared reconnect implementation (`guest-reconnect.ts`'s `attemptReconnect`) automatically,
 * the same way a page reload does, rather than treating the drop as an immediate dead end.
 */
export function watchForConnectionDrop(transport: Transport, onConnectionDropped: () => void): void {
  transport.onConnectionChange((_peerId, connected) => {
    if (!connected) {
      onConnectionDropped();
    }
  });
}

/** Watches a Guest's own `transport` for the Host refusing a `placeBet`, reporting the rejection's reason. A reason this build doesn't know is ignored. */
export function watchForBetRejection(transport: Transport, onBetRejected: (reason: BetRejection) => void): void {
  const protocol = new GuestProtocol(transport);
  protocol.on('rejected', (payload) => {
    if (payload.action === 'placeBet' && isBetRejection(payload.reason)) {
      onBetRejected(payload.reason);
    }
  });
}

/** Builds the Guest's game-started handler: tells the caller, then navigates to the play route through the injected `navigate`. */
export function makeGameStartedHandler(notify: (code: string) => void, navigate: (path: string) => void): (code: string) => void {
  return (code) => {
    notify(code);
    navigate(withBase(`room/${code}/play`));
  };
}

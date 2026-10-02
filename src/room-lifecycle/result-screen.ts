import type { GameState, Player, ResolutionState } from '../protocol/messages';

/** How long the Result Screen stays before it leaves by itself. */
export const RESULT_SCREEN_DURATION_MS = 5_000;

/** `shownAt` is when this device first showed the Resolution, in epoch ms. */
type ObservedResolution = { resolution: ResolutionState; players: Player[]; shownAt: number };

/**
 * What one device remembers about Resolutions: the one it is still showing (`shown`, which
 * outlives the broadcast's own `resolution` field) and the one currently sitting in the
 * broadcast (`broadcast`, so a dismissed Resolution is not re-shown while it stays broadcast).
 */
export type ResultMemory = {
  shown: ObservedResolution | null;
  broadcast: ResolutionState | null;
};

export const initialResultMemory: ResultMemory = { shown: null, broadcast: null };

/**
 * The memory of a view opening onto `gameState`: a Resolution already sitting in the broadcast
 * counts as seen, since it belongs to a Round the game has already moved past — so a resumed
 * Host or a rejoining Guest lands on the current Round, not a stale result screen.
 */
export function resultMemoryOpenedOn(gameState: GameState | null): ResultMemory {
  return { shown: null, broadcast: gameState?.resolution ?? null };
}

/**
 * Folds `gameState` into a possibly not-yet-seeded `storedMemory`: `null` when the view hasn't
 * opened onto any real `gameState` yet, such as a Guest whose reconnect is still in flight.
 * Opens onto the first `gameState` that arrives (treating an already-broadcast Resolution as
 * seen, as `resultMemoryOpenedOn` does), rather than at mount — a `gameState` that only becomes
 * available asynchronously must not be treated as "nothing to open onto yet, resolution is new".
 */
export function deriveResultMemory(
  storedMemory: ResultMemory | null,
  gameState: GameState | null,
  now: number = Date.now(),
): ResultMemory {
  if (gameState === null) {
    return storedMemory ?? initialResultMemory;
  }
  if (storedMemory === null) {
    return resultMemoryOpenedOn(gameState);
  }
  return observeResolution(storedMemory, gameState, now);
}

export type ResultRow = {
  playerId: string;
  rank: number;
  /** Name, suffixed with "(you)" on the local player's own row. */
  nameLabel: string;
  /** "Challenger" on the Challenger's row, otherwise `null`. */
  roleLabel: string | null;
  points: number;
  deltaLabel: string;
  deltaClass: 'pos' | 'neg';
};

export type ResultScreen = {
  background: 'vb-bg-success' | 'vb-bg-fail';
  title: string;
  rows: ResultRow[];
};

function isSameResolution(a: ResolutionState, b: ResolutionState): boolean {
  return (
    a.challengerId === b.challengerId &&
    a.outcome === b.outcome &&
    a.payouts.length === b.payouts.length &&
    a.payouts.every((payout, index) => payout.playerId === b.payouts[index].playerId && payout.amount === b.payouts[index].amount)
  );
}

/**
 * Folds a newly received `gameState` into `memory`. A Resolution not yet handled is remembered
 * for display; `resolution: null` (the next Round started) only clears the broadcast marker, so
 * whatever is being shown stays until dismissed. Returns `memory` itself when nothing changes.
 */
export function observeResolution(memory: ResultMemory, gameState: GameState | null, now: number = Date.now()): ResultMemory {
  const resolution = gameState?.resolution ?? null;
  if (!gameState || !resolution) {
    return memory.broadcast === null ? memory : { ...memory, broadcast: null };
  }
  if (memory.broadcast !== null && isSameResolution(memory.broadcast, resolution)) {
    return memory;
  }
  return { shown: { resolution, players: gameState.players, shownAt: now }, broadcast: resolution };
}

export function dismissResult(memory: ResultMemory): ResultMemory {
  return memory.shown === null ? memory : { ...memory, shown: null };
}

/** Drops the shown Resolution once `RESULT_SCREEN_DURATION_MS` has passed since it was first shown. */
export function expireResult(memory: ResultMemory, now: number = Date.now()): ResultMemory {
  if (memory.shown === null || now - memory.shown.shownAt < RESULT_SCREEN_DURATION_MS) {
    return memory;
  }
  return dismissResult(memory);
}

function resolveDelta(delta: number): Pick<ResultRow, 'deltaLabel' | 'deltaClass'> {
  return delta >= 0 ? { deltaLabel: `+${delta}`, deltaClass: 'pos' } : { deltaLabel: `${delta}`, deltaClass: 'neg' };
}

export function resolveResultScreen({
  memory,
  localPlayerId,
}: {
  memory: ResultMemory;
  /** `null` until this device's identity is known. */
  localPlayerId: string | null;
}): ResultScreen | null {
  if (!memory.shown) {
    return null;
  }

  const { resolution, players } = memory.shown;
  const challengerName = players.find((player) => player.playerId === resolution.challengerId)?.name;
  if (!challengerName) {
    return null;
  }

  const ranked = [...players].sort((a, b) => b.points - a.points);
  const succeeded = resolution.outcome === 'YES';

  return {
    background: succeeded ? 'vb-bg-success' : 'vb-bg-fail',
    title: `${challengerName} ${succeeded ? 'succeeded 🎉' : 'failed 💥'}`,
    rows: ranked.map((player) => {
      const delta = resolution.payouts.find((payout) => payout.playerId === player.playerId)?.amount ?? 0;
      return {
        playerId: player.playerId,
        rank: ranked.findIndex((other) => other.points === player.points) + 1,
        nameLabel: player.playerId === localPlayerId ? `${player.name} (you)` : player.name,
        roleLabel: player.playerId === resolution.challengerId ? 'Challenger' : null,
        points: player.points,
        ...resolveDelta(delta),
      };
    }),
  };
}

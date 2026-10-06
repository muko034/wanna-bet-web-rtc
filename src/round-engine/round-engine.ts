/**
 * The Round Engine reducer: a pure function over `RoundEngineState` and a `RoundEngineAction`,
 * with no I/O. Randomness (the Challenge draw) is injected via `pickChallenge` rather than
 * called internally, keeping the function itself deterministic and side-effect free.
 */

import { maxBetAmount } from './bet-cap';

const MIN_POINTS = 1;

export type Prediction = 'YES' | 'NO';

export type Bet = {
  playerId: string;
  amount: number;
  prediction: Prediction;
};

export type Round = {
  challengerId: string;
  challengeId: string;
  bets: Bet[];
  outcome: Prediction | null;
};

export type RoundEngineState = {
  /** Player ids in rotation order; the Challenger rotates through this list. */
  playerOrder: string[];
  points: Record<string, number>;
  challengeHistory: string[];
  round: Round | null;
  /** Players the engine skips when rotating the Challenger; a Host Pause and a Sit Out both land here. */
  pausedPlayerIds: string[];
};

export type ChallengeBankEntry = { id: string };

export type StartRoundAction = {
  type: 'START_ROUND';
  challengerId: string;
  challengeBank: ChallengeBankEntry[];
  /** Injected randomness: picks one id out of the given candidate pool. */
  pickChallenge: (candidateIds: string[]) => string;
};

export type RedrawChallengeAction = {
  type: 'REDRAW_CHALLENGE';
  challengeBank: ChallengeBankEntry[];
  /** Injected randomness: picks one id out of the given candidate pool. */
  pickChallenge: (candidateIds: string[]) => string;
};

export type PlaceBetAction = {
  type: 'PLACE_BET';
  playerId: string;
  /** The Challenge the Bettor saw; a Bet for any other Challenge is refused as stale. */
  challengeId: string;
  amount: number;
  prediction: Prediction;
};

export type ResolveRoundAction = {
  type: 'RESOLVE_ROUND';
  outcome: Prediction;
};

export type RemovePlayerAction = {
  type: 'REMOVE_PLAYER';
  playerId: string;
};

export type PausePlayerAction = {
  type: 'PAUSE_PLAYER';
  playerId: string;
};

export type ResumePlayerAction = {
  type: 'RESUME_PLAYER';
  playerId: string;
};

export type RoundEngineAction =
  | PausePlayerAction
  | ResumePlayerAction
  | StartRoundAction
  | RedrawChallengeAction
  | PlaceBetAction
  | ResolveRoundAction
  | RemovePlayerAction;

export type Payout = { playerId: string; amount: number };

export const BET_REJECTIONS = [
  'UNKNOWN_PLAYER',
  'CHALLENGER_CANNOT_BET',
  'DUPLICATE_BET',
  'INVALID_BET_AMOUNT',
  'STALE_CHALLENGE',
] as const;

export type BetRejection = (typeof BET_REJECTIONS)[number];

/** Narrows a wire `reason` string, which the protocol leaves untyped, to a Bet rejection. */
export function isBetRejection(reason: string): reason is BetRejection {
  return (BET_REJECTIONS as readonly string[]).includes(reason);
}

export type RoundEngineResult = {
  state: RoundEngineState;
  payouts: Payout[];
  /** Set when the action was refused; `state` is then the unchanged input state. */
  rejection?: BetRejection;
};

export function roundEngineReducer(
  state: RoundEngineState,
  action: RoundEngineAction,
): RoundEngineResult {
  switch (action.type) {
    case 'START_ROUND':
      return startRound(state, action);
    case 'REDRAW_CHALLENGE':
      return redrawChallenge(state, action);
    case 'PLACE_BET':
      return placeBet(state, action);
    case 'RESOLVE_ROUND':
      return resolveRound(state, action);
    case 'REMOVE_PLAYER':
      return removePlayer(state, action);
    case 'PAUSE_PLAYER':
      return pausePlayer(state, action);
    case 'RESUME_PLAYER':
      return resumePlayer(state, action);
  }
}

function startRound(state: RoundEngineState, action: StartRoundAction): RoundEngineResult {
  const bankIds = action.challengeBank.map((entry) => entry.id);
  const undrawnIds = bankIds.filter((id) => !state.challengeHistory.includes(id));
  const bankWasExhausted = undrawnIds.length === 0;
  const candidateIds = bankWasExhausted ? bankIds : undrawnIds;
  const challengeId = action.pickChallenge(candidateIds);
  const priorHistory = bankWasExhausted ? [] : state.challengeHistory;

  return {
    state: {
      ...state,
      challengeHistory: [...priorHistory, challengeId],
      round: {
        challengerId: action.challengerId,
        challengeId,
        bets: [],
        outcome: null,
      },
    },
    payouts: [],
  };
}

/**
 * Replaces the Round's Challenge and discards its Bets; the Challenger and Points stay. The new
 * Challenge is never the current one and prefers entries outside the Challenge History; with none
 * left, it draws from the whole Bank and the History restarts.
 */
function redrawChallenge(state: RoundEngineState, action: RedrawChallengeAction): RoundEngineResult {
  const round = requireRound(state);
  const otherIds = action.challengeBank.map((entry) => entry.id).filter((id) => id !== round.challengeId);
  const undrawnIds = otherIds.filter((id) => !state.challengeHistory.includes(id));
  const bankWasExhausted = undrawnIds.length === 0;
  const challengeId = action.pickChallenge(bankWasExhausted ? otherIds : undrawnIds);
  const priorHistory = bankWasExhausted ? [] : state.challengeHistory;

  return {
    state: {
      ...state,
      challengeHistory: [...priorHistory, challengeId],
      round: { ...round, challengeId, bets: [] },
    },
    payouts: [],
  };
}

function placeBet(state: RoundEngineState, action: PlaceBetAction): RoundEngineResult {
  const round = requireRound(state);
  const rejection = validateBet(state, round, action);
  if (rejection) {
    return { state, payouts: [], rejection };
  }

  const bet: Bet = {
    playerId: action.playerId,
    amount: action.amount,
    prediction: action.prediction,
  };

  return {
    state: {
      ...state,
      round: { ...round, bets: [...round.bets, bet] },
    },
    payouts: [],
  };
}

function validateBet(
  state: RoundEngineState,
  round: Round,
  action: PlaceBetAction,
): BetRejection | undefined {
  if (action.challengeId !== round.challengeId) return 'STALE_CHALLENGE';
  const points = state.points[action.playerId];
  if (points === undefined) return 'UNKNOWN_PLAYER';
  if (action.playerId === round.challengerId) return 'CHALLENGER_CANNOT_BET';
  if (round.bets.some((bet) => bet.playerId === action.playerId)) return 'DUPLICATE_BET';
  if (!Number.isInteger(action.amount) || action.amount < 1 || action.amount > maxBetAmount(points)) {
    return 'INVALID_BET_AMOUNT';
  }
  return undefined;
}

function requireRound(state: RoundEngineState): Round {
  if (!state.round) {
    throw new Error('No Round is currently in progress');
  }
  return state.round;
}

function resolveRound(state: RoundEngineState, action: ResolveRoundAction): RoundEngineResult {
  const round = requireRound(state);
  const payouts: Payout[] = [];

  for (const bet of round.bets) {
    const won = bet.prediction === action.outcome;
    payouts.push({ playerId: bet.playerId, amount: won ? bet.amount : -bet.amount });
  }

  const noLosses = round.bets
    .filter((bet) => bet.prediction === 'NO')
    .reduce((sum, bet) => sum + bet.amount, 0);
  if (action.outcome === 'YES' && noLosses > 0) {
    payouts.push({ playerId: round.challengerId, amount: noLosses });
  }

  const points = { ...state.points };
  const appliedPayouts = payouts.map((payout) => {
    const before = points[payout.playerId] ?? 0;
    const after = Math.max(MIN_POINTS, before + payout.amount);
    points[payout.playerId] = after;
    return { playerId: payout.playerId, amount: after - before };
  });

  return {
    state: {
      ...state,
      points,
      round: null,
      playerOrder: rotate(state.playerOrder, round.challengerId, state.pausedPlayerIds),
    },
    payouts: appliedPayouts,
  };
}

/** Moves the next unpaused player after `challengerId` to the front; falls back to the plain next player when all are paused. */
function rotate(playerOrder: string[], challengerId: string, pausedPlayerIds: string[]): string[] {
  const index = playerOrder.indexOf(challengerId);
  const offsets = playerOrder.map((_, step) => step + 1);
  const nextOffset =
    offsets.find((offset) => !pausedPlayerIds.includes(playerOrder[(index + offset) % playerOrder.length])) ?? 1;
  const nextIndex = (index + nextOffset) % playerOrder.length;
  return [...playerOrder.slice(nextIndex), ...playerOrder.slice(0, nextIndex)];
}

/**
 * Marks a player paused. Their placed Bet stays in the Round; a Round whose Challenger pauses is
 * discarded and the rotation moves on to the next unpaused player.
 */
function pausePlayer(state: RoundEngineState, action: PausePlayerAction): RoundEngineResult {
  if (state.pausedPlayerIds.includes(action.playerId)) return { state, payouts: [] };
  const pausedPlayerIds = [...state.pausedPlayerIds, action.playerId];
  const isChallenger = state.round?.challengerId === action.playerId;
  return {
    state: {
      ...state,
      pausedPlayerIds,
      round: isChallenger ? null : state.round,
      playerOrder: isChallenger ? rotate(state.playerOrder, action.playerId, pausedPlayerIds) : state.playerOrder,
    },
    payouts: [],
  };
}

function resumePlayer(state: RoundEngineState, action: ResumePlayerAction): RoundEngineResult {
  if (!state.pausedPlayerIds.includes(action.playerId)) return { state, payouts: [] };
  return {
    state: { ...state, pausedPlayerIds: state.pausedPlayerIds.filter((id) => id !== action.playerId) },
    payouts: [],
  };
}

/**
 * Takes a player out of the Game: out of the rotation and the Points table, and out of the
 * open Round — their Bet is dropped, and a Round whose Challenger is removed is discarded.
 */
function removePlayer(state: RoundEngineState, action: RemovePlayerAction): RoundEngineResult {
  const isKnown =
    state.playerOrder.includes(action.playerId) ||
    action.playerId in state.points ||
    (state.round?.bets.some((bet) => bet.playerId === action.playerId) ?? false) ||
    state.round?.challengerId === action.playerId;
  if (!isKnown) {
    return { state, payouts: [] };
  }

  const { [action.playerId]: _removed, ...points } = state.points;
  const round = state.round;
  const nextRound =
    round === null || round.challengerId === action.playerId
      ? null
      : { ...round, bets: round.bets.filter((bet) => bet.playerId !== action.playerId) };

  return {
    state: {
      ...state,
      playerOrder: state.playerOrder.filter((id) => id !== action.playerId),
      points,
      round: nextRound,
    },
    payouts: [],
  };
}

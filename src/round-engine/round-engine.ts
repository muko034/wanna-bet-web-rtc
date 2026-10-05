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
  /** The Challenge the Bettor saw; when given, a Bet for any other Challenge is refused as stale. */
  challengeId?: string;
  amount: number;
  prediction: Prediction;
};

export type ResolveRoundAction = {
  type: 'RESOLVE_ROUND';
  outcome: Prediction;
};

export type RoundEngineAction = StartRoundAction | RedrawChallengeAction | PlaceBetAction | ResolveRoundAction;

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
  if (action.challengeId !== undefined && action.challengeId !== round.challengeId) return 'STALE_CHALLENGE';
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
      playerOrder: rotate(state.playerOrder, round.challengerId),
    },
    payouts: appliedPayouts,
  };
}

function rotate(playerOrder: string[], challengerId: string): string[] {
  const index = playerOrder.indexOf(challengerId);
  const nextIndex = (index + 1) % playerOrder.length;
  return [...playerOrder.slice(nextIndex), ...playerOrder.slice(0, nextIndex)];
}

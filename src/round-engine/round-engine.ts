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
  activePlayerId: string;
  challengeId: string;
  bets: Bet[];
  outcome: Prediction | null;
};

export type RoundEngineState = {
  /** Player ids in rotation order; the Active Player rotates through this list. */
  playerOrder: string[];
  points: Record<string, number>;
  challengeHistory: string[];
  round: Round | null;
};

export type ChallengeBankEntry = { id: string };

export type StartRoundAction = {
  type: 'START_ROUND';
  activePlayerId: string;
  challengeBank: ChallengeBankEntry[];
  /** Injected randomness: picks one id out of the given candidate pool. */
  pickChallenge: (candidateIds: string[]) => string;
};

export type PlaceBetAction = {
  type: 'PLACE_BET';
  playerId: string;
  amount: number;
  prediction: Prediction;
};

export type ResolveRoundAction = {
  type: 'RESOLVE_ROUND';
  outcome: Prediction;
};

export type RoundEngineAction = StartRoundAction | PlaceBetAction | ResolveRoundAction;

export type Payout = { playerId: string; amount: number };

export type BetRejection =
  | 'UNKNOWN_PLAYER'
  | 'ACTIVE_PLAYER_CANNOT_BET'
  | 'DUPLICATE_BET'
  | 'INVALID_BET_AMOUNT';

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
        activePlayerId: action.activePlayerId,
        challengeId,
        bets: [],
        outcome: null,
      },
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
  const points = state.points[action.playerId];
  if (points === undefined) return 'UNKNOWN_PLAYER';
  if (action.playerId === round.activePlayerId) return 'ACTIVE_PLAYER_CANNOT_BET';
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
    payouts.push({ playerId: round.activePlayerId, amount: noLosses });
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
      playerOrder: rotate(state.playerOrder, round.activePlayerId),
    },
    payouts: appliedPayouts,
  };
}

function rotate(playerOrder: string[], activePlayerId: string): string[] {
  const index = playerOrder.indexOf(activePlayerId);
  const nextIndex = (index + 1) % playerOrder.length;
  return [...playerOrder.slice(nextIndex), ...playerOrder.slice(0, nextIndex)];
}

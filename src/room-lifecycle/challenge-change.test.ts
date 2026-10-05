import { describe, expect, it } from 'vitest';
import type { GameState } from '../protocol/messages';
import { isChallengeRedrawn } from './challenge-change';

function stateWith(challengerId: string, challengeId: string, resolutionOutcome: 'YES' | 'NO' | null = null): GameState {
  return {
    roomId: 'ABCDEF',
    status: 'active',
    challengerId,
    players: [],
    round: { challengerId, challengeId, bets: [], outcome: null },
    resolution: resolutionOutcome && { challengerId: 'prev', outcome: resolutionOutcome, payouts: [] },
  };
}

describe('isChallengeRedrawn', () => {
  it('detects a changed Challenge id within the same Round', () => {
    expect(isChallengeRedrawn(stateWith('alex', 'c1'), stateWith('alex', 'c2'))).toBe(true);
  });

  it('is false for an identical Challenge, as in a heartbeat or a new Bet', () => {
    expect(isChallengeRedrawn(stateWith('alex', 'c1'), stateWith('alex', 'c1'))).toBe(false);
  });

  it('is false when the Challenger changes: that is a new Round', () => {
    expect(isChallengeRedrawn(stateWith('alex', 'c1'), stateWith('sam', 'c2'))).toBe(false);
  });

  it('is false for a new Round of the same Challenger that follows a new Resolution', () => {
    expect(isChallengeRedrawn(stateWith('alex', 'c1', 'YES'), stateWith('alex', 'c2', 'NO'))).toBe(false);
  });

  it('is true across a Redraw that follows an earlier Resolution, which stays unchanged', () => {
    expect(isChallengeRedrawn(stateWith('alex', 'c1', 'YES'), stateWith('alex', 'c2', 'YES'))).toBe(true);
  });

  it('is false when either side has no Round, as on the first state a Guest sees', () => {
    expect(isChallengeRedrawn(null, stateWith('alex', 'c1'))).toBe(false);
    expect(isChallengeRedrawn(stateWith('alex', 'c1'), { ...stateWith('alex', 'c1'), round: null })).toBe(false);
  });
});

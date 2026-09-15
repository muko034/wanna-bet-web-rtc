import { describe, expect, it } from 'vitest';
import { roundEngineReducer } from './round-engine';
import type { RoundEngineState } from './round-engine';

function stateWith(overrides: Partial<RoundEngineState> = {}): RoundEngineState {
  return {
    playerOrder: ['p1', 'p2', 'p3'],
    points: { p1: 100, p2: 100, p3: 100 },
    challengeHistory: [],
    round: null,
    ...overrides,
  };
}

describe('roundEngineReducer', () => {
  describe('START_ROUND', () => {
    it('starts a round for the designated Active Player with a Challenge drawn from the bank', () => {
      const state = stateWith();
      const bank = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];

      const { state: next } = roundEngineReducer(state, {
        type: 'START_ROUND',
        activePlayerId: 'p1',
        challengeBank: bank,
        pickChallenge: (candidates) => candidates[0],
      });

      expect(next.round).toEqual({
        activePlayerId: 'p1',
        challengeId: 'c1',
        bets: [],
        outcome: null,
      });
    });

    it('draws only from Challenge Bank ids not already in the Challenge History', () => {
      const state = stateWith({ challengeHistory: ['c1', 'c2'] });
      const bank = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
      let seenCandidates: string[] = [];

      roundEngineReducer(state, {
        type: 'START_ROUND',
        activePlayerId: 'p1',
        challengeBank: bank,
        pickChallenge: (candidates) => {
          seenCandidates = candidates;
          return candidates[0];
        },
      });

      expect(seenCandidates).toEqual(['c3']);
    });

    it('offers the whole bank as candidates once every entry has already been drawn', () => {
      const state = stateWith({ challengeHistory: ['c1', 'c2', 'c3'] });
      const bank = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
      let seenCandidates: string[] = [];

      roundEngineReducer(state, {
        type: 'START_ROUND',
        activePlayerId: 'p1',
        challengeBank: bank,
        pickChallenge: (candidates) => {
          seenCandidates = candidates;
          return candidates[0];
        },
      });

      expect(seenCandidates).toEqual(['c1', 'c2', 'c3']);
    });

    it('adds the drawn Challenge id to the Challenge History', () => {
      const state = stateWith({ challengeHistory: ['c1'] });
      const bank = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];

      const { state: next } = roundEngineReducer(state, {
        type: 'START_ROUND',
        activePlayerId: 'p1',
        challengeBank: bank,
        pickChallenge: (candidates) => candidates[0],
      });

      expect(next.challengeHistory).toEqual(['c1', 'c2']);
    });

    it('starts the new History from just the drawn id when the bank had been exhausted', () => {
      const state = stateWith({ challengeHistory: ['c1', 'c2', 'c3'] });
      const bank = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];

      const { state: next } = roundEngineReducer(state, {
        type: 'START_ROUND',
        activePlayerId: 'p1',
        challengeBank: bank,
        pickChallenge: (candidates) => candidates[0],
      });

      expect(next.challengeHistory).toEqual(['c1']);
    });
  });

  describe('PLACE_BET', () => {
    it('records a Bettor Bet with an amount and Prediction against the current round', () => {
      const state = stateWith({
        round: { activePlayerId: 'p1', challengeId: 'c1', bets: [], outcome: null },
      });

      const { state: next } = roundEngineReducer(state, {
        type: 'PLACE_BET',
        playerId: 'p2',
        amount: 10,
        prediction: 'YES',
      });

      expect(next.round?.bets).toEqual([{ playerId: 'p2', amount: 10, prediction: 'YES' }]);
    });
  });

  describe('RESOLVE_ROUND', () => {
    it('on Outcome YES: pays YES Bettors their Bet, charges NO Bettors their Bet, and gives the Active Player the NO Bettors\' losses, then rotates the Active Player', () => {
      const state = stateWith({
        playerOrder: ['p1', 'p2', 'p3'],
        points: { p1: 100, p2: 100, p3: 100 },
        round: {
          activePlayerId: 'p1',
          challengeId: 'c1',
          bets: [
            { playerId: 'p2', amount: 20, prediction: 'YES' },
            { playerId: 'p3', amount: 15, prediction: 'NO' },
          ],
          outcome: null,
        },
      });

      const { state: next, payouts } = roundEngineReducer(state, {
        type: 'RESOLVE_ROUND',
        outcome: 'YES',
      });

      expect(payouts).toEqual(
        expect.arrayContaining([
          { playerId: 'p2', amount: 20 },
          { playerId: 'p3', amount: -15 },
          { playerId: 'p1', amount: 15 },
        ]),
      );
      expect(next.points).toEqual({ p1: 115, p2: 120, p3: 85 });
      expect(next.round).toBeNull();
      expect(next.playerOrder).toEqual(['p2', 'p3', 'p1']);
    });

    it('on Outcome NO: pays NO Bettors their Bet, charges YES Bettors their Bet, and leaves the Active Player\'s Points unchanged', () => {
      const state = stateWith({
        playerOrder: ['p1', 'p2', 'p3'],
        points: { p1: 100, p2: 100, p3: 100 },
        round: {
          activePlayerId: 'p1',
          challengeId: 'c1',
          bets: [
            { playerId: 'p2', amount: 20, prediction: 'YES' },
            { playerId: 'p3', amount: 15, prediction: 'NO' },
          ],
          outcome: null,
        },
      });

      const { state: next, payouts } = roundEngineReducer(state, {
        type: 'RESOLVE_ROUND',
        outcome: 'NO',
      });

      expect(payouts).toEqual(
        expect.arrayContaining([
          { playerId: 'p2', amount: -20 },
          { playerId: 'p3', amount: 15 },
        ]),
      );
      expect(next.points).toEqual({ p1: 100, p2: 80, p3: 115 });
    });
  });
});

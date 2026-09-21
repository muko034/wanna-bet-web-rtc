import { describe, expect, it } from 'vitest';
import { roundEngineReducer } from './round-engine';
import type { Bet, RoundEngineState } from './round-engine';

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

  describe('PLACE_BET validation', () => {
    function openRound(points: Record<string, number>, bets: Bet[] = []): RoundEngineState {
      return stateWith({
        points,
        round: { activePlayerId: 'p1', challengeId: 'c1', bets, outcome: null },
      });
    }

    function placeBet(state: RoundEngineState, playerId: string, amount: number) {
      return roundEngineReducer(state, { type: 'PLACE_BET', playerId, amount, prediction: 'YES' });
    }

    it.each([
      { points: 100, amount: 50, accepted: true },
      { points: 100, amount: 51, accepted: false },
      { points: 11, amount: 5, accepted: true },
      { points: 11, amount: 6, accepted: false },
      { points: 3, amount: 1, accepted: true },
      { points: 3, amount: 2, accepted: false },
      { points: 2, amount: 1, accepted: true },
      { points: 2, amount: 2, accepted: false },
      { points: 1, amount: 1, accepted: true },
      { points: 1, amount: 2, accepted: false },
    ])(
      'with $points Points, a Bet of $amount is accepted: $accepted',
      ({ points, amount, accepted }) => {
        const state = openRound({ p1: 100, p2: points, p3: 100 });

        const result = placeBet(state, 'p2', amount);

        if (accepted) {
          expect(result.rejection).toBeUndefined();
          expect(result.state.round?.bets).toEqual([{ playerId: 'p2', amount, prediction: 'YES' }]);
        } else {
          expect(result.rejection).toBe('INVALID_BET_AMOUNT');
          expect(result.state).toBe(state);
        }
      },
    );

    it.each([0, -1, -10, 0.5, 1.5, 2.000001, NaN, Infinity])(
      'rejects a Bet of %s as an invalid amount',
      (amount) => {
        const state = openRound({ p1: 100, p2: 100, p3: 100 });

        const result = placeBet(state, 'p2', amount);

        expect(result.rejection).toBe('INVALID_BET_AMOUNT');
        expect(result.state).toBe(state);
      },
    );

    it('rejects a second Bet from the same player in the same round', () => {
      const state = openRound({ p1: 100, p2: 100, p3: 100 }, [
        { playerId: 'p2', amount: 10, prediction: 'YES' },
      ]);

      const result = placeBet(state, 'p2', 5);

      expect(result.rejection).toBe('DUPLICATE_BET');
      expect(result.state).toBe(state);
    });

    it('still accepts a first Bet from another player after one player has bet', () => {
      const state = openRound({ p1: 100, p2: 100, p3: 100 }, [
        { playerId: 'p2', amount: 10, prediction: 'YES' },
      ]);

      const result = placeBet(state, 'p3', 5);

      expect(result.rejection).toBeUndefined();
      expect(result.state.round?.bets).toHaveLength(2);
    });

    it('rejects a Bet from the Active Player', () => {
      const state = openRound({ p1: 100, p2: 100, p3: 100 });

      const result = placeBet(state, 'p1', 10);

      expect(result.rejection).toBe('ACTIVE_PLAYER_CANNOT_BET');
      expect(result.state).toBe(state);
    });

    it('rejects a Bet from a player who is not in the game', () => {
      const state = openRound({ p1: 100, p2: 100, p3: 100 });

      const result = placeBet(state, 'ghost', 1);

      expect(result.rejection).toBe('UNKNOWN_PLAYER');
      expect(result.state).toBe(state);
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

    it('never drops a player below 1 Point: a 1-Point Bettor who loses their full Bet stays at 1', () => {
      const state = stateWith({
        points: { p1: 100, p2: 1, p3: 100 },
        round: {
          activePlayerId: 'p1',
          challengeId: 'c1',
          bets: [{ playerId: 'p2', amount: 1, prediction: 'YES' }],
          outcome: null,
        },
      });

      const { state: next, payouts } = roundEngineReducer(state, {
        type: 'RESOLVE_ROUND',
        outcome: 'NO',
      });

      expect(next.points.p2).toBe(1);
      expect(payouts).toContainEqual({ playerId: 'p2', amount: 0 });
    });
  });

  describe('Points floor across many rounds', () => {
    it('no sequence of validated Bets and Resolutions ever leaves a player below 1 Point', () => {
      let seed = 12345;
      const random = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
      const players = ['p1', 'p2', 'p3', 'p4'];
      let state = stateWith({
        playerOrder: players,
        points: { p1: 3, p2: 1, p3: 2, p4: 100 },
      });

      for (let roundNumber = 0; roundNumber < 300; roundNumber++) {
        state = roundEngineReducer(state, {
          type: 'START_ROUND',
          activePlayerId: state.playerOrder[0],
          challengeBank: [{ id: 'c1' }],
          pickChallenge: (candidates) => candidates[0],
        }).state;

        for (const playerId of players) {
          const attempt = Math.floor(random() * 60) - 5;
          state = roundEngineReducer(state, {
            type: 'PLACE_BET',
            playerId,
            amount: attempt,
            prediction: random() < 0.5 ? 'YES' : 'NO',
          }).state;
        }

        state = roundEngineReducer(state, {
          type: 'RESOLVE_ROUND',
          outcome: random() < 0.5 ? 'YES' : 'NO',
        }).state;

        for (const playerId of players) {
          expect(state.points[playerId]).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });
});

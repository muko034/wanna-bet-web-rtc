import { describe, expect, it } from 'vitest';
import type { GameState } from '../protocol/messages';
import { resolveLockIn } from './lock-in';

const gameState: GameState = {
  roomId: 'ABCDEF',
  status: 'active',
  challengerId: 'p1',
  resolution: null,
  players: [],
  round: { challengerId: 'p1', challengeId: 'c1', bets: [], outcome: null },
};

describe('resolveLockIn', () => {
  it('builds the Bet for the open Round, tied to its Challenge id', () => {
    expect(resolveLockIn({ gameState, localPlayerId: 'p2', prediction: 'YES', amount: 3 })).toEqual({
      roundKey: 'p1:c1',
      playerId: 'p2',
      bet: { amount: 3, prediction: 'YES', challengeId: 'c1' },
    });
  });

  it.each([
    ['no game state', null, 'p2', 'YES'],
    ['no open Round', { ...gameState, round: null }, 'p2', 'YES'],
    ['no local player', gameState, null, 'YES'],
    ['no prediction', gameState, 'p2', null],
  ] as const)('is null for %s', (_name, state, playerId, prediction) => {
    expect(resolveLockIn({ gameState: state, localPlayerId: playerId, prediction, amount: 1 })).toBeNull();
  });
});

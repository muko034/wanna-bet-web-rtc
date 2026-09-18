import { describe, expect, it } from 'vitest';
import type { GameState } from '../protocol/messages';
import { resolveResolutionSummary } from './resolution-summary';

function stateWith(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'ABCDEF',
    status: 'active',
    activePlayerId: 'guest-2',
    players: [
      { playerId: 'host-1', name: 'Host', points: 115, status: 'active', connected: true },
      { playerId: 'guest-1', name: 'Alex', points: 120, status: 'active', connected: true },
      { playerId: 'guest-2', name: 'Sam', points: 85, status: 'active', connected: true },
    ],
    round: null,
    resolution: {
      activePlayerId: 'host-1',
      outcome: 'YES',
      payouts: [
        { playerId: 'host-1', amount: 15 },
        { playerId: 'guest-1', amount: 20 },
        { playerId: 'guest-2', amount: -15 },
      ],
    },
    ...overrides,
  };
}

describe('resolveResolutionSummary', () => {
  it('describes the resolved Outcome and each visible player Points change from the broadcast GameState', () => {
    expect(resolveResolutionSummary(stateWith())).toEqual({
      activePlayerName: 'Host',
      outcome: 'YES',
      pointChanges: [
        { playerId: 'host-1', name: 'Host', points: 115, change: 15 },
        { playerId: 'guest-1', name: 'Alex', points: 120, change: 20 },
        { playerId: 'guest-2', name: 'Sam', points: 85, change: -15 },
      ],
    });
  });

  it('returns null when no Resolution is currently being shown', () => {
    expect(resolveResolutionSummary(stateWith({ resolution: null }))).toBeNull();
  });
});

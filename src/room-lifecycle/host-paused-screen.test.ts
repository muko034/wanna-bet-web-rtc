import { describe, expect, it } from 'vitest';
import type { GameState, Player } from '../protocol/messages';
import { resolveHostPausedScreen } from './host-paused-screen';

const alex: Player = { playerId: 'a', name: 'Alex', points: 100, status: 'active', connected: true };

function stateWith(local: Partial<Player>): GameState {
  return { roomId: 'ABCDEF', status: 'active', challengerId: null, resolution: null, round: null, players: [{ ...alex, ...local }] };
}

describe('resolveHostPausedScreen', () => {
  it('tells a Guest the Host paused that the Host paused them', () => {
    expect(resolveHostPausedScreen({ gameState: stateWith({ status: 'paused', pausedBy: 'host' }), localPlayerId: 'a' })).toEqual({
      title: { key: 'hostPaused.title' },
      subtitle: { key: 'hostPaused.subtitle' },
      background: 'vb-bg-wait',
    });
  });

  it.each([
    ['active', { status: 'active' }],
    ['sitting out', { status: 'paused', pausedBy: 'self' }],
    ['removed', { status: 'removed' }],
  ] as const)('shows nothing for a Guest who is %s', (_name, local) => {
    expect(resolveHostPausedScreen({ gameState: stateWith(local), localPlayerId: 'a' })).toBeNull();
  });

  it('shows nothing before a state or the local identity is known, or for another player', () => {
    const paused = stateWith({ status: 'paused', pausedBy: 'host' });
    expect(resolveHostPausedScreen({ gameState: null, localPlayerId: 'a' })).toBeNull();
    expect(resolveHostPausedScreen({ gameState: paused, localPlayerId: null })).toBeNull();
    expect(resolveHostPausedScreen({ gameState: paused, localPlayerId: 'someone-else' })).toBeNull();
  });
});

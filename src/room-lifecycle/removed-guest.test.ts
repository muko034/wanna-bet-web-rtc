import { describe, expect, it } from 'vitest';
import type { GameState, Player } from '../protocol/messages';
import { isRemovedFromGame } from './removed-guest';

const alex: Player = { playerId: 'a', name: 'Alex', points: 100, status: 'active', connected: true };
const sam: Player = { playerId: 's', name: 'Sam', points: 100, status: 'active', connected: true };

function stateWith(players: Player[], roomId = 'ABCDEF'): GameState {
  return { roomId, status: 'active', challengerId: null, resolution: null, round: null, players };
}

describe('isRemovedFromGame', () => {
  it('is true for a player whose own row is removed', () => {
    expect(isRemovedFromGame({ gameState: stateWith([{ ...alex, status: 'removed' }, sam]), code: 'ABCDEF', localPlayerId: 'a' })).toBe(true);
  });

  it.each([
    ['active', { status: 'active' }],
    ['paused by the Host', { status: 'paused', pausedBy: 'host' }],
    ['sitting out', { status: 'paused', pausedBy: 'self' }],
  ] as const)('is false for a player who is %s', (_name, local) => {
    expect(isRemovedFromGame({ gameState: stateWith([{ ...alex, ...local }]), code: 'ABCDEF', localPlayerId: 'a' })).toBe(false);
  });

  it('is false when only another player is removed', () => {
    expect(isRemovedFromGame({ gameState: stateWith([alex, { ...sam, status: 'removed' }]), code: 'ABCDEF', localPlayerId: 'a' })).toBe(false);
  });

  it('is false before a state or the local identity is known, or for a state of another Room', () => {
    const removed = stateWith([{ ...alex, status: 'removed' }]);
    expect(isRemovedFromGame({ gameState: null, code: 'ABCDEF', localPlayerId: 'a' })).toBe(false);
    expect(isRemovedFromGame({ gameState: removed, code: 'ABCDEF', localPlayerId: null })).toBe(false);
    expect(isRemovedFromGame({ gameState: removed, code: 'GHJKLM', localPlayerId: 'a' })).toBe(false);
  });
});

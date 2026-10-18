import { describe, expect, it } from 'vitest';
import type { GameState } from '../protocol/messages';
import { resolveRosterNotices } from './roster-notice';

function stateWith(players: GameState['players'], status: GameState['status'] = 'active'): GameState {
  return { roomId: 'ABCDEF', status, challengerId: 'host-1', resolution: null, round: null, players };
}

const host = { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true } as const;
const alex = { playerId: 'guest-1', name: 'Alex', points: 100, status: 'active', connected: true } as const;
const sam = { playerId: 'guest-2', name: 'Sam', points: 100, status: 'active', connected: true } as const;

describe('resolveRosterNotices', () => {
  it('announces a player who just sat out', () => {
    const next = stateWith([host, { ...alex, status: 'paused', pausedBy: 'self', connected: false }, sam]);

    expect(resolveRosterNotices(stateWith([host, alex, sam]), next, 'guest-2')).toEqual([{ key: 'notice.satOut', params: { name: 'Alex' } }]);
  });

  it('announces a player whose row is now removed, i.e. who just left', () => {
    const next = stateWith([host, { ...alex, status: 'removed', connected: false }, sam]);

    expect(resolveRosterNotices(stateWith([host, alex, sam]), next, 'guest-2')).toEqual([{ key: 'notice.left', params: { name: 'Alex' } }]);
  });

  it('does not announce a removed player again on later snapshots', () => {
    const removed = { ...alex, status: 'removed', connected: false } as const;

    expect(resolveRosterNotices(stateWith([host, removed, sam]), stateWith([host, removed, sam]), 'guest-2')).toEqual([]);
  });

  it('announces a Host Pause and a Host Resume, naming the player', () => {
    const paused = { ...alex, status: 'paused', pausedBy: 'host' } as const;

    expect(resolveRosterNotices(stateWith([host, alex, sam]), stateWith([host, paused, sam]), 'guest-2')).toEqual([
      { key: 'notice.hostPaused', params: { name: 'Alex' } },
    ]);
    expect(resolveRosterNotices(stateWith([host, paused, sam]), stateWith([host, alex, sam]), 'guest-2')).toEqual([
      { key: 'notice.hostResumed', params: { name: 'Alex' } },
    ]);
  });

  it('stays silent for the player a Host Pause or Resume is about', () => {
    const paused = { ...alex, status: 'paused', pausedBy: 'host' } as const;

    expect(resolveRosterNotices(stateWith([host, alex]), stateWith([host, paused]), 'guest-1')).toEqual([]);
    expect(resolveRosterNotices(stateWith([host, paused]), stateWith([host, alex]), 'guest-1')).toEqual([]);
  });

  it('stays silent for a Sit Out by a Host-paused player, a return from a Sit Out, an unchanged roster and the local player', () => {
    const hostPaused = { ...alex, status: 'paused', pausedBy: 'host' } as const;
    const sat = { ...alex, status: 'paused', pausedBy: 'self' } as const;

    expect(resolveRosterNotices(stateWith([host, hostPaused]), stateWith([host, hostPaused]), 'host-1')).toEqual([]);
    expect(resolveRosterNotices(stateWith([host, sat]), stateWith([host, alex]), 'host-1')).toEqual([]);
    expect(resolveRosterNotices(stateWith([host, alex]), stateWith([host, alex]), 'host-1')).toEqual([]);
    expect(resolveRosterNotices(stateWith([host, alex]), stateWith([host, sat]), 'guest-1')).toEqual([]);
  });

  it('stays silent without a previous snapshot, in the Lobby and once the game ended', () => {
    expect(resolveRosterNotices(null, stateWith([host, alex]), 'host-1')).toEqual([]);
    expect(resolveRosterNotices(stateWith([host, alex], 'lobby'), stateWith([host], 'lobby'), 'host-1')).toEqual([]);
    expect(resolveRosterNotices(stateWith([host, alex]), stateWith([host, alex], 'ended'), 'host-1')).toEqual([]);
  });
});

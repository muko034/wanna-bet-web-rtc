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

    expect(resolveRosterNotices(stateWith([host, alex, sam]), next, 'guest-2')).toEqual(['Alex sat out']);
  });

  it('announces a player who just left', () => {
    expect(resolveRosterNotices(stateWith([host, alex, sam]), stateWith([host, sam]), 'guest-2')).toEqual(['Alex left']);
  });

  it('stays silent for a Host Pause, a return, an unchanged roster and the local player', () => {
    const paused = { ...alex, status: 'paused', pausedBy: 'host' } as const;
    const sat = { ...alex, status: 'paused', pausedBy: 'self' } as const;

    expect(resolveRosterNotices(stateWith([host, alex]), stateWith([host, paused]), 'host-1')).toEqual([]);
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

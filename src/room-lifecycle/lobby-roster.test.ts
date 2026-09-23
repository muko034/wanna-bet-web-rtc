import { describe, expect, it } from 'vitest';
import { resolveLobbyRoster } from './lobby-roster';
import type { Player } from '../protocol/messages';

function playerWith(overrides: Partial<Player>): Player {
  return { playerId: 'p1', name: 'Alex', points: 100, status: 'active', connected: true, ...overrides };
}

describe('resolveLobbyRoster', () => {
  it('lists every player by name, in the given order', () => {
    const players = [
      playerWith({ playerId: 'host-1', name: 'Host' }),
      playerWith({ playerId: 'p1', name: 'Alex' }),
      playerWith({ playerId: 'p2', name: 'Sam' }),
    ];

    const roster = resolveLobbyRoster({ players, localPlayerId: 'p2' });

    expect(roster.map((entry) => entry.playerId)).toEqual(['host-1', 'p1', 'p2']);
  });

  it('suffixes only the local player\'s own entry with "(you)"', () => {
    const players = [
      playerWith({ playerId: 'host-1', name: 'Host' }),
      playerWith({ playerId: 'p1', name: 'Alex' }),
    ];

    const roster = resolveLobbyRoster({ players, localPlayerId: 'host-1' });

    expect(roster).toEqual([
      { playerId: 'host-1', nameLabel: 'Host (you)' },
      { playerId: 'p1', nameLabel: 'Alex' },
    ]);
  });

  it('suffixes nobody\'s entry when localPlayerId is null (identity not known yet)', () => {
    const players = [playerWith({ playerId: 'p1', name: 'Alex' })];

    const roster = resolveLobbyRoster({ players, localPlayerId: null });

    expect(roster).toEqual([{ playerId: 'p1', nameLabel: 'Alex' }]);
  });

  it('returns an empty roster for an empty player list', () => {
    expect(resolveLobbyRoster({ players: [], localPlayerId: null })).toEqual([]);
  });

  it('returns an empty roster when no Lobby snapshot has arrived yet', () => {
    expect(resolveLobbyRoster({ players: null, localPlayerId: null })).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { resolveStartedGameView } from './started-game-view';
import type { Room } from './room';

function roomWith(overrides: Partial<Room> = {}): Room {
  return {
    code: 'ABCDEF',
    hostName: 'Host',
    hostPlayerId: 'host-1',
    players: [{ playerId: 'p1', name: 'Alex', connected: true }],
    playerCount: 2,
    started: false,
    ...overrides,
  };
}

describe('resolveStartedGameView', () => {
  it("shows the started view for the Host's own Room once it has started", () => {
    const room = roomWith({ started: true });

    const result = resolveStartedGameView({ code: 'ABCDEF', room, guestGameStartedCode: null });

    expect(result).toEqual({ view: 'started', roomCode: 'ABCDEF' });
  });

  it("redirects the Host back to the Lobby when its own Room hasn't started yet", () => {
    const room = roomWith({ started: false });

    const result = resolveStartedGameView({ code: 'ABCDEF', room, guestGameStartedCode: null });

    expect(result).toEqual({ view: 'redirect-to-lobby' });
  });

  it('shows the started view for a Guest who has received the Host\'s "active" GameState for this code, with no local Room object', () => {
    const result = resolveStartedGameView({ code: 'ABCDEF', room: null, guestGameStartedCode: 'ABCDEF' });

    expect(result).toEqual({ view: 'started', roomCode: 'ABCDEF' });
  });

  it('shows not-found for a visitor with no Room and no Guest game-started signal for this code', () => {
    const result = resolveStartedGameView({ code: 'ABCDEF', room: null, guestGameStartedCode: null });

    expect(result).toEqual({ view: 'not-found' });
  });

  it("shows not-found when the code doesn't match this device's own Room nor its tracked Guest game-started code", () => {
    const room = roomWith({ code: 'OTHERR', started: true });

    const result = resolveStartedGameView({ code: 'ABCDEF', room, guestGameStartedCode: 'ZZZZZZ' });

    expect(result).toEqual({ view: 'not-found' });
  });
});

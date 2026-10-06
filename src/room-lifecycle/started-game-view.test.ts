import { describe, expect, it } from 'vitest';
import { resolveStartedGameView } from './started-game-view';
import type { GameState } from '../protocol/messages';
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

const NOT_RECONNECTING = { hasStoredIdentity: false, reconnectPhase: null } as const;

describe('resolveStartedGameView', () => {
  it("shows the started view for the Host's own Room once it has started", () => {
    const room = roomWith({ started: true });

    const result = resolveStartedGameView({ code: 'ABCDEF', room, guestGameStartedCode: null, ...NOT_RECONNECTING });

    expect(result).toEqual({ view: 'started', roomCode: 'ABCDEF' });
  });

  it("redirects the Host back to the Lobby when its own Room hasn't started yet", () => {
    const room = roomWith({ started: false });

    const result = resolveStartedGameView({ code: 'ABCDEF', room, guestGameStartedCode: null, ...NOT_RECONNECTING });

    expect(result).toEqual({ view: 'redirect-to-lobby' });
  });

  it('shows the started view for a Guest who has received the Host\'s "active" GameState for this code, with no local Room object', () => {
    const result = resolveStartedGameView({ code: 'ABCDEF', room: null, guestGameStartedCode: 'ABCDEF', ...NOT_RECONNECTING });

    expect(result).toEqual({ view: 'started', roomCode: 'ABCDEF' });
  });

  it('shows not-found when this route has no :code param at all', () => {
    const result = resolveStartedGameView({ code: undefined, room: null, guestGameStartedCode: null, ...NOT_RECONNECTING });

    expect(result).toEqual({ view: 'not-found' });
  });

  it('shows the join form for a visitor with no Room, no Guest game-started signal, and no stored identity for this code', () => {
    const result = resolveStartedGameView({ code: 'ABCDEF', room: null, guestGameStartedCode: null, ...NOT_RECONNECTING });

    expect(result).toEqual({ view: 'join-form' });
  });

  it("shows the join form when the code doesn't match this device's own Room nor its tracked Guest game-started code, and no identity is stored for it", () => {
    const room = roomWith({ code: 'OTHERR', started: true });

    const result = resolveStartedGameView({ code: 'ABCDEF', room, guestGameStartedCode: 'ZZZZZZ', ...NOT_RECONNECTING });

    expect(result).toEqual({ view: 'join-form' });
  });

  it('shows a reconnecting view while a stored identity for this code is being rejoined', () => {
    const result = resolveStartedGameView({
      code: 'ABCDEF',
      room: null,
      guestGameStartedCode: null,
      hasStoredIdentity: true,
      reconnectPhase: 'pending',
    });

    expect(result).toEqual({ view: 'reconnecting', roomCode: 'ABCDEF' });
  });

  it('falls back to the join form when the Host rejects the stored identity as unrecognized', () => {
    const result = resolveStartedGameView({
      code: 'ABCDEF',
      room: null,
      guestGameStartedCode: null,
      hasStoredIdentity: true,
      reconnectPhase: 'unknown-player',
    });

    expect(result).toEqual({ view: 'join-form' });
  });

  it("shows a reconnect-failed view, with the underlying error message, when the reconnect attempt itself fails", () => {
    const result = resolveStartedGameView({
      code: 'ABCDEF',
      room: null,
      guestGameStartedCode: null,
      hasStoredIdentity: true,
      reconnectPhase: { kind: 'error', message: "Couldn't reach the Host — check the link and try again." },
    });

    expect(result).toEqual({
      view: 'reconnect-failed',
      roomCode: 'ABCDEF',
      message: "Couldn't reach the Host — check the link and try again.",
    });
  });

  it.each([
    ['right after the drop, before the reconnect effect has started', null],
    ['while the reconnect is in progress', 'pending' as const],
  ])('keeps the game screen for a Guest who already has a game state %s', (_label, reconnectPhase) => {
    const result = resolveStartedGameView({
      code: 'ABCDEF',
      room: null,
      guestGameStartedCode: null,
      hasStoredIdentity: true,
      reconnectPhase,
      hasGameState: true,
    });

    expect(result).toEqual({ view: 'started', roomCode: 'ABCDEF' });
  });

  it('shows the reconnect-failed view once the reconnect gives up, even for a Guest who has a game state', () => {
    const result = resolveStartedGameView({
      code: 'ABCDEF',
      room: null,
      guestGameStartedCode: null,
      hasStoredIdentity: true,
      reconnectPhase: { kind: 'error', message: 'gave up' },
      hasGameState: true,
    });

    expect(result).toEqual({ view: 'reconnect-failed', roomCode: 'ABCDEF', message: 'gave up' });
  });
});

function endedState(roomId: string): GameState {
  return { roomId, status: 'ended', challengerId: null, resolution: null, round: null, players: [] };
}

describe('resolveStartedGameView once the Game has ended', () => {
  it.each([
    ['the Host', roomWith({ started: true }), false],
    ['a Guest with no stored identity left', null, false],
    ['a Guest whose connection is gone', null, true],
  ])('shows the Game Result Screen to %s', (_name, room, hasGameState) => {
    const result = resolveStartedGameView({
      code: 'ABCDEF', room, guestGameStartedCode: null, hasStoredIdentity: false, reconnectPhase: null, hasGameState, gameState: endedState('ABCDEF'),
    });

    expect(result).toEqual({ view: 'game-result', roomCode: 'ABCDEF' });
  });

  it('ignores an ended state that belongs to another Room', () => {
    const result = resolveStartedGameView({
      code: 'ABCDEF', room: null, guestGameStartedCode: null, hasStoredIdentity: false, reconnectPhase: null, gameState: endedState('OTHERR'),
    });

    expect(result).toEqual({ view: 'join-form' });
  });
});

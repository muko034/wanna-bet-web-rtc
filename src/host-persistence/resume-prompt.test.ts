import { describe, expect, it } from 'vitest';
import type { HostSession } from './host-session-store';
import { resolveResumePrompt } from './resume-prompt';

function sessionFor(code: string): HostSession {
  return {
    room: { code, hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: true },
    gameState: { roomId: code, status: 'active', activePlayerId: null, resolution: null, round: null, players: [] },
    roundEngineState: { playerOrder: ['host-1'], points: { 'host-1': 100 }, challengeHistory: [], round: null },
    firstRoundStarted: false,
    reconnectTokens: {},
  };
}

describe('resolveResumePrompt', () => {
  it.each([
    { where: 'the landing page', routeCode: null },
    { where: "that Room's own page", routeCode: 'ABCDEF' },
  ])('offers to resume a saved session when the app is reopened on $where', ({ routeCode }) => {
    expect(resolveResumePrompt({ session: sessionFor('ABCDEF'), routeCode })).toEqual({
      kind: 'prompt',
      roomCode: 'ABCDEF',
    });
  });

  it.each([
    { why: 'no session was saved', session: null, routeCode: null },
    { why: "the app was opened on a different Room's link, as a Guest", session: sessionFor('ABCDEF'), routeCode: 'ZZZZZZ' },
  ])('offers nothing when $why', ({ session, routeCode }) => {
    expect(resolveResumePrompt({ session, routeCode })).toEqual({ kind: 'hidden' });
  });
});

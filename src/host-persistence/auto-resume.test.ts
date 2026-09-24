import { describe, expect, it } from 'vitest';
import { FakeStorage } from '../fake-storage';
import { saveHostSession, type HostSession } from './host-session-store';
import { resolveAutoResume } from './auto-resume';

function sessionFor(code: string, started: boolean): HostSession {
  return {
    room: { code, hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started },
    gameState: { roomId: code, status: started ? 'active' : 'lobby', activePlayerId: null, resolution: null, round: null, players: [] },
    roundEngineState: started ? { playerOrder: ['host-1'], points: { 'host-1': 100 }, challengeHistory: [], round: null } : null,
    firstRoundStarted: false,
    reconnectTokens: {},
  };
}

describe('resolveAutoResume', () => {
  it.each([
    { saved: 'a Lobby', started: false, pathname: '/room/ABCDEF', landingPath: 'room/ABCDEF' },
    { saved: 'a Lobby', started: false, pathname: '/room/ABCDEF/play', landingPath: 'room/ABCDEF' },
    { saved: 'a started game', started: true, pathname: '/room/ABCDEF', landingPath: 'room/ABCDEF/play' },
    { saved: 'a started game', started: true, pathname: '/base/room/ABCDEF/play', landingPath: 'room/ABCDEF/play' },
  ])("resumes $saved opened on $pathname, landing on '$landingPath'", ({ started, pathname, landingPath }) => {
    const storage = new FakeStorage();
    saveHostSession(storage, sessionFor('ABCDEF', started));

    expect(resolveAutoResume(storage, pathname)).toEqual({ kind: 'resume', session: sessionFor('ABCDEF', started), landingPath });
  });

  it.each([
    { where: 'the landing page', pathname: '/' },
    { where: 'the join page', pathname: '/join' },
    { where: "another Room's link, visited as a Guest", pathname: '/room/ZZZZZZ' },
  ])('does nothing when the app is opened on $where', ({ pathname }) => {
    const storage = new FakeStorage();
    saveHostSession(storage, sessionFor('ABCDEF', true));

    expect(resolveAutoResume(storage, pathname)).toEqual({ kind: 'none' });
  });

});

import { describe, expect, it } from 'vitest';
import type { GameState } from '../protocol/messages';
import { nextChallengeNotice, resolveChallengeChrome } from './challenge-notice';
import type { Room } from './room';

const room: Room = {
  code: 'ABCDEF',
  hostName: 'Host',
  hostPlayerId: 'host-1',
  players: [],
  playerCount: 2,
  started: true,
};

function stateWith(challengeId: string): GameState {
  return {
    roomId: 'ABCDEF',
    status: 'active',
    challengerId: 'p1',
    resolution: null,
    players: [],
    round: { challengerId: 'p1', challengeId, bets: [], outcome: null },
  };
}

describe('nextChallengeNotice', () => {
  it('raises a notice for the current Round key on a Redraw', () => {
    expect(nextChallengeNotice(null, { redrawn: true, gameState: stateWith('c2') })).toEqual({ roundKey: 'p1:c2', count: 1 });
  });

  it('bumps the count on a further Redraw', () => {
    expect(nextChallengeNotice({ roundKey: 'p1:c2', count: 1 }, { redrawn: true, gameState: stateWith('c3') })).toEqual({
      roundKey: 'p1:c3',
      count: 2,
    });
  });

  it('keeps the notice when nothing was redrawn or no Round is open', () => {
    const notice = { roundKey: 'p1:c2', count: 1 };
    expect(nextChallengeNotice(notice, { redrawn: false, gameState: stateWith('c2') })).toBe(notice);
    expect(nextChallengeNotice(notice, { redrawn: true, gameState: null })).toBe(notice);
  });
});

describe('resolveChallengeChrome', () => {
  it('shows the notice, shake and pop-in only while the notice matches the current Round', () => {
    expect(resolveChallengeChrome({ code: 'ABCDEF', room, gameState: stateWith('c2'), notice: { roundKey: 'p1:c2', count: 2 } })).toEqual({
      showRedraw: true,
      noticeCount: 2,
      cardClass: 'vb-task-card vb-shake',
      betFormClass: 'vb-bet-form vb-pop-in',
    });
  });

  it.each([
    ['a stale notice', stateWith('c3'), { roundKey: 'p1:c2', count: 1 }],
    ['no notice', stateWith('c2'), null],
    ['no game state', null, { roundKey: 'p1:c2', count: 1 }],
  ])('has no notice for %s', (_name, gameState, notice) => {
    expect(resolveChallengeChrome({ code: 'ABCDEF', room, gameState, notice })).toMatchObject({
      noticeCount: null,
      cardClass: 'vb-task-card',
      betFormClass: 'vb-bet-form',
    });
  });

  it.each([
    ['a Guest with no Room', 'ABCDEF', null],
    ['a Room for another code', 'ZZZZZZ', room],
    ['no code', undefined, room],
  ])('hides Redraw for %s', (_name, code, r) => {
    expect(resolveChallengeChrome({ code, room: r, gameState: stateWith('c1'), notice: null }).showRedraw).toBe(false);
  });
});

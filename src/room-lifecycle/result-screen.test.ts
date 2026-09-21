import { describe, expect, it } from 'vitest';
import type { GameState } from '../protocol/messages';
import { dismissResult, initialResultMemory, observeResolution, resolveResultScreen } from './result-screen';

function stateWith(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'ABCDEF',
    status: 'active',
    activePlayerId: 'guest-2',
    players: [
      { playerId: 'host-1', name: 'Host', points: 115, status: 'active', connected: true },
      { playerId: 'guest-1', name: 'Alex', points: 120, status: 'active', connected: true },
      { playerId: 'guest-2', name: 'Sam', points: 85, status: 'active', connected: true },
    ],
    round: null,
    resolution: {
      activePlayerId: 'host-1',
      outcome: 'YES',
      payouts: [
        { playerId: 'host-1', amount: 15 },
        { playerId: 'guest-1', amount: 20 },
        { playerId: 'guest-2', amount: -15 },
      ],
    },
    ...overrides,
  };
}

function screenFor(gameState: GameState, localPlayerId: string | null = 'guest-2') {
  return resolveResultScreen({ memory: observeResolution(initialResultMemory, gameState), localPlayerId });
}

describe('resolveResultScreen', () => {
  it('ranks every player by Points, labels the local player and the Active Player, and signs each Payout delta', () => {
    expect(screenFor(stateWith())).toEqual({
      background: 'vb-bg-success',
      title: 'Host succeeded 🎉',
      rows: [
        { playerId: 'guest-1', rank: 1, nameLabel: 'Alex', roleLabel: null, points: 120, deltaLabel: '+20', deltaClass: 'pos' },
        { playerId: 'host-1', rank: 2, nameLabel: 'Host', roleLabel: 'Active player', points: 115, deltaLabel: '+15', deltaClass: 'pos' },
        { playerId: 'guest-2', rank: 3, nameLabel: 'Sam (you)', roleLabel: null, points: 85, deltaLabel: '-15', deltaClass: 'neg' },
      ],
    });
  });

  it('shows a red failure screen for Outcome NO', () => {
    const screen = screenFor(
      stateWith({ resolution: { activePlayerId: 'host-1', outcome: 'NO', payouts: [{ playerId: 'guest-2', amount: 5 }] } }),
    );

    expect(screen?.background).toBe('vb-bg-fail');
    expect(screen?.title).toBe('Host failed 💥');
    expect(screen?.rows.find((row) => row.playerId === 'host-1')).toMatchObject({ deltaLabel: '+0', deltaClass: 'pos' });
  });

  it('gives tied players the same rank and skips the following rank, keeping roster order among them', () => {
    const screen = screenFor(
      stateWith({
        players: [
          { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true },
          { playerId: 'guest-1', name: 'Alex', points: 120, status: 'active', connected: true },
          { playerId: 'guest-2', name: 'Sam', points: 100, status: 'active', connected: true },
        ],
      }),
    );

    expect(screen?.rows.map((row) => [row.nameLabel, row.rank])).toEqual([
      ['Alex', 1],
      ['Host', 2],
      ['Sam (you)', 2],
    ]);
  });

  it('marks no row as the local player when the local identity is unknown', () => {
    expect(screenFor(stateWith(), null)?.rows.some((row) => row.nameLabel.includes('(you)'))).toBe(false);
  });

  it('exposes no Bet amount or Prediction on any row', () => {
    const keys = screenFor(stateWith())?.rows.flatMap((row) => Object.keys(row));

    expect(keys).not.toContain('bet');
    expect(keys).not.toContain('prediction');
    expect(keys).not.toContain('amount');
  });

  it('returns null for a device that never observed a Resolution', () => {
    expect(screenFor(stateWith({ resolution: null }))).toBeNull();
    expect(resolveResultScreen({ memory: observeResolution(initialResultMemory, null), localPlayerId: 'guest-2' })).toBeNull();
  });
});

describe('result screen memory', () => {
  const nextRoundOpen = stateWith({
    resolution: null,
    round: { activePlayerId: 'guest-1', challengeId: 'c-2', bets: [], outcome: null },
  });

  it('keeps showing the last observed Resolution after the Host starts the next Round', () => {
    const shown = observeResolution(initialResultMemory, stateWith());
    const afterNextRoundStarts = observeResolution(shown, nextRoundOpen);

    expect(resolveResultScreen({ memory: afterNextRoundStarts, localPlayerId: 'guest-2' })?.title).toBe('Host succeeded 🎉');
  });

  it('keeps the Points as they were when the Resolution was observed', () => {
    const shown = observeResolution(initialResultMemory, stateWith());
    const later = observeResolution(
      shown,
      stateWith({
        resolution: null,
        players: stateWith().players.map((player) => ({ ...player, points: 1 })),
      }),
    );

    expect(resolveResultScreen({ memory: later, localPlayerId: 'guest-2' })?.rows.map((row) => row.points)).toEqual([120, 115, 85]);
  });

  it('hides the result screen once dismissed, even while the same Resolution is still broadcast', () => {
    const shown = observeResolution(initialResultMemory, stateWith());
    const dismissed = observeResolution(dismissResult(shown), stateWith());

    expect(resolveResultScreen({ memory: dismissed, localPlayerId: 'guest-2' })).toBeNull();
  });

  it('stays hidden after dismissal when the next Round starts', () => {
    const dismissed = dismissResult(observeResolution(initialResultMemory, stateWith()));

    expect(resolveResultScreen({ memory: observeResolution(dismissed, nextRoundOpen), localPlayerId: 'guest-2' })).toBeNull();
  });

  it('shows a later Resolution again after an earlier one was dismissed, even when it is identical', () => {
    const dismissed = dismissResult(observeResolution(initialResultMemory, stateWith()));
    const roundStarted = observeResolution(dismissed, nextRoundOpen);
    const resolvedAgain = observeResolution(roundStarted, stateWith());

    expect(resolveResultScreen({ memory: resolvedAgain, localPlayerId: 'guest-2' })).not.toBeNull();
  });

  it('replaces an undismissed Resolution with a newer different one', () => {
    const shown = observeResolution(initialResultMemory, stateWith());
    const newer = observeResolution(
      shown,
      stateWith({ resolution: { activePlayerId: 'guest-1', outcome: 'NO', payouts: [] } }),
    );

    expect(resolveResultScreen({ memory: newer, localPlayerId: 'guest-2' })?.title).toBe('Alex failed 💥');
  });

  it('returns the same memory object when nothing changes, so callers can detect a no-op', () => {
    const shown = observeResolution(initialResultMemory, stateWith());

    expect(observeResolution(shown, stateWith())).toBe(shown);
  });
});

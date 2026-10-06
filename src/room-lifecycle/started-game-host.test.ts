import { describe, expect, it } from 'vitest';
import { challengeBank } from '../challenge-bank/challenge-bank';
import { FakeTransport } from '../transport/fake-transport';
import { GuestProtocol } from '../protocol/guest-protocol';
import type { GameState } from '../protocol/messages';
import { ConnectionManager } from './connection-manager';
import { resolveChallengeCard } from './challenge-card';
import { resolveBettingPanel } from './betting-panel';
import type { Room } from './room';

// `started: false` here, same as during the real Lobby phase — every test below joins its
// Guests via the fresh-`join` flow first, which is blocked once `started` is true, and only
// then calls `manager.startGame()` (mirroring `app.tsx`'s `handleStart`, which flips `Room.started`
// before starting the game).
function roomWith(players: Room['players']): Room {
  return { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players, playerCount: 1 + players.length, started: false };
}

async function connectGuest(hostId: string) {
  const guestTransport = new FakeTransport();
  await guestTransport.connect(hostId);
  return guestTransport;
}

async function joinGuest(hostId: string, name: string) {
  const guestTransport = await connectGuest(hostId);
  const protocol = new GuestProtocol(guestTransport);

  const welcome = new Promise<{ playerId: string; reconnectToken: string }>((resolve) => {
    protocol.on('welcome', (payload) => resolve(payload));
  });

  protocol.join({ name });

  return { guestTransport, ...(await welcome) };
}

describe('starting a round from the Host', () => {
  it('broadcasts the started Round from the shared GameState, and each device resolves its own Challenge visibility from that same state', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    let challengerId: string | undefined;
    const manager = new ConnectionManager(
      hostTransport,
      roomWith([]),
      () => {},
      (candidateIds) => candidateIds[0],
      (candidateIds) => challengerId ?? candidateIds[0],
    );
    const alex = await joinGuest(hostId, 'Alex');
    const sam = await joinGuest(hostId, 'Sam');
    challengerId = alex.playerId;

    const alexStates: GameState[] = [];
    const samStates: GameState[] = [];
    new GuestProtocol(alex.guestTransport).on('state', (payload) => alexStates.push(payload.snapshot));
    new GuestProtocol(sam.guestTransport).on('state', (payload) => samStates.push(payload.snapshot));

    manager.startGame();
    const hostState = manager.startRound();
    const guestState = alexStates.at(-1);

    expect(guestState?.round).toEqual({
      challengerId: alex.playerId,
      challengeId: challengeBank[0].id,
      bets: [],
      outcome: null,
    });

    expect(resolveChallengeCard({
      gameState: guestState ?? null,
      localPlayerId: alex.playerId,
      challengeBank,
      displayLanguage: 'en',
    })).toEqual({
      kind: 'hidden',
      challengeType: challengeBank[0].type,
      timeLimit: null,
      title: { key: 'challengeCard.hiddenTitle' },
      detail: { key: 'challengeCard.hiddenDetail' },
    });

    expect(resolveChallengeCard({
      gameState: samStates.at(-1) ?? null,
      localPlayerId: sam.playerId,
      challengeBank,
      displayLanguage: 'en',
    })).toEqual({
      kind: 'visible',
      challengeType: challengeBank[0].type,
      timeLimit: null,
      text: challengeBank[0].content.en,
      ...(challengeBank[0].illustration ? { illustration: challengeBank[0].illustration } : {}),
    });

    expect(resolveChallengeCard({
      gameState: hostState,
      localPlayerId: 'host-1',
      challengeBank,
      displayLanguage: 'en',
    })).toEqual({
      kind: 'visible',
      challengeType: challengeBank[0].type,
      timeLimit: null,
      text: challengeBank[0].content.en,
      ...(challengeBank[0].illustration ? { illustration: challengeBank[0].illustration } : {}),
    });
  });

  it('applies an incoming placeBet intent and rebroadcasts only public "has bet" state to every device', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    let challengerId: string | undefined;
    const manager = new ConnectionManager(
      hostTransport,
      roomWith([]),
      () => {},
      (candidateIds) => candidateIds[0],
      () => challengerId ?? 'host-1',
    );
    const alex = await joinGuest(hostId, 'Alex');
    const sam = await joinGuest(hostId, 'Sam');
    challengerId = alex.playerId;

    const alexStates: GameState[] = [];
    const samStates: GameState[] = [];
    const alexProtocol = new GuestProtocol(alex.guestTransport);
    const samProtocol = new GuestProtocol(sam.guestTransport);
    alexProtocol.on('state', (payload) => alexStates.push(payload.snapshot));
    samProtocol.on('state', (payload) => samStates.push(payload.snapshot));

    manager.startGame();
    manager.startRound();
    samProtocol.placeBet({ amount: 10, prediction: 'NO', challengeId: challengeBank[0].id });

    const alexState = alexStates.at(-1);
    const samState = samStates.at(-1);

    expect(alexState?.round?.bets).toEqual([{ playerId: sam.playerId }]);
    expect(samState?.round?.bets).toEqual([{ playerId: sam.playerId }]);

    expect(resolveBettingPanel({ gameState: alexState ?? null, localPlayerId: alex.playerId }).bettors).toEqual(
      expect.arrayContaining([expect.objectContaining({ playerId: sam.playerId, hasBet: true })]),
    );
  });

  it.each([
    { label: 'an invalid amount', bettor: 'sam', bet: { amount: 9999, prediction: 'NO' as const, challengeId: challengeBank[0].id }, reason: 'INVALID_BET_AMOUNT' },
    { label: 'a Challenger betting', bettor: 'alex', bet: { amount: 5, prediction: 'NO' as const, challengeId: challengeBank[0].id }, reason: 'CHALLENGER_CANNOT_BET' },
  ])('replies to only the Bettor with a rejected placeBet for $label', async ({ bettor, bet, reason }) => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    let challengerId: string | undefined;
    const manager = new ConnectionManager(
      hostTransport,
      roomWith([]),
      () => {},
      (candidateIds) => candidateIds[0],
      () => challengerId ?? 'host-1',
    );
    const alex = await joinGuest(hostId, 'Alex');
    const sam = await joinGuest(hostId, 'Sam');
    challengerId = alex.playerId;
    const guests = { alex, sam };
    const rejections: Record<string, unknown[]> = { alex: [], sam: [] };
    new GuestProtocol(alex.guestTransport).on('rejected', (payload) => rejections.alex.push(payload));
    new GuestProtocol(sam.guestTransport).on('rejected', (payload) => rejections.sam.push(payload));

    manager.startGame();
    manager.startRound();
    new GuestProtocol(guests[bettor as 'alex' | 'sam'].guestTransport).placeBet(bet);

    expect(rejections[bettor]).toEqual([{ reason, action: 'placeBet' }]);
    expect(rejections[bettor === 'sam' ? 'alex' : 'sam']).toEqual([]);
  });

  it('rejects a duplicate placeBet with DUPLICATE_BET while keeping the first Bet', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    let challengerId: string | undefined;
    const manager = new ConnectionManager(
      hostTransport,
      roomWith([]),
      () => {},
      (candidateIds) => candidateIds[0],
      () => challengerId ?? 'host-1',
    );
    const alex = await joinGuest(hostId, 'Alex');
    const sam = await joinGuest(hostId, 'Sam');
    challengerId = alex.playerId;
    const rejections: unknown[] = [];
    const samProtocol = new GuestProtocol(sam.guestTransport);
    samProtocol.on('rejected', (payload) => rejections.push(payload));

    manager.startGame();
    manager.startRound();
    samProtocol.placeBet({ amount: 10, prediction: 'NO', challengeId: challengeBank[0].id });
    samProtocol.placeBet({ amount: 10, prediction: 'NO', challengeId: challengeBank[0].id });

    expect(rejections).toEqual([{ reason: 'DUPLICATE_BET', action: 'placeBet' }]);
    expect(manager.gameState?.round?.bets).toEqual([{ playerId: sam.playerId }]);
  });

  it("notifies the Host's own onGameStateChange callback when a Guest's placeBet arrives, so the Host's own screen reflects it — not just the broadcast to other Guests", async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    let challengerId: string | undefined;
    const hostGameStates: GameState[] = [];
    const manager = new ConnectionManager(
      hostTransport,
      roomWith([]),
      () => {},
      (candidateIds) => candidateIds[0],
      () => challengerId ?? 'host-1',
      (gameState) => hostGameStates.push(gameState),
    );
    const sam = await joinGuest(hostId, 'Sam');
    challengerId = 'host-1';

    manager.startGame();
    manager.startRound();
    new GuestProtocol(sam.guestTransport).placeBet({ amount: 10, prediction: 'NO', challengeId: challengeBank[0].id });

    const latestHostState = hostGameStates.at(-1);
    expect(latestHostState?.round?.bets).toEqual([{ playerId: sam.playerId }]);
  });

  it.each([
    [
      'YES',
      { host: 115, alex: 120, sam: 85 },
      [
        { playerId: 'host-1', amount: 15 },
        { playerId: 'guest-1', amount: 20 },
        { playerId: 'guest-2', amount: -15 },
      ],
    ],
    [
      'NO',
      { host: 100, alex: 80, sam: 115 },
      [
        { playerId: 'guest-1', amount: -20 },
        { playerId: 'guest-2', amount: 15 },
      ],
    ],
  ] as const)(
    'applies a Host-submitted Outcome %s through the reducer and rebroadcasts the resolved GameState',
    async (outcome, expectedPoints, expectedPayouts) => {
      const hostTransport = new FakeTransport();
      const hostId = await hostTransport.connect();
      const hostGameStates: GameState[] = [];
      const manager = new ConnectionManager(
        hostTransport,
        roomWith([]),
        () => {},
        (candidateIds) => candidateIds[0],
        () => 'host-1',
        (gameState) => hostGameStates.push(gameState),
      );
      const alex = await joinGuest(hostId, 'Alex');
      const sam = await joinGuest(hostId, 'Sam');

      const alexStates: GameState[] = [];
      const samStates: GameState[] = [];
      const alexProtocol = new GuestProtocol(alex.guestTransport);
      const samProtocol = new GuestProtocol(sam.guestTransport);
      alexProtocol.on('state', (payload) => alexStates.push(payload.snapshot));
      samProtocol.on('state', (payload) => samStates.push(payload.snapshot));

      manager.startGame();
      manager.startRound();
      alexProtocol.placeBet({ amount: 20, prediction: 'YES', challengeId: challengeBank[0].id });
      samProtocol.placeBet({ amount: 15, prediction: 'NO', challengeId: challengeBank[0].id });

      const hostGameStatesBefore = hostGameStates.length;
      const alexStatesBefore = alexStates.length;
      const samStatesBefore = samStates.length;

      const hostState = manager.resolveRound(outcome);
      const alexState = alexStates.at(-1);
      const samState = samStates.at(-1);

      // Resolve broadcasts one state, not two — see the batching comment in resolveRound.
      expect(hostGameStates.length).toBe(hostGameStatesBefore + 1);
      expect(alexStates.length).toBe(alexStatesBefore + 1);
      expect(samStates.length).toBe(samStatesBefore + 1);

      expect(hostState).toMatchObject({
        roomId: 'ABCDEF',
        status: 'active',
        challengerId: alex.playerId,
        players: [
          { playerId: 'host-1', name: 'Host', points: expectedPoints.host, status: 'active', connected: true },
          { playerId: alex.playerId, name: 'Alex', points: expectedPoints.alex, status: 'active', connected: true },
          { playerId: sam.playerId, name: 'Sam', points: expectedPoints.sam, status: 'active', connected: true },
        ],
        // The next Round — for Alex, the next player in rotation after the Host — has already
        // auto-started, bundled into this same GameState alongside the Resolution below.
        round: {
          challengerId: alex.playerId,
          challengeId: challengeBank[1].id,
          bets: [],
          outcome: null,
        },
        resolution: {
          challengerId: 'host-1',
          outcome,
        },
      });
      expect(hostState.resolution?.payouts).toEqual(expect.arrayContaining(
        expectedPayouts.map((payout) => ({
          ...payout,
          playerId: payout.playerId === 'guest-1' ? alex.playerId : payout.playerId === 'guest-2' ? sam.playerId : payout.playerId,
        })),
      ));
      expect(alexState).toEqual(hostState);
      expect(samState).toEqual(hostState);
      expect(hostGameStates.at(-1)).toEqual(hostState);
    },
  );
});

describe('Host redraws the Challenge', () => {
  async function startedGame(challenger: 'host' | 'guest') {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    let challengerId = 'host-1';
    const hostStates: GameState[] = [];
    const manager = new ConnectionManager(
      hostTransport,
      roomWith([]),
      () => {},
      (candidateIds) => candidateIds[0],
      () => challengerId,
      (state) => hostStates.push(state),
    );
    const sam = await joinGuest(hostId, 'Sam');
    if (challenger === 'guest') challengerId = sam.playerId;
    const samProtocol = new GuestProtocol(sam.guestTransport);
    const samStates: GameState[] = [];
    const samRejections: { reason: string; action: string }[] = [];
    samProtocol.on('state', (payload) => samStates.push(payload.snapshot));
    samProtocol.on('rejected', (payload) => samRejections.push(payload));
    manager.startGame();
    manager.startRound();
    return { manager, sam, samProtocol, samStates, samRejections, hostStates, challengerId };
  }

  it('broadcasts a different Challenge with no Bets, the same Challenger and unchanged Points', async () => {
    const { manager, sam, samProtocol, samStates, challengerId } = await startedGame('host');
    samProtocol.placeBet({ amount: 10, prediction: 'YES', challengeId: challengeBank[0].id });
    expect(samStates.at(-1)?.round?.bets).toEqual([{ playerId: sam.playerId }]);

    manager.redrawChallenge();

    const state = samStates.at(-1);
    expect(state?.round).toEqual({ challengerId, challengeId: challengeBank[1].id, bets: [], outcome: null });
    expect(state?.players.map((player) => player.points)).toEqual([100, 100]);
    expect(manager.gameState).toEqual(state);
  });

  it('lets the Host redraw while being the Challenger, notifying its own screen too', async () => {
    const { manager, hostStates } = await startedGame('host');

    manager.redrawChallenge();

    expect(hostStates.at(-1)?.round?.challengerId).toBe('host-1');
    expect(hostStates.at(-1)?.round?.challengeId).toBe(challengeBank[1].id);
  });

  it('lets the Bettor bet again on the new Challenge after the old Bet was discarded', async () => {
    const { manager, sam, samProtocol, samStates, samRejections } = await startedGame('host');
    samProtocol.placeBet({ amount: 10, prediction: 'YES', challengeId: challengeBank[0].id });
    manager.redrawChallenge();

    samProtocol.placeBet({ amount: 20, prediction: 'NO', challengeId: challengeBank[1].id });

    expect(samRejections).toEqual([]);
    expect(samStates.at(-1)?.round?.bets).toEqual([{ playerId: sam.playerId }]);
  });

  it('refuses a Bet for the replaced Challenge with STALE_CHALLENGE and changes no state', async () => {
    const { manager, samProtocol, samStates, samRejections } = await startedGame('host');
    manager.redrawChallenge();
    const before = manager.gameState;

    samProtocol.placeBet({ amount: 10, prediction: 'YES', challengeId: challengeBank[0].id });

    expect(samRejections).toEqual([{ reason: 'STALE_CHALLENGE', action: 'placeBet' }]);
    expect(manager.gameState).toEqual(before);
    expect(samStates.at(-1)?.round?.bets).toEqual([]);
  });

  it('cannot redraw before a Round is in progress', async () => {
    const hostTransport = new FakeTransport();
    await hostTransport.connect();
    const manager = new ConnectionManager(hostTransport, roomWith([]), () => {});
    expect(() => manager.redrawChallenge()).toThrow();

    manager.startGame();
    expect(() => manager.redrawChallenge()).toThrow();
  });
});

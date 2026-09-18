import { describe, expect, it } from 'vitest';
import { challengeBank } from '../challenge-bank/challenge-bank';
import { FakeTransport } from '../transport/fake-transport';
import { GuestProtocol } from '../protocol/guest-protocol';
import type { GameState } from '../protocol/messages';
import { ConnectionManager } from './connection-manager';
import { resolveChallengeCard } from './challenge-card';
import { resolveBettingPanel } from './betting-panel';
import type { Room } from './room';

function roomWith(players: Room['players']): Room {
  return { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players, playerCount: 1 + players.length, started: true };
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
    let activePlayerId: string | undefined;
    const manager = new ConnectionManager(
      hostTransport,
      roomWith([]),
      () => {},
      (candidateIds) => candidateIds[0],
      (candidateIds) => activePlayerId ?? candidateIds[0],
    );
    const alex = await joinGuest(hostId, 'Alex');
    const sam = await joinGuest(hostId, 'Sam');
    activePlayerId = alex.playerId;

    const alexStates: GameState[] = [];
    const samStates: GameState[] = [];
    new GuestProtocol(alex.guestTransport).on('state', (payload) => alexStates.push(payload));
    new GuestProtocol(sam.guestTransport).on('state', (payload) => samStates.push(payload));

    manager.startGame();
    const hostState = manager.startRound();
    const guestState = alexStates.at(-1);

    expect(guestState?.round).toEqual({
      activePlayerId: alex.playerId,
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
      title: '🙈 Hidden from you',
      detail: 'Get ready to attempt it.',
    });

    expect(resolveChallengeCard({
      gameState: samStates.at(-1) ?? null,
      localPlayerId: sam.playerId,
      challengeBank,
      displayLanguage: 'en',
    })).toEqual({
      kind: 'visible',
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
      text: challengeBank[0].content.en,
      ...(challengeBank[0].illustration ? { illustration: challengeBank[0].illustration } : {}),
    });
  });

  it('applies an incoming placeBet intent and rebroadcasts only public "has bet" state to every device', async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    let activePlayerId: string | undefined;
    const manager = new ConnectionManager(
      hostTransport,
      roomWith([]),
      () => {},
      (candidateIds) => candidateIds[0],
      () => activePlayerId ?? 'host-1',
    );
    const alex = await joinGuest(hostId, 'Alex');
    const sam = await joinGuest(hostId, 'Sam');
    activePlayerId = alex.playerId;

    const alexStates: GameState[] = [];
    const samStates: GameState[] = [];
    const alexProtocol = new GuestProtocol(alex.guestTransport);
    const samProtocol = new GuestProtocol(sam.guestTransport);
    alexProtocol.on('state', (payload) => alexStates.push(payload));
    samProtocol.on('state', (payload) => samStates.push(payload));

    manager.startGame();
    manager.startRound();
    samProtocol.placeBet({ amount: 10, prediction: 'NO' });

    const alexState = alexStates.at(-1);
    const samState = samStates.at(-1);

    expect(alexState?.round?.bets).toEqual([{ playerId: sam.playerId }]);
    expect(samState?.round?.bets).toEqual([{ playerId: sam.playerId }]);

    expect(resolveBettingPanel({ gameState: alexState ?? null, localPlayerId: alex.playerId }).bettors).toEqual(
      expect.arrayContaining([expect.objectContaining({ playerId: sam.playerId, hasBet: true })]),
    );
  });

  it("notifies the Host's own onGameStateChange callback when a Guest's placeBet arrives, so the Host's own screen reflects it — not just the broadcast to other Guests", async () => {
    const hostTransport = new FakeTransport();
    const hostId = await hostTransport.connect();
    let activePlayerId: string | undefined;
    const hostGameStates: GameState[] = [];
    const manager = new ConnectionManager(
      hostTransport,
      roomWith([]),
      () => {},
      (candidateIds) => candidateIds[0],
      () => activePlayerId ?? 'host-1',
      (gameState) => hostGameStates.push(gameState),
    );
    const sam = await joinGuest(hostId, 'Sam');
    activePlayerId = 'host-1';

    manager.startGame();
    manager.startRound();
    new GuestProtocol(sam.guestTransport).placeBet({ amount: 10, prediction: 'NO' });

    const latestHostState = hostGameStates.at(-1);
    expect(latestHostState?.round?.bets).toEqual([{ playerId: sam.playerId }]);
  });
});

import { describe, expect, it } from 'vitest';
import { challengeBank } from '../challenge-bank/challenge-bank';
import { FakeTransport } from '../transport/fake-transport';
import { GuestProtocol } from '../protocol/guest-protocol';
import type { GameState } from '../protocol/messages';
import { ConnectionManager } from './connection-manager';
import { resolveChallengeCard } from './challenge-card';
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
});

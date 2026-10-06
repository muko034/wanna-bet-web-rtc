import type { Message } from '../i18n/dictionaries';
import type { GameState } from '../protocol/messages';
import { hasPlacedBet } from './betting-panel';
import type { Room } from './room';
import { isHostRoom } from './room-role';

export type RoundControls =
  | { kind: 'hidden' }
  /** The Host's judging screen: shown only once every Bettor has bet. */
  | { kind: 'judge-round'; title: Message; background: 'vb-bg-judge' }
  /** Every Guest sat out, so there is nobody to bet or judge: the Host can only end the game. */
  | { kind: 'no-active-guests'; background: 'vb-bg-wait' };

type Params = {
  code: string | undefined;
  room: Room | null;
  gameState: GameState | null;
};

export function resolveRoundControls({ code, room, gameState }: Params): RoundControls {
  if (!room || !isHostRoom(code, room) || !gameState) {
    return { kind: 'hidden' };
  }

  const guests = gameState.players.filter((player) => player.playerId !== room.hostPlayerId && player.status !== 'removed');
  if (gameState.status === 'active' && guests.length > 0 && guests.every((guest) => guest.status === 'paused')) {
    return { kind: 'no-active-guests', background: 'vb-bg-wait' };
  }

  if (!gameState.round) {
    return { kind: 'hidden' };
  }

  const { round } = gameState;
  const bettors = gameState.players.filter((player) => player.playerId !== round.challengerId && player.status !== 'paused');
  const allBetsIn = bettors.every((bettor) => hasPlacedBet(round, bettor.playerId));
  const challengerName = gameState.players.find((player) => player.playerId === round.challengerId)?.name;
  return allBetsIn && challengerName
    ? { kind: 'judge-round', title: { key: 'judge.title', params: { name: challengerName } }, background: 'vb-bg-judge' }
    : { kind: 'hidden' };
}

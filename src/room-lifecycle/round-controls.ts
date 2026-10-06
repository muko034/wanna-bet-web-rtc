import type { GameState } from '../protocol/messages';
import { hasPlacedBet } from './betting-panel';
import type { Room } from './room';
import { isHostRoom } from './room-role';

export type RoundControls =
  | { kind: 'hidden' }
  /** The Host's judging screen: shown only once every Bettor has bet. */
  | { kind: 'judge-round'; challengerName: string; background: 'vb-bg-judge' };

type Params = {
  code: string | undefined;
  room: Room | null;
  gameState: GameState | null;
};

export function resolveRoundControls({ code, room, gameState }: Params): RoundControls {
  if (!isHostRoom(code, room) || !gameState?.round) {
    return { kind: 'hidden' };
  }

  const { round } = gameState;
  const bettors = gameState.players.filter((player) => player.playerId !== round.challengerId);
  const allBetsIn = bettors.every((bettor) => hasPlacedBet(round, bettor.playerId));
  const challengerName = gameState.players.find((player) => player.playerId === round.challengerId)?.name;
  return allBetsIn && challengerName
    ? { kind: 'judge-round', challengerName, background: 'vb-bg-judge' }
    : { kind: 'hidden' };
}

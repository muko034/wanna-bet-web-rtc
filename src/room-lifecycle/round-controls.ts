import type { GameState } from '../protocol/messages';
import { hasPlacedBet } from './betting-panel';
import type { Room } from './room';

export type RoundControls =
  | { kind: 'hidden' }
  /** The Host's judging screen: shown only once every Bettor has bet. */
  | { kind: 'judge-round'; activePlayerName: string; background: 'vb-bg-judge' };

type Params = {
  code: string | undefined;
  room: Room | null;
  gameState: GameState | null;
};

export function resolveRoundControls({ code, room, gameState }: Params): RoundControls {
  if (!code || !room || room.code !== code || !gameState?.round) {
    return { kind: 'hidden' };
  }

  const { round } = gameState;
  const bettors = gameState.players.filter((player) => player.playerId !== round.activePlayerId);
  const allBetsIn = bettors.every((bettor) => hasPlacedBet(round, bettor.playerId));
  const activePlayerName = gameState.players.find((player) => player.playerId === round.activePlayerId)?.name;
  return allBetsIn && activePlayerName
    ? { kind: 'judge-round', activePlayerName, background: 'vb-bg-judge' }
    : { kind: 'hidden' };
}

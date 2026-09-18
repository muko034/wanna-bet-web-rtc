import type { GameState } from '../protocol/messages';
import type { Room } from './room';

export type RoundControls =
  | { kind: 'hidden' }
  | { kind: 'resolve-round' }
  | { kind: 'start-round'; activePlayerName: string };

type Params = {
  code: string | undefined;
  room: Room | null;
  gameState: GameState | null;
};

export function resolveRoundControls({ code, room, gameState }: Params): RoundControls {
  if (!code || !room || room.code !== code || !gameState) {
    return { kind: 'hidden' };
  }

  if (gameState.round) {
    return { kind: 'resolve-round' };
  }

  const activePlayerName = gameState.players.find((player) => player.playerId === gameState.activePlayerId)?.name;
  return activePlayerName
    ? { kind: 'start-round', activePlayerName }
    : { kind: 'hidden' };
}

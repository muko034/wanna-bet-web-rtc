import type { GameState } from '../protocol/messages';

type Params = {
  gameState: GameState | null;
  /** The Room Code this screen is for; a `state` of another Room says nothing about this Guest. */
  code: string | undefined;
  /** `null` until this device's identity is known. */
  localPlayerId: string | null;
};

/** Whether the Host's `state` lists this device's own player as removed. */
export function isRemovedFromGame({ gameState, code, localPlayerId }: Params): boolean {
  if (gameState === null || gameState.roomId !== code) {
    return false;
  }
  return gameState.players.some((player) => player.playerId === localPlayerId && player.status === 'removed');
}

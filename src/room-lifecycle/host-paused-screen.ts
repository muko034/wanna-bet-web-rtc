import type { Message } from '../i18n/dictionaries';
import type { GameState } from '../protocol/messages';

export type HostPausedScreen = {
  title: Message;
  subtitle: Message;
  background: 'vb-bg-wait';
};

type Params = {
  gameState: GameState | null;
  /** `null` until this device's identity is known. */
  localPlayerId: string | null;
};

/** The screen a Guest sees while the Host has paused them, or `null` for everyone else. */
export function resolveHostPausedScreen({ gameState, localPlayerId }: Params): HostPausedScreen | null {
  const local = gameState?.players.find((player) => player.playerId === localPlayerId);
  if (local?.status !== 'paused' || local.pausedBy !== 'host') {
    return null;
  }
  return { title: { key: 'hostPaused.title' }, subtitle: { key: 'hostPaused.subtitle' }, background: 'vb-bg-wait' };
}

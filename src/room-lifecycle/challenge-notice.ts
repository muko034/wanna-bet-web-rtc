import type { GameState } from '../protocol/messages';
import { roundKeyOf } from './bet-delivery';
import { isHostRoom } from './room-role';
import type { Room } from './room';

/** The "Challenge changed" notice a Redraw raised; it belongs to the Round key it announced. */
export type ChallengeNotice = { roundKey: string; count: number };

/** Folds a new state into the stored notice: a Redraw raises it (or bumps its count) for the current Round. */
export function nextChallengeNotice(
  notice: ChallengeNotice | null,
  { redrawn, gameState }: { redrawn: boolean; gameState: GameState | null },
): ChallengeNotice | null {
  const roundKey = gameState ? roundKeyOf(gameState) : null;
  if (!redrawn || !roundKey) return notice;
  return { roundKey, count: (notice?.count ?? 0) + 1 };
}

export type ChallengeChrome = {
  /** Only the Host device may Redraw. */
  showRedraw: boolean;
  /** The active notice's replay count, or `null` once the screen has moved to another Round. */
  noticeCount: number | null;
  cardClass: 'vb-task-card' | 'vb-task-card vb-shake';
  betFormClass: 'vb-bet-form' | 'vb-bet-form vb-pop-in';
};

type Params = {
  code: string | undefined;
  room: Room | null;
  gameState: GameState | null;
  notice: ChallengeNotice | null;
};

export function resolveChallengeChrome({ code, room, gameState, notice }: Params): ChallengeChrome {
  const roundKey = gameState ? roundKeyOf(gameState) : null;
  const active = notice !== null && notice.roundKey === roundKey;
  return {
    showRedraw: isHostRoom(code, room),
    noticeCount: active ? notice.count : null,
    cardClass: active ? 'vb-task-card vb-shake' : 'vb-task-card',
    betFormClass: active ? 'vb-bet-form vb-pop-in' : 'vb-bet-form',
  };
}

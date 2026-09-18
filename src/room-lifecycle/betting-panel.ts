import type { GameState } from '../protocol/messages';

export type BettorStatus = {
  playerId: string;
  name: string;
  hasBet: boolean;
  isLocalPlayer: boolean;
};

export type BettingPanel =
  | { kind: 'hidden'; bettors: BettorStatus[] }
  | { kind: 'status'; bettors: BettorStatus[] }
  | { kind: 'submitted'; bettors: BettorStatus[] }
  | { kind: 'form'; bettors: BettorStatus[] };

type Params = {
  gameState: GameState | null;
  localPlayerId: string;
  locallySubmittedBet?: boolean;
};

/** Whether `playerId` has already placed a Bet in `round`, per the public broadcast state. */
export function hasPlacedBet(round: GameState['round'], playerId: string): boolean {
  return !!round?.bets.some((bet) => bet.playerId === playerId);
}

export function resolveBettingPanel({
  gameState,
  localPlayerId,
  locallySubmittedBet = false,
}: Params): BettingPanel {
  const round = gameState?.round;
  if (!round) {
    return { kind: 'hidden', bettors: [] };
  }

  const bettors = gameState.players
    .filter((player) => player.playerId !== round.activePlayerId)
    .map((player) => ({
      playerId: player.playerId,
      name: player.name,
      hasBet: hasPlacedBet(round, player.playerId),
      isLocalPlayer: player.playerId === localPlayerId,
    }));

  const localPlayer = gameState.players.find((player) => player.playerId === localPlayerId);
  if (!localPlayer || localPlayerId === round.activePlayerId) {
    return { kind: 'status', bettors };
  }

  if (hasPlacedBet(round, localPlayerId)) {
    return { kind: 'status', bettors };
  }

  if (locallySubmittedBet) {
    return { kind: 'submitted', bettors };
  }

  return { kind: 'form', bettors };
}

import type { GameState, PlaceBetPayload } from '../protocol/messages';
import { maxBetAmount } from '../round-engine/bet-cap';

export type BettorStatus = {
  playerId: string;
  name: string;
  hasBet: boolean;
  isLocalPlayer: boolean;
};

export type BettingBackground = 'vb-bg-bet' | 'vb-bg-wait';

export type BettingPanel =
  | { kind: 'hidden'; background: BettingBackground; bettors: BettorStatus[] }
  | { kind: 'status'; background: BettingBackground; bettors: BettorStatus[] }
  | {
      kind: 'locked';
      background: BettingBackground;
      bettors: BettorStatus[];
      /** The local player's own Bet, or `null` when this device no longer remembers it. */
      ownBet: PlaceBetPayload | null;
      waitingLabel: string;
    }
  | {
      kind: 'form';
      background: BettingBackground;
      bettors: BettorStatus[];
      points: number;
      maxBet: number;
    };

type Params = {
  gameState: GameState | null;
  /** `null` until this device's identity is known. */
  localPlayerId: string | null;
  /** The Bet this device sent for the current Round, which the Host's public broadcast never echoes back. */
  localBet?: PlaceBetPayload | null;
};

/** Whether `playerId` has already placed a Bet in `round`, per the public broadcast state. */
export function hasPlacedBet(round: GameState['round'], playerId: string): boolean {
  return !!round?.bets.some((bet) => bet.playerId === playerId);
}

function waitingLabel(waitingOnCount: number): string {
  if (waitingOnCount === 0) {
    return 'Everyone has bet.';
  }
  return `Waiting on ${waitingOnCount} more player${waitingOnCount === 1 ? '' : 's'}…`;
}

export function resolveBettingPanel({
  gameState,
  localPlayerId,
  localBet = null,
}: Params): BettingPanel {
  const round = gameState?.round;
  if (!round || localPlayerId === null) {
    return { kind: 'hidden', background: 'vb-bg-wait', bettors: [] };
  }

  const bettors = gameState.players
    .filter((player) => player.playerId !== round.activePlayerId)
    .map((player) => {
      const isLocalPlayer = player.playerId === localPlayerId;
      return {
        playerId: player.playerId,
        name: player.name,
        hasBet: hasPlacedBet(round, player.playerId) || (isLocalPlayer && localBet !== null),
        isLocalPlayer,
      };
    });

  const localPlayer = gameState.players.find((player) => player.playerId === localPlayerId);
  if (!localPlayer || localPlayerId === round.activePlayerId) {
    return { kind: 'status', background: 'vb-bg-wait', bettors };
  }

  if (localBet !== null || hasPlacedBet(round, localPlayerId)) {
    return {
      kind: 'locked',
      background: 'vb-bg-wait',
      bettors,
      ownBet: localBet,
      waitingLabel: waitingLabel(bettors.filter((bettor) => !bettor.hasBet).length),
    };
  }

  return {
    kind: 'form',
    background: 'vb-bg-bet',
    bettors,
    points: localPlayer.points,
    maxBet: maxBetAmount(localPlayer.points),
  };
}

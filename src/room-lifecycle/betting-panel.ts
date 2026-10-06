import type { GameState, PlaceBetPayload } from '../protocol/messages';

import { maxBetAmount } from '../round-engine/bet-cap';

/** The part of a Bet the Bettor sees on screen; the Challenge id is wire-only. */
type OwnBet = Pick<PlaceBetPayload, 'amount' | 'prediction'>;

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
      ownBet: OwnBet | null;
      waitingLabel: string;
      /** Shown under "Locked in" once the link to the Host has been down long enough to be worth mentioning. */
      reconnectingNotice: string | null;
    }
  | {
      kind: 'form';
      background: BettingBackground;
      bettors: BettorStatus[];
      points: number;
      maxBet: number;
      /** Shown when the last Bet locked in failed to reach the Host, so the Bettor can lock in again. */
      failureMessage: string | null;
    };

type Params = {
  gameState: GameState | null;
  /** `null` until this device's identity is known. */
  localPlayerId: string | null;
  /** The Bet this device sent for the current Round, which the Host's public broadcast never echoes back. */
  localBet?: OwnBet | null;
  /** The Bet this device last locked in for the current Round never reached the Host, so `localBet` no longer counts. */
  betFailed?: boolean;
  /** How long the link to the Host has been down, or `null` while it is up. */
  linkLostForMs?: number | null;
};

/** How long the link must be down before the Bettor is told about it; shorter gaps stay invisible. */
export const RECONNECT_NOTICE_DELAY_MS = 10_000;

/** Whether `playerId` has already placed a Bet in `round`, per the public broadcast state. */
export function hasPlacedBet(round: GameState['round'], playerId: string): boolean {
  return !!round?.bets.some((bet) => bet.playerId === playerId);
}

const BET_FAILED_MESSAGE = "Your Bet didn't go through — try again.";

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
  betFailed = false,
  linkLostForMs = null,
}: Params): BettingPanel {
  const round = gameState?.round;
  if (!round || localPlayerId === null) {
    return { kind: 'hidden', background: 'vb-bg-wait', bettors: [] };
  }

  // A Bet that never reached the Host is forgotten, so the Bettor gets the form back.
  const ownBet = betFailed ? null : localBet;

  const bettors = gameState.players
    .filter((player) => player.playerId !== round.challengerId && player.status !== 'paused')
    .map((player) => {
      const isLocalPlayer = player.playerId === localPlayerId;
      return {
        playerId: player.playerId,
        name: player.name,
        hasBet: hasPlacedBet(round, player.playerId) || (isLocalPlayer && ownBet !== null),
        isLocalPlayer,
      };
    });

  const localPlayer = gameState.players.find((player) => player.playerId === localPlayerId);
  if (!localPlayer || localPlayerId === round.challengerId) {
    return { kind: 'status', background: 'vb-bg-wait', bettors };
  }

  if (ownBet !== null || hasPlacedBet(round, localPlayerId)) {
    return {
      kind: 'locked',
      background: 'vb-bg-wait',
      bettors,
      ownBet,
      waitingLabel: waitingLabel(bettors.filter((bettor) => !bettor.hasBet).length),
      reconnectingNotice: linkLostForMs !== null && linkLostForMs >= RECONNECT_NOTICE_DELAY_MS ? 'Reconnecting…' : null,
    };
  }

  return {
    kind: 'form',
    background: 'vb-bg-bet',
    bettors,
    points: localPlayer.points,
    maxBet: maxBetAmount(localPlayer.points),
    failureMessage: betFailed ? BET_FAILED_MESSAGE : null,
  };
}

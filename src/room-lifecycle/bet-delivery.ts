import type { GameState, PlaceBetPayload } from '../protocol/messages';
import type { BetRejection } from '../round-engine/round-engine';
import { hasPlacedBet } from './betting-panel';

/** How long a sent Bet may go without a confirming `state` before the link is treated as lost. */
export const BET_CONFIRMATION_TIMEOUT_MS = 4_000;

/** Identifies whose Bet this is and in which Round, so later `state` broadcasts can confirm it. */
export type PlaceBetContext = { roundKey: string; playerId: string };

type PendingBet = PlaceBetContext & {
  payload: PlaceBetPayload;
};

/** Identifies a Round on the Guest side; `null` when no Round is open. */
export function roundKeyOf(state: GameState): string | null {
  return state.round ? `${state.round.challengerId}:${state.round.challengeId}` : null;
}

/**
 * Keeps a Guest's locked-in Bet queued until the Host's `state` broadcast shows it applied.
 * A Bet still unconfirmed after `BET_CONFIRMATION_TIMEOUT_MS` means the link is dead, so it is
 * reported through `onLinkLost`; the Bet is sent again when the sender is replaced. It fails
 * only when the Host refuses it or the caller gives up (`failPending`). Deliberately unaware of
 * transports: the caller hands over the current send function via `setSender` (`null` while
 * disconnected), so it survives reconnects, which replace the transport.
 */
export class BetDelivery {
  private sender: ((payload: PlaceBetPayload) => void) | null = null;
  private pending: PendingBet | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly onFailed: (roundKey: string) => void;
  private readonly onLinkLost: () => void;

  /**
   * `onFailed` receives the failed Bet's round key, once the Host refused it or the caller gave up.
   * `onLinkLost` is called when a sent Bet goes unconfirmed, as the cue to start reconnecting.
   */
  constructor(onFailed: (roundKey: string) => void, onLinkLost: () => void) {
    this.onFailed = onFailed;
    this.onLinkLost = onLinkLost;
  }

  /** Supplies the live send function, or `null` while disconnected. A new sender sends the pending Bet immediately. */
  setSender(sender: ((payload: PlaceBetPayload) => void) | null): void {
    this.sender = sender;
    this.clearTimer();
    this.send();
  }

  place(bet: PlaceBetContext & { payload: PlaceBetPayload }): void {
    this.pending = bet;
    this.clearTimer();
    this.send();
  }

  /** Confirms the pending Bet, or forgets it when its Round is over. */
  onState(state: GameState): void {
    if (!this.pending) return;
    const key = roundKeyOf(state);
    const { roundKey, playerId } = this.pending;
    if (key !== roundKey || hasPlacedBet(state.round, playerId)) {
      this.settle();
    }
  }

  /**
   * The Host refused the Bet. A `DUPLICATE_BET` means an earlier send of this same Bet was
   * already applied, so its confirming `state` is what to keep waiting for. A `STALE_CHALLENGE`
   * means a Redraw replaced the Challenge: the Bet is dropped without a failure, since the
   * next `state` already shows the new Challenge and an empty bet form.
   */
  onRejected(reason: BetRejection): void {
    if (reason === 'DUPLICATE_BET') return;
    if (reason === 'STALE_CHALLENGE') {
      this.settle();
      return;
    }
    this.failPending();
  }

  failPending(): void {
    if (!this.pending) return;
    const { roundKey } = this.pending;
    this.settle();
    this.onFailed(roundKey);
  }

  private send(): void {
    if (!this.pending || !this.sender) return;
    this.sender(this.pending.payload);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onLinkLost();
    }, BET_CONFIRMATION_TIMEOUT_MS);
  }

  private settle(): void {
    this.pending = null;
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

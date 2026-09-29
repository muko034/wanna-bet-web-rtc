import type { GameState, PlaceBetPayload } from '../protocol/messages';

/** How long to wait for a confirming `state` before resending the Bet. */
const RETRY_INTERVAL_MS = 4_000;
const MAX_ATTEMPTS = 3;

type PendingBet = {
  roundKey: string;
  playerId: string;
  payload: PlaceBetPayload;
  attempts: number;
};

/** Identifies a Round on the Guest side; `null` when no Round is open. */
export function roundKeyOf(state: GameState): string | null {
  return state.round ? `${state.round.activePlayerId}:${state.round.challengeId}` : null;
}

/**
 * Keeps a Guest's locked-in Bet queued and resends it until the Host's `state` broadcast shows
 * it applied. Deliberately unaware of transports: the caller hands over the current send
 * function via `setSender` (`null` while disconnected), so it survives reconnects, which
 * replace the transport.
 */
export class BetDelivery {
  private sender: ((payload: PlaceBetPayload) => void) | null = null;
  private pending: PendingBet | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly onFailed: (roundKey: string) => void;

  /** `onFailed` receives the failed Bet's round key, once retries are exhausted or the Host refused it. */
  constructor(onFailed: (roundKey: string) => void) {
    this.onFailed = onFailed;
  }

  /** Supplies the live send function, or `null` while disconnected. Reconnecting resends a pending Bet at once. */
  setSender(sender: ((payload: PlaceBetPayload) => void) | null): void {
    this.sender = sender;
    this.clearTimer();
    if (sender) {
      this.attempt();
    }
  }

  place(bet: { roundKey: string; playerId: string; payload: PlaceBetPayload }): void {
    this.pending = { ...bet, attempts: 0 };
    this.clearTimer();
    this.attempt();
  }

  /** Confirms the pending Bet, or forgets it when its Round is over. */
  onState(state: GameState): void {
    if (!this.pending) return;
    const key = roundKeyOf(state);
    const applied = key === this.pending.roundKey && state.round!.bets.some((bet) => bet.playerId === this.pending!.playerId);
    if (applied || key !== this.pending.roundKey) {
      this.settle();
    }
  }

  /**
   * The Host refused the Bet. A `DUPLICATE_BET` means an earlier send of this same Bet was
   * already applied, so its confirming `state` is what to keep waiting for.
   */
  onRejected(reason: string): void {
    if (reason === 'DUPLICATE_BET') return;
    this.failPending();
  }

  failPending(): void {
    if (!this.pending) return;
    const { roundKey } = this.pending;
    this.settle();
    this.onFailed(roundKey);
  }

  private attempt(): void {
    if (!this.pending || !this.sender) return;
    if (this.pending.attempts >= MAX_ATTEMPTS) {
      this.failPending();
      return;
    }
    this.pending.attempts++;
    this.sender(this.pending.payload);
    this.timer = setTimeout(() => this.attempt(), RETRY_INTERVAL_MS);
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

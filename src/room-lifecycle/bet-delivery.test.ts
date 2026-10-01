import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState, PlaceBetPayload } from '../protocol/messages';
import { BetDelivery, roundKeyOf } from './bet-delivery';

const payload: PlaceBetPayload = { amount: 10, prediction: 'YES' };
const ROUND = 'alex:c1';

function stateWith(betPlayerIds: string[], activePlayerId = 'alex', challengeId = 'c1'): GameState {
  return {
    roomId: 'ABCDEF',
    status: 'active',
    activePlayerId,
    players: [],
    round: { activePlayerId, challengeId, bets: betPlayerIds.map((playerId) => ({ playerId })), outcome: null },
    resolution: null,
  };
}

function setup() {
  const send = vi.fn();
  const onFailed = vi.fn();
  const onLinkLost = vi.fn();
  const delivery = new BetDelivery(onFailed, onLinkLost);
  delivery.setSender(send);
  const place = () => delivery.place({ roundKey: ROUND, playerId: 'sam', payload });
  return { send, onFailed, onLinkLost, delivery, place };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('BetDelivery', () => {
  it('derives the round key from the Active Player and Challenge', () => {
    expect(roundKeyOf(stateWith([]))).toBe(ROUND);
    expect(roundKeyOf({ ...stateWith([]), round: null })).toBeNull();
  });

  it('sends the Bet immediately and stops retrying once a state shows the Bettor as having bet', () => {
    const { send, onFailed, delivery, place } = setup();
    place();
    expect(send).toHaveBeenCalledExactlyOnceWith(payload);

    delivery.onState(stateWith(['sam']));
    vi.advanceTimersByTime(60_000);

    expect(send).toHaveBeenCalledTimes(1);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('does not treat a state without the Bettor\'s Bet as confirmation', () => {
    const { onLinkLost, delivery, place } = setup();
    place();
    delivery.onState(stateWith(['jo']));
    vi.advanceTimersByTime(4_000);
    expect(onLinkLost).toHaveBeenCalledOnce();
  });

  it('reports the link lost after 4 s without a confirming state, without resending into the dead link or failing', () => {
    const { send, onFailed, onLinkLost, place } = setup();
    place();

    vi.advanceTimersByTime(3_999);
    expect(onLinkLost).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(onLinkLost).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('holds the Bet while disconnected, however long, and sends it once when the connection is back', () => {
    const { send, onFailed, delivery, place } = setup();
    place();
    delivery.setSender(null);

    vi.advanceTimersByTime(120_000);
    expect(onFailed).not.toHaveBeenCalled();

    const newSend = vi.fn();
    delivery.setSender(newSend);
    expect(newSend).toHaveBeenCalledExactlyOnceWith(payload);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not count attempts: each reconnect resends once and an unconfirmed send reports the link lost again', () => {
    const { onFailed, onLinkLost, delivery, place } = setup();
    place();

    for (let i = 1; i <= 5; i++) {
      vi.advanceTimersByTime(4_000);
      expect(onLinkLost).toHaveBeenCalledTimes(i);
      delivery.setSender(null);
      const newSend = vi.fn();
      delivery.setSender(newSend);
      expect(newSend).toHaveBeenCalledExactlyOnceWith(payload);
    }

    expect(onFailed).not.toHaveBeenCalled();
  });

  it('holds a Bet locked in while disconnected until the connection is back', () => {
    const { send, onLinkLost, delivery } = setup();
    delivery.setSender(null);
    delivery.place({ roundKey: ROUND, playerId: 'sam', payload });
    vi.advanceTimersByTime(10_000);
    expect(send).not.toHaveBeenCalled();
    expect(onLinkLost).not.toHaveBeenCalled();

    delivery.setSender(send);
    expect(send).toHaveBeenCalledExactlyOnceWith(payload);
  });

  it('stops retrying and reports failure immediately on an explicit rejection', () => {
    const { send, onFailed, delivery, place } = setup();
    place();
    delivery.onRejected('INVALID_BET_AMOUNT');

    expect(onFailed).toHaveBeenCalledExactlyOnceWith(ROUND);
    vi.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('treats a DUPLICATE_BET rejection as a harmless duplicate: the earlier send was applied, so keep waiting for its state', () => {
    const { onFailed, delivery, place } = setup();
    place();
    delivery.onRejected('DUPLICATE_BET');
    expect(onFailed).not.toHaveBeenCalled();

    delivery.onState(stateWith(['sam']));
    vi.advanceTimersByTime(60_000);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('fails a pending Bet at once when told the reconnect fallback triggered', () => {
    const { send, onFailed, delivery, place } = setup();
    place();
    delivery.failPending();

    expect(onFailed).toHaveBeenCalledExactlyOnceWith(ROUND);
    vi.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('drops a pending Bet silently once the Round has moved on', () => {
    const { send, onFailed, delivery, place } = setup();
    place();
    delivery.onState(stateWith([], 'jo', 'c2'));
    vi.advanceTimersByTime(60_000);

    expect(send).toHaveBeenCalledTimes(1);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('ignores rejections, failures and states when nothing is pending', () => {
    const { onFailed, delivery } = setup();
    delivery.onRejected('INVALID_BET_AMOUNT');
    delivery.failPending();
    delivery.onState(stateWith([]));
    expect(onFailed).not.toHaveBeenCalled();
  });
});

import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { challengeBank } from '../challenge-bank/challenge-bank';
import { dictionaries, type MessageKey } from '../i18n/dictionaries';
import { LanguageProvider } from '../i18n/LanguageContext';
import { translate, type MessageParams } from '../i18n/translate';
import type { GameState } from '../protocol/messages';
import { StartedGame } from './StartedGame';
import { saveIdentity } from './player-identity';
import type { Room } from './room';

const CODE = 'ABCDEF';
const room: Room = { code: CODE, hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: true };

const host = { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true } as const;
const anna = { playerId: 'guest-1', name: 'Anna', points: 100, status: 'active', connected: true } as const;
const sam = { playerId: 'guest-2', name: 'Sam', points: 100, status: 'active', connected: true } as const;

const t = (key: MessageKey, params?: MessageParams) => translate(dictionaries.en, key, params);
const challengeText = challengeBank[0].content.en.split('\n')[0];

function stateWith(challengerId: string, betters: string[], players: GameState['players'] = [host, anna]): GameState {
  return {
    roomId: CODE,
    status: 'active',
    challengerId,
    resolution: null,
    round: { challengerId, challengeId: challengeBank[0].id, bets: betters.map((playerId) => ({ playerId })), outcome: null },
    players,
  };
}

function startedGame(role: 'host' | 'guest', gameState: GameState, onResolveRound = vi.fn()) {
  const noop = vi.fn();
  return (
    <LanguageProvider>
      <StartedGame
        code={CODE}
        room={role === 'host' ? room : null}
        guestGameStartedCode={role === 'guest' ? CODE : null}
        gameState={gameState}
        joinRequests={[]}
        onAdmitJoin={noop}
        onDeclineJoin={noop}
        onPlaceBet={noop}
        betFailedRoundKey={null}
        onReconnectGaveUp={noop}
        onResolveRound={onResolveRound}
        onPauseGuest={noop}
        onResumeGuest={noop}
        onRemoveGuest={noop}
        onRemoved={noop}
        onRedraw={noop}
        onGameStarted={noop}
        onGameState={noop}
        onPlaceBetReady={noop}
        onBetRejected={noop}
        onConnectionLost={noop}
        onLeave={noop}
        onSitOut={noop}
        onHostLeave={noop}
        createGuestTransport={() => {
          throw new Error('must not open a Guest transport');
        }}
        isSatOut={() => false}
      />
    </LanguageProvider>
  );
}

const verdictButton = (key: 'judge.success' | 'judge.fail') => screen.queryByRole('button', { name: t(key) });

describe('Judging on the Host screen', () => {
  it('keeps the Challenge on screen for a Host who is the only Bettor, so someone can read it to the Challenger', () => {
    render(startedGame('host', stateWith('guest-1', ['host-1'])));

    expect(screen.getByText(challengeText, { exact: false })).toBeTruthy();
    expect(screen.getByText(t('judge.title', { name: 'Anna' }))).toBeTruthy();
  });

  it.each([
    ['judge.success', 'YES'],
    ['judge.fail', 'NO'],
  ] as const)('gives the Outcome from the %s button', (key, outcome) => {
    const onResolveRound = vi.fn();
    render(startedGame('host', stateWith('guest-1', ['host-1']), onResolveRound));

    fireEvent.click(verdictButton(key)!);

    expect(onResolveRound).toHaveBeenCalledWith(outcome);
  });

  it('keeps the Redraw button on the Challenge card', () => {
    render(startedGame('host', stateWith('guest-1', ['host-1'])));

    expect(screen.getByRole('button', { name: 'Redraw Challenge' })).toBeTruthy();
  });

  it('hides the Challenge from a Host who is the Challenger, and still lets them judge', () => {
    render(startedGame('host', stateWith('host-1', ['guest-1'])));

    expect(screen.queryByText(challengeText, { exact: false })).toBeNull();
    expect(screen.getByText(t('challengeCard.hiddenTitle'))).toBeTruthy();
    expect(verdictButton('judge.success')).not.toBeNull();
  });

  it('shows no verdict buttons and no judging title while a Bet is still missing', () => {
    render(startedGame('host', stateWith('guest-1', [], [host, anna, sam])));

    expect(verdictButton('judge.success')).toBeNull();
    expect(screen.queryByText(t('judge.title', { name: 'Anna' }))).toBeNull();
  });

  it('paints the judging background once every Bet is in, and the waiting one before', () => {
    const { container, rerender } = render(startedGame('host', stateWith('guest-1', ['host-1'], [host, anna, sam])));
    expect(container.querySelector('.vb-phone')?.classList.contains('vb-bg-judge')).toBe(false);

    rerender(startedGame('host', stateWith('guest-1', ['host-1', 'guest-2'], [host, anna, sam])));

    expect(container.querySelector('.vb-phone')?.classList.contains('vb-bg-judge')).toBe(true);
  });
});

describe('Judging on a Guest screen', () => {
  const asGuest = (gameState: GameState) => {
    saveIdentity(localStorage, CODE, { playerId: sam.playerId, reconnectToken: 'token' });
    return render(startedGame('guest', gameState));
  };

  it('gives a Guest no verdict buttons, but the judging background once every Bet is in', () => {
    const { container } = asGuest(stateWith('guest-1', ['host-1', 'guest-2'], [host, anna, sam]));

    expect(verdictButton('judge.success')).toBeNull();
    expect(container.querySelector('.vb-phone')?.classList.contains('vb-bg-judge')).toBe(true);
  });

  it('paints the Challenger the waiting-for-Bets background until the last Bet lands', () => {
    saveIdentity(localStorage, CODE, { playerId: anna.playerId, reconnectToken: 'token' });
    const { container } = render(startedGame('guest', stateWith('guest-1', ['host-1'], [host, anna, sam])));

    expect(container.querySelector('.vb-phone')?.classList.contains('vb-bg-waiting-bets')).toBe(true);
  });
});

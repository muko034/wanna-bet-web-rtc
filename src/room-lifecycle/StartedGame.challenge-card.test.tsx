import { render } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { challengeBank } from '../challenge-bank/challenge-bank';
import { dictionaries } from '../i18n/dictionaries';
import { LanguageProvider } from '../i18n/LanguageContext';
import { translate } from '../i18n/translate';
import type { GameState } from '../protocol/messages';
import { StartedGame } from './StartedGame';
import type { Room } from './room';

const CODE = 'ABCDEF';
const room: Room = { code: CODE, hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: true };

const host = { playerId: 'host-1', name: 'Host', points: 100, status: 'active', connected: true } as const;
const anna = { playerId: 'guest-1', name: 'ola (2)', points: 100, status: 'active', connected: true } as const;

function stateWith(challengerId: string): GameState {
  return {
    roomId: CODE,
    status: 'active',
    challengerId,
    resolution: null,
    round: { challengerId, challengeId: challengeBank[0].id, bets: [], outcome: null },
    players: [host, anna],
  };
}

const noop = vi.fn();
function startedGame(gameState: GameState) {
  return (
    <LanguageProvider>
      <StartedGame
        code={CODE}
        room={room}
        guestGameStartedCode={null}
        gameState={gameState}
        joinRequests={[]}
        onAdmitJoin={noop}
        onDeclineJoin={noop}
        onPlaceBet={noop}
        betFailedRoundKey={null}
        onReconnectGaveUp={noop}
        onResolveRound={noop}
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
          throw new Error('Host view must not open a Guest transport');
        }}
        isSatOut={() => false}
      />
    </LanguageProvider>
  );
}

describe('StartedGame Challenger line', () => {
  it.each(['pl', 'en'] as const)('tells a Bettor whose turn it is, with the typed name, in %s', (language) => {
    localStorage.setItem('wanna-bet:language', language);

    const { container } = render(startedGame(stateWith('guest-1')));

    expect(container.querySelector('.vb-task-challenger')?.textContent).toBe(
      translate(dictionaries[language], 'challengeCard.challengerTurn', { name: 'ola (2)' }),
    );
  });

  it("shows the Challenger no such line on their own hidden card", () => {
    const { container } = render(startedGame(stateWith('host-1')));

    expect(container.querySelector('.vb-task-card')).not.toBeNull();
    expect(container.querySelector('.vb-task-challenger')).toBeNull();
  });
});

import { fireEvent, render, screen, within } from '@testing-library/preact';
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
const zed = { playerId: 'guest-1', name: 'Zed', points: 100, status: 'active', connected: true } as const;
const yara = { playerId: 'guest-2', name: 'Yara', points: 100, status: 'active', connected: true } as const;

function roundOf(challengerId: string, betters: string[]): GameState['round'] {
  return { challengerId, challengeId: challengeBank[0].id, bets: betters.map((playerId) => ({ playerId })), outcome: null };
}

function stateWith(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: CODE,
    status: 'active',
    challengerId: 'guest-1',
    resolution: null,
    round: roundOf('guest-1', []),
    players: [host, zed],
    ...overrides,
  };
}

const bettingScreen = stateWith();
const waitingScreen = stateWith({ round: roundOf('guest-1', ['host-1']), players: [host, zed, yara] });
const judgingScreen = stateWith({ round: roundOf('guest-1', ['host-1']) });
const challengerHiddenCard = stateWith({ challengerId: 'host-1', round: roundOf('host-1', []) });
const hostPausedScreen = stateWith({ players: [host, zed, { ...yara, status: 'paused', pausedBy: 'host' }] });
const resultScreen: GameState = { ...bettingScreen, resolution: { challengerId: 'guest-1', outcome: 'YES', payouts: [] } };
const gameResultScreen: GameState = { ...bettingScreen, status: 'ended' };

const noop = vi.fn();
/** The local player is the Host unless `localPlayerId` names a Guest, who then holds a stored identity. */
function startedGame(gameState: GameState, localPlayerId = 'host-1') {
  const role = localPlayerId === host.playerId ? 'host' : 'guest';
  if (role === 'guest') {
    saveIdentity(localStorage, CODE, { playerId: localPlayerId, reconnectToken: 'token' });
  }
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

type Language = 'pl' | 'en';

const textIn = (language: Language) => (key: MessageKey, params?: MessageParams) =>
  translate(dictionaries[language], key, params);

/** Renders the Game in `language`, seeded the way a returning player's stored choice would be. */
function renderIn(language: Language, gameState: GameState, localPlayerId?: string) {
  localStorage.setItem('wanna-bet:language', language);
  return render(startedGame(gameState, localPlayerId));
}

describe('Rules Sheet button', () => {
  it.each([
    { screen: 'the betting screen', state: bettingScreen },
    { screen: 'the waiting screen', state: waitingScreen },
    { screen: 'the judging screen', state: judgingScreen },
    { screen: "the Challenger's hidden card", state: challengerHiddenCard },
    { screen: 'the host-paused screen', state: hostPausedScreen, localPlayerId: 'guest-2' },
  ])('shows on $screen', ({ state, localPlayerId }) => {
    renderIn('pl', state, localPlayerId);

    expect(screen.getByRole('button', { name: textIn('pl')('rules.open') })).toBeTruthy();
  });

  it('does not show on the Result Screen', () => {
    const t = textIn('pl');
    const { rerender } = renderIn('pl', bettingScreen);

    rerender(startedGame(resultScreen));

    expect(screen.getByText(t('result.nextRound'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('rules.open') })).toBeNull();
  });

  it('does not show on the Game Result Screen', () => {
    const t = textIn('pl');
    renderIn('pl', gameResultScreen);

    expect(screen.getByText(t('gameResult.home'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('rules.open') })).toBeNull();
  });
});

describe('Rules Sheet', () => {
  it.each(['pl', 'en'] as const)('opens when the button is tapped and closes when the backdrop is tapped, in %s', (language) => {
    const t = textIn(language);
    renderIn(language, bettingScreen);
    expect(screen.queryByRole('dialog', { name: t('rules.title') })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t('rules.open') }));
    const sheet = screen.getByRole('dialog', { name: t('rules.title') });

    fireEvent.click(sheet);
    expect(screen.getByRole('dialog', { name: t('rules.title') })).toBeTruthy();

    fireEvent.click(sheet.parentElement!);
    expect(screen.queryByRole('dialog', { name: t('rules.title') })).toBeNull();
  });
});

const SHEET_COPY = [
  'rules.flow.title',
  'rules.flow.challenger',
  'rules.flow.bets',
  'rules.flow.judge',
  'rules.flow.points',
  'rules.points.title',
  'rules.points.bettors',
  'rules.points.yes',
  'rules.points.no',
  'rules.points.floor',
  'rules.example.title',
  'rules.example.setup',
  'rules.example.yes',
  'rules.example.no',
] as const satisfies readonly MessageKey[];

const openSheet = (language: Language) => {
  const t = textIn(language);
  fireEvent.click(screen.getByRole('button', { name: t('rules.open') }));
  return within(screen.getByRole('dialog', { name: t('rules.title') }));
};

describe('Rules Sheet content', () => {
  it.each(['pl', 'en'] as const)('shows the round flow, formulas, floor note and worked example in %s', (language) => {
    const t = textIn(language);
    renderIn(language, bettingScreen);

    const sheet = openSheet(language);

    for (const key of SHEET_COPY) {
      expect(sheet.getByText(t(key)), key).toBeTruthy();
    }
  });

  it.each(['pl', 'en'] as const)('gives the worked example its fixed names and numbers for both Outcomes in %s', (language) => {
    renderIn(language, bettingScreen);

    const sheet = openSheet(language);

    expect(sheet.getByText(/Anna.*Ben.*30.*Cleo.*50.*Dan.*30.*N = 80.*Y = 30/)).toBeTruthy();
    expect(sheet.getByText(/Anna \+40.*Ben \+30.*Cleo −50.*Dan −30/)).toBeTruthy();
    expect(sheet.getByText(/Anna −15.*Ben −30.*Cleo \+50.*Dan \+30/)).toBeTruthy();
  });

  it("opens from the Challenger's hidden card", () => {
    const t = textIn('pl');
    renderIn('pl', challengerHiddenCard);

    const sheet = openSheet('pl');

    expect(sheet.getByText(t('rules.points.yes'))).toBeTruthy();
  });

  it('opens from the host-paused screen', () => {
    const t = textIn('pl');
    renderIn('pl', hostPausedScreen, 'guest-2');

    const sheet = openSheet('pl');

    expect(sheet.getByText(t('rules.points.no'))).toBeTruthy();
  });

  it("never shows the current Round's players or Bets", () => {
    renderIn('en', waitingScreen);

    const sheet = openSheet('en');

    expect(sheet.queryByText(/Zed|Yara/)).toBeNull();
  });

  it('follows the Display Language when the player switches it', () => {
    renderIn('pl', bettingScreen);
    const sheet = openSheet('pl');
    expect(sheet.getByText(textIn('pl')('rules.points.yes'))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    expect(sheet.getByText(textIn('en')('rules.points.yes'))).toBeTruthy();
  });
});

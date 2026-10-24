import { fireEvent, render, screen } from '@testing-library/preact';
import type { ComponentChildren } from 'preact';
import { describe, expect, it, vi } from 'vitest';
import { NotFound } from './NotFound';
import { withBase } from './base-path';
import { LanguageProvider } from './i18n/LanguageContext';
import { dictionaries } from './i18n/dictionaries';
import { translate } from './i18n/translate';
import { CreateRoom } from './room-lifecycle/CreateRoom';
import { Home } from './room-lifecycle/Home';
import { JoinCode } from './room-lifecycle/JoinCode';
import { Lobby } from './room-lifecycle/Lobby';
import { ReconnectingScreen } from './room-lifecycle/ReconnectingScreen';
import { RemovedScreen } from './room-lifecycle/RemovedScreen';
import type { Room } from './room-lifecycle/room';

const room: Room = { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: false };

const exitName = (language: 'pl' | 'en') => translate(dictionaries[language], 'exit.label');
const exitButton = (language: 'pl' | 'en' = 'pl') => screen.queryByRole('link', { name: exitName(language) });

describe('the Exit button', () => {
  it.each([
    ['Create Room', <CreateRoom onRoomCreated={vi.fn()} />],
    ['Join Code', <JoinCode />],
    ['Lobby', <Lobby code={room.code} room={room} gameState={null} onStart={vi.fn()} onRemoveGuest={vi.fn()} />],
    ['reconnecting', <ReconnectingScreen roomCode="ABCDEF" />],
    ['removed', <RemovedScreen roomCode="ABCDEF" />],
  ] as [string, ComponentChildren][])('shows on the %s screen', (_name, screenUnderTest) => {
    render(screenUnderTest);

    expect(exitButton()).not.toBeNull();
  });

  it.each([
    ['Home', <Home />],
    ['Not Found', <NotFound />],
  ] as [string, ComponentChildren][])('is absent on the %s screen', (_name, screenUnderTest) => {
    render(screenUnderTest);

    expect(exitButton()).toBeNull();
  });

  it('is named in the chosen Display Language', () => {
    expect(exitName('en')).not.toBe(exitName('pl'));
    localStorage.setItem('wanna-bet:language', 'en');

    render(<LanguageProvider><CreateRoom onRoomCreated={vi.fn()} /></LanguageProvider>);

    expect(exitButton('en')).not.toBeNull();
  });

  it('leads to the Home screen and shows a door-arrow icon', () => {
    render(<CreateRoom onRoomCreated={vi.fn()} />);

    const exit = exitButton()!;

    expect(exit.getAttribute('href')).toBe(withBase('/'));
    expect(exit.querySelector('svg')).not.toBeNull();
  });

  it('leaves the Lobby at once, with no confirmation dialog', () => {
    render(<Lobby code={room.code} room={room} gameState={null} onStart={vi.fn()} onRemoveGuest={vi.fn()} />);

    fireEvent.click(exitButton()!);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(exitButton()!.getAttribute('href')).toBe(withBase('/'));
  });
});

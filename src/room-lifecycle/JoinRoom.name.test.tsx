import { fireEvent, render, screen } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dictionaries, type MessageKey } from '../i18n/dictionaries';
import { translate } from '../i18n/translate';
import { JoinRoom } from './JoinRoom';
import { hostStartedRoom, trackedGuestTransports } from './guest-test-harness';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const t = (key: MessageKey) => translate(dictionaries.pl, key);
const settle = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function renderJoinRoom(code: string) {
  const { createGuestTransport } = trackedGuestTransports();
  render(
    <JoinRoom
      code={code}
      onGameStarted={vi.fn()}
      onGameState={vi.fn()}
      gameState={null}
      onPlaceBetReady={vi.fn()}
      onBetRejected={vi.fn()}
      onConnectionLost={vi.fn()}
      createGuestTransport={createGuestTransport}
      isSatOut={() => false}
      onLeave={vi.fn()}
      onSitOut={vi.fn()}
      onRemoved={vi.fn()}
    />,
  );
}

const nameInput = () => screen.getByPlaceholderText(t('form.namePlaceholder')) as HTMLInputElement;
const joinButton = () => screen.getByRole('button', { name: t('joinRoom.submit') }) as HTMLButtonElement;
const typeName = (value: string) => fireEvent.input(nameInput(), { target: { value } });

describe('the Join form name', () => {
  it.each([
    ['empty', '', true],
    ['whitespace-only', '   ', true],
    ['a name', 'Anna', false],
    ['a name with surrounding spaces', '  Anna ', false],
  ])('Join is disabled for %s: %s', (_label, value, disabled) => {
    renderJoinRoom('ABCDEF');

    typeName(value);

    expect(joinButton().disabled).toBe(disabled);
  });

  it.each([
    ['typing a 17th character', 'a'.repeat(17), 'a'.repeat(16)],
    ['pasting a long text', 'b'.repeat(40), 'b'.repeat(16)],
    ['pasting emoji', '😀'.repeat(20), '😀'.repeat(16)],
    ['sixteen emoji', '😀'.repeat(16), '😀'.repeat(16)],
    ['sixteen accented letters', 'ą'.repeat(16), 'ą'.repeat(16)],
  ])('stops at 16 characters when %s', (_label, value, shown) => {
    renderJoinRoom('ABCDEF');

    typeName(value);

    expect(nameInput().value).toBe(shown);
    expect(joinButton().disabled).toBe(false);
  });

  it('asks the Host to join with the trimmed name', async () => {
    const { code, manager } = await hostStartedRoom();
    renderJoinRoom(code);
    typeName('  Latecomer ');

    fireEvent.submit(joinButton().closest('form')!);
    await settle();

    expect(manager.joinRequests.map((request) => request.name)).toEqual(['Latecomer']);
  });

  it('sends nothing when submitted with an invalid name', async () => {
    const { code, manager } = await hostStartedRoom();
    renderJoinRoom(code);
    typeName('   ');

    fireEvent.submit(joinButton().closest('form')!);
    await settle();

    expect(manager.joinRequests).toEqual([]);
    expect(screen.queryByText(t('joinRoom.waiting.title'))).toBeNull();
  });
});

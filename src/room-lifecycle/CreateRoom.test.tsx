import { fireEvent, render, screen } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { dictionaries, type MessageKey } from '../i18n/dictionaries';
import { translate } from '../i18n/translate';
import { FakeTransport } from '../transport/fake-transport';
import { CreateRoom } from './CreateRoom';

vi.mock('../transport/create-peerjs-transport', () => ({ createPeerJsTransport: () => new FakeTransport() }));

const t = (key: MessageKey) => translate(dictionaries.pl, key);
const nameInput = () => screen.getByPlaceholderText(t('form.namePlaceholder')) as HTMLInputElement;
const createButton = () => screen.getByRole('button', { name: t('createRoom.submit') }) as HTMLButtonElement;
const typeName = (value: string) => fireEvent.input(nameInput(), { target: { value } });

describe('the Create Room form name', () => {
  it.each([
    ['empty', '', true],
    ['whitespace-only', '   ', true],
    ['a name', 'Anna', false],
    ['a name with surrounding spaces', '  Anna ', false],
  ])('Create is disabled for %s: %s', (_label, value, disabled) => {
    render(<CreateRoom onRoomCreated={vi.fn()} />);

    typeName(value);

    expect(createButton().disabled).toBe(disabled);
  });

  it.each([
    ['typing a 17th character', 'a'.repeat(17), 'a'.repeat(16)],
    ['pasting a long text', 'b'.repeat(40), 'b'.repeat(16)],
    ['pasting emoji', '😀'.repeat(20), '😀'.repeat(16)],
    ['sixteen emoji', '😀'.repeat(16), '😀'.repeat(16)],
    ['sixteen accented letters', 'ą'.repeat(16), 'ą'.repeat(16)],
  ])('stops at 16 characters when %s', (_label, value, shown) => {
    render(<CreateRoom onRoomCreated={vi.fn()} />);

    typeName(value);

    expect(nameInput().value).toBe(shown);
    expect(createButton().disabled).toBe(false);
  });

  it('creates the Room with the trimmed name', async () => {
    const onRoomCreated = vi.fn();
    render(<CreateRoom onRoomCreated={onRoomCreated} />);
    typeName('  Anna ');

    await act(async () => { fireEvent.submit(createButton().closest('form')!); });

    expect(onRoomCreated).toHaveBeenCalledWith(expect.objectContaining({ hostName: 'Anna' }), expect.anything());
  });

  it('does not create a Room when submitted with an invalid name', async () => {
    const onRoomCreated = vi.fn();
    render(<CreateRoom onRoomCreated={onRoomCreated} />);
    typeName('   ');

    await act(async () => { fireEvent.submit(createButton().closest('form')!); });

    expect(onRoomCreated).not.toHaveBeenCalled();
  });
});

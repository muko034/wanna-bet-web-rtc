import { cleanup, render, screen } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyInviteButton } from './CopyInviteButton';

const COPIED_FEEDBACK_MS = 2_000;

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
});
afterEach(() => vi.useRealTimers());

const isCopied = (container: Element) => container.querySelector('polyline') !== null;
const clickCopy = () => act(async () => {
  screen.getByRole('button', { name: 'Copy invite link' }).click();
  await vi.advanceTimersByTimeAsync(0);
});
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('CopyInviteButton feedback timer', () => {
  it('shows the check mark until the delay passes', async () => {
    const { container } = render(<CopyInviteButton link="https://example.com/room/ABCDEF" />);

    await clickCopy();
    expect(isCopied(container)).toBe(true);

    advance(COPIED_FEEDBACK_MS - 1);
    expect(isCopied(container)).toBe(true);

    advance(1);
    expect(isCopied(container)).toBe(false);
  });

  it('starts the timer again after a second copy', async () => {
    const { container } = render(<CopyInviteButton link="https://example.com/room/ABCDEF" />);
    await clickCopy();
    advance(COPIED_FEEDBACK_MS);

    await clickCopy();
    advance(COPIED_FEEDBACK_MS - 1);
    expect(isCopied(container)).toBe(true);

    advance(1);
    expect(isCopied(container)).toBe(false);
  });

  it('clears the timer on unmount', async () => {
    render(<CopyInviteButton link="https://example.com/room/ABCDEF" />);
    await clickCopy();
    expect(vi.getTimerCount()).toBe(1);

    cleanup();

    expect(vi.getTimerCount()).toBe(0);
  });
});

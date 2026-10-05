import { describe, expect, it, vi } from 'vitest';
import { copyText, type CopyEnv } from './copy-text';

function envWith(overrides: Partial<CopyEnv>): CopyEnv {
  return { clipboard: undefined, execCommandCopy: vi.fn(() => true), ...overrides };
}

describe('copyText', () => {
  it('writes through the clipboard API when available', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const env = envWith({ clipboard: { writeText } });
    await copyText('hello', env);
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(env.execCommandCopy).not.toHaveBeenCalled();
  });

  it('falls back to execCommand when the clipboard API is missing', async () => {
    const env = envWith({});
    await copyText('hello', env);
    expect(env.execCommandCopy).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when the clipboard API rejects', async () => {
    const env = envWith({ clipboard: { writeText: () => Promise.reject(new Error('denied')) } });
    await copyText('hello', env);
    expect(env.execCommandCopy).toHaveBeenCalledWith('hello');
  });

  it('reports whether the copy succeeded', async () => {
    expect(await copyText('x', envWith({ clipboard: { writeText: () => Promise.resolve() } }))).toBe(true);
    expect(await copyText('x', envWith({ execCommandCopy: () => false }))).toBe(false);
  });
});

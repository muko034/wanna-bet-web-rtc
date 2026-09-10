import { describe, expect, it } from 'vitest';
import { RoomRegistry, ROOM_CODE_ALPHABET } from './room-registry';

describe('RoomRegistry', () => {
  it('registers a Transport ID under a 6-character, unambiguous-alphabet Room Code', () => {
    const registry = new RoomRegistry();

    const code = registry.register('transport-1');

    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]+$/);
    for (const char of code) {
      expect(ROOM_CODE_ALPHABET).toContain(char);
    }
  });

  it('resolves a registered Room Code back to its Transport ID', () => {
    const registry = new RoomRegistry();

    const code = registry.register('transport-1');

    expect(registry.resolve(code)).toBe('transport-1');
  });

  it('returns undefined when resolving a Room Code that was never registered', () => {
    const registry = new RoomRegistry();

    expect(registry.resolve('ZZZZZZ')).toBeUndefined();
  });

  it('retries generation when a freshly generated code collides with one already registered', () => {
    const codes = ['AAAAAA', 'AAAAAA', 'BBBBBB'];
    const registry = new RoomRegistry(() => codes.shift() ?? 'FALLBACK');

    registry.register('transport-1');
    const secondCode = registry.register('transport-2');

    expect(secondCode).toBe('BBBBBB');
    expect(registry.resolve('BBBBBB')).toBe('transport-2');
  });
});

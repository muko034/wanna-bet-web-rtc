import { describe, expect, it } from 'vitest';
import { RoomRegistry, ROOM_CODE_ALPHABET } from './room-registry';

describe('RoomRegistry', () => {
  it('generates a 6-character, unambiguous-alphabet Room Code', () => {
    const registry = new RoomRegistry();

    const code = registry.generate();

    expect(code).toHaveLength(6);
    for (const char of code) {
      expect(ROOM_CODE_ALPHABET).toContain(char);
    }
  });

  it('derives the same Transport ID from a Room Code every time, with no lookup involved', () => {
    const registry = new RoomRegistry();

    expect(registry.transportIdFor('ABCDEF')).toBe(registry.transportIdFor('ABCDEF'));
  });

  it('derives a Transport ID distinct from the Room Code itself', () => {
    const registry = new RoomRegistry();

    expect(registry.transportIdFor('ABCDEF')).not.toBe('ABCDEF');
  });

  it('derives different Transport IDs for different Room Codes', () => {
    const registry = new RoomRegistry();

    expect(registry.transportIdFor('AAAAAA')).not.toBe(registry.transportIdFor('BBBBBB'));
  });
});

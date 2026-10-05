import { describe, expect, it } from 'vitest';
import { resolveHomeDialog } from './home-dialog';
import type { Room } from './room';

const hostRoom: Room = { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: true };

describe('resolveHomeDialog', () => {
  it('offers a Guest a destructive Leave and a plain Cancel', () => {
    const result = resolveHomeDialog({ code: 'ABCDEF', room: null });

    expect(result.options).toEqual([
      { action: 'leave', label: 'Leave', style: 'destructive' },
      { action: 'cancel', label: 'Cancel', style: 'link' },
    ]);
  });

  it('offers the Host a primary Go Home and a plain Cancel', () => {
    const result = resolveHomeDialog({ code: 'ABCDEF', room: hostRoom });

    expect(result.options).toEqual([
      { action: 'go-home', label: 'Go Home', style: 'primary' },
      { action: 'cancel', label: 'Cancel', style: 'link' },
    ]);
  });

  it("treats a device whose own Room has another code as a Guest", () => {
    const result = resolveHomeDialog({ code: 'ZZZZZZ', room: hostRoom });

    expect(result.options.map((option) => option.action)).toEqual(['leave', 'cancel']);
  });
});

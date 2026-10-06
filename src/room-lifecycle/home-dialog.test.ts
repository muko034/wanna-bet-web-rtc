import { describe, expect, it } from 'vitest';
import { resolveHomeChoice, resolveHomeDialog } from './home-dialog';
import type { Room } from './room';

const hostRoom: Room = { code: 'ABCDEF', hostName: 'Host', hostPlayerId: 'host-1', players: [], playerCount: 1, started: true };

describe('resolveHomeDialog', () => {
  it('offers a Guest a destructive Leave, a primary Sit out and a plain Cancel', () => {
    const result = resolveHomeDialog({ code: 'ABCDEF', room: null });

    expect(result.options).toEqual([
      { action: 'leave', label: 'homeDialog.leave', style: 'destructive' },
      { action: 'sit-out', label: 'homeDialog.sitOut', style: 'primary' },
      { action: 'cancel', label: 'homeDialog.cancel', style: 'link' },
    ]);
  });

  it('offers the Host a destructive Leave, a primary Go Home and a plain Cancel', () => {
    const result = resolveHomeDialog({ code: 'ABCDEF', room: hostRoom });

    expect(result.options).toEqual([
      { action: 'leave', label: 'homeDialog.leave', style: 'destructive' },
      { action: 'go-home', label: 'homeDialog.goHome', style: 'primary' },
      { action: 'cancel', label: 'homeDialog.cancel', style: 'link' },
    ]);
  });

  it("treats a device whose own Room has another code as a Guest", () => {
    const result = resolveHomeDialog({ code: 'ZZZZZZ', room: hostRoom });

    expect(result.options.map((option) => option.action)).toEqual(['leave', 'sit-out', 'cancel']);
  });
});

describe('resolveHomeChoice', () => {
  it('Leave carries the Room code', () => {
    expect(resolveHomeChoice('leave', 'ABCDEF', null)).toEqual({ kind: 'leave', code: 'ABCDEF' });
  });

  it('Leave without a Room code changes nothing', () => {
    expect(resolveHomeChoice('leave', undefined, null)).toEqual({ kind: 'none' });
  });

  it("the Host's Leave ends the Room", () => {
    expect(resolveHomeChoice('leave', 'ABCDEF', hostRoom)).toEqual({ kind: 'host-leave' });
  });

  it('Sit out carries the Room code', () => {
    expect(resolveHomeChoice('sit-out', 'ABCDEF', null)).toEqual({ kind: 'sit-out', code: 'ABCDEF' });
  });

  it('Sit out without a Room code changes nothing', () => {
    expect(resolveHomeChoice('sit-out', undefined, null)).toEqual({ kind: 'none' });
  });

  it('Go Home goes Home', () => {
    expect(resolveHomeChoice('go-home', 'ABCDEF', null)).toEqual({ kind: 'go-home' });
  });

  it('Cancel changes nothing', () => {
    expect(resolveHomeChoice('cancel', 'ABCDEF', null)).toEqual({ kind: 'none' });
  });
});

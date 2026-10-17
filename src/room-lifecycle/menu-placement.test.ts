import { describe, expect, it } from 'vitest';
import { resolveMenuPlacement } from './menu-placement';

const AREA = { containerTop: 0, containerBottom: 600, menuHeight: 88 };

describe('resolveMenuPlacement', () => {
  it.each([
    ['plenty of room below', { triggerTop: 76, triggerBottom: 100 }, 'down'],
    ['the menu ending exactly at the bottom edge', { triggerTop: 488, triggerBottom: 512 }, 'down'],
    ['the menu clipping by one pixel', { triggerTop: 489, triggerBottom: 513 }, 'up'],
    ['a trigger on the last row', { triggerTop: 556, triggerBottom: 580 }, 'up'],
    ['no room above either, so it stays below and scrolls', { triggerTop: 40, triggerBottom: 64 }, 'down'],
    ['a trigger low on a tall sheet, with room above', { triggerTop: 300, triggerBottom: 590 }, 'up'],
  ] as const)('opens for %s', (_name, trigger, placement) => {
    expect(resolveMenuPlacement({ ...AREA, ...trigger })).toBe(placement);
  });
});

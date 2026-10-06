import { describe, expect, it } from 'vitest';
import { handleHomeClick } from './home-click';

function fakeClick() {
  const calls: string[] = [];
  return {
    calls,
    event: {
      preventDefault: () => calls.push('preventDefault'),
      stopPropagation: () => calls.push('stopPropagation'),
    },
  };
}

describe('handleHomeClick', () => {
  it('runs onHome and keeps the click away from the router, which would otherwise navigate Home as well', () => {
    const { calls, event } = fakeClick();

    handleHomeClick(event, () => calls.push('onHome'));

    expect(calls).toContain('onHome');
    expect(calls).toContain('preventDefault');
    expect(calls).toContain('stopPropagation');
  });
});

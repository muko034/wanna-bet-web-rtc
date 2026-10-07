import { cleanup } from '@testing-library/preact';
import { afterEach, vi } from 'vitest';
import { FakeTransport } from './transport/fake-transport';

// Shared reset for DOM component tests (`*.test.tsx`), so no test leaks state into the next.
afterEach(() => {
  cleanup();
  localStorage.clear();
  FakeTransport.resetNetwork();
  vi.useRealTimers();
});

import { describe, expect, it, vi } from 'vitest';
import { FakeStorage } from '../fake-storage';
import { detectLanguage, loadLanguage, saveLanguage } from './language-store';

describe('detectLanguage', () => {
  it.each([
    ['pl', 'pl'],
    ['pl-PL', 'pl'],
    ['en', 'en'],
    ['en-GB', 'en'],
    ['de-DE', 'pl'],
    ['', 'pl'],
  ])('maps %j to %s', (tag, expected) => {
    expect(detectLanguage(tag)).toBe(expected);
  });
});

describe('loadLanguage', () => {
  it('detects from the browser language when nothing is stored, without writing', () => {
    const storage = new FakeStorage();
    expect(loadLanguage(storage, 'en-US')).toBe('en');
    expect(storage.length).toBe(0);
  });

  it('prefers a stored valid value over detection', () => {
    const storage = new FakeStorage();
    storage.setItem('wanna-bet:language', 'en');
    expect(loadLanguage(storage, 'pl-PL')).toBe('en');
  });

  it('treats an invalid stored value as absent', () => {
    const storage = new FakeStorage();
    storage.setItem('wanna-bet:language', 'de');
    expect(loadLanguage(storage, 'en-US')).toBe('en');
  });
});

describe('saveLanguage', () => {
  it('round-trips through loadLanguage, deferring the write', () => {
    vi.useFakeTimers();
    const storage = new FakeStorage();
    saveLanguage(storage, 'en');
    expect(storage.getItem('wanna-bet:language')).toBeNull();
    vi.runAllTimers();
    expect(loadLanguage(storage, 'pl-PL')).toBe('en');
    vi.useRealTimers();
  });
});

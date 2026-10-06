import { describe, expect, it } from 'vitest';
import { en, pl } from './dictionaries';
import { translate } from './translate';

describe('translate', () => {
  it('fills {name} placeholders from params', () => {
    const dictionary = { 'home.title': 'Hi {name}, code {code}' };
    expect(translate(dictionary, 'home.title', { name: 'Ann', code: 'ABCD' })).toBe('Hi Ann, code ABCD');
  });

  it('returns the text unchanged when there are no params', () => {
    expect(translate({ 'home.title': 'Ready' }, 'home.title')).toBe('Ready');
  });
});

describe('dictionaries', () => {
  it('pl and en share the same keys', () => {
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
  });
});

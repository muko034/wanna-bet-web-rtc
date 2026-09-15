/// <reference types="node" />
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadChallengeBankFromYaml } from './load-from-yaml.ts';
import { challengeBank } from './challenge-bank.ts';
import { challengeBankEntrySchema } from './challenge-bank.schema.ts';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), 'data');

describe('challengeBank', () => {
  it('has one entry per YAML source file', () => {
    const sourceFileCount = readdirSync(dataDir).filter((name) => name.endsWith('.yaml')).length;
    expect(challengeBank).toHaveLength(sourceFileCount);
  });

  it('matches a fresh parse of its YAML source (run `npm run generate:challenge-bank` if this fails)', () => {
    expect(challengeBank).toEqual(loadChallengeBankFromYaml(dataDir));
  });

  it('has every entry matching the ChallengeBankEntry contract', () => {
    for (const entry of challengeBank) {
      expect(challengeBankEntrySchema.safeParse(entry).success).toBe(true);
    }
  });

  it('has no duplicate ids', () => {
    const ids = new Set(challengeBank.map((entry) => entry.id));
    expect(ids.size).toBe(challengeBank.length);
  });

  it('has non-empty pl and en wording for every entry', () => {
    for (const entry of challengeBank) {
      expect(entry.content.pl.trim().length).toBeGreaterThan(0);
      expect(entry.content.en.trim().length).toBeGreaterThan(0);
    }
  });
});


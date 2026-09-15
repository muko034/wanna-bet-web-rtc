/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { challengeBankEntrySchema, type ChallengeBankEntry } from './challenge-bank.schema.ts';

/**
 * Parses and validates every YAML source file in `data/` into `ChallengeBankEntry` objects,
 * sorted by filename. Shared by the codegen script (which writes the result to
 * `challenge-bank.ts`) and the test suite (which checks the committed file hasn't drifted from
 * this source).
 */
export function loadChallengeBankFromYaml(dataDir: string): ChallengeBankEntry[] {
  const files = readdirSync(dataDir)
    .filter((name) => name.endsWith('.yaml'))
    .sort();

  const entries = files.map((file) => {
    const raw = load(readFileSync(join(dataDir, file), 'utf-8')) as Record<string, unknown>;
    const withStringId = { ...raw, id: String(raw.id) };
    const result = challengeBankEntrySchema.safeParse(withStringId);
    if (!result.success) {
      throw new Error(`${file} does not match ChallengeBankEntry: ${result.error.message}`);
    }
    return result.data;
  });

  const ids = new Set(entries.map((entry) => entry.id));
  if (ids.size !== entries.length) {
    throw new Error('Duplicate ids found across challenge-bank data files');
  }

  return entries;
}

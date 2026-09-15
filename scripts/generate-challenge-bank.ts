import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { loadChallengeBankFromYaml } from '../src/challenge-bank/load-from-yaml.ts';

/**
 * Regenerates `src/challenge-bank/challenge-bank.ts` from the YAML source files in
 * `src/challenge-bank/data/`. Run with `npm run generate:challenge-bank` whenever a `.yaml`
 * entry is added, edited, or removed.
 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const here = dirname(fileURLToPath(import.meta.url));
  const dataDir = join(here, '../src/challenge-bank/data');
  const outFile = join(here, '../src/challenge-bank/challenge-bank.ts');

  const entries = loadChallengeBankFromYaml(dataDir);

  const header = `// GENERATED FILE — do not edit by hand.
// Source: src/challenge-bank/data/*.yaml
// Regenerate with: npm run generate:challenge-bank

import type { ChallengeBankEntry } from './challenge-bank.schema.ts';

export const challengeBank: ChallengeBankEntry[] = ${JSON.stringify(entries, null, 2)};
`;

  writeFileSync(outFile, header);
  console.log(`Wrote ${entries.length} entries to ${outFile}`);
}

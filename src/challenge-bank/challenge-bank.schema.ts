import { z } from 'zod';

/**
 * Shape of one Challenge Bank entry. The schema is the single source of truth and the exported
 * type is derived from it via `z.infer` — there is no hand-written duplicate.
 */
export const challengeBankEntrySchema = z.object({
  id: z.string(),
  type: z.enum(['PHYSICAL', 'MENTAL']),
  content: z.object({
    pl: z.string(),
    en: z.string(),
  }),
  timeLimit: z.enum(['NONE', 'QUARTER_MINUTE', 'HALF_MINUTE', 'ONE_MINUTE']),
  illustration: z.string().optional(),
});

export type ChallengeBankEntry = z.infer<typeof challengeBankEntrySchema>;

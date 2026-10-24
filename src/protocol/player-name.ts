/** The longest player name, counted in characters as the player sees them. */
export const MAX_NAME_LENGTH = 16;

const segmenter = new Intl.Segmenter();

function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

/** Counts `text` the way the player sees it: an emoji or an accented letter is one character. */
export function graphemeCount(text: string): number {
  return graphemes(text).length;
}

/** Cuts `text` to the name limit without splitting a visible character. */
export function truncateName(text: string): string {
  return graphemes(text).slice(0, MAX_NAME_LENGTH).join('');
}

/** Trims `raw`; the name is valid when it is not empty and at most `MAX_NAME_LENGTH` characters. */
export function normalizeName(raw: string): { name: string; valid: boolean } {
  const name = raw.trim();
  return { name, valid: name.length > 0 && graphemeCount(name) <= MAX_NAME_LENGTH };
}

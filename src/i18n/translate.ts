export type MessageParams = Record<string, string | number>;

/** Looks up `key` and fills `{name}` placeholders from `params`. */
export function translate<K extends string>(
  dictionary: Record<K, string>,
  key: K,
  params: MessageParams = {},
): string {
  return dictionary[key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  );
}

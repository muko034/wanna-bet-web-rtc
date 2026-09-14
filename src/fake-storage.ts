/**
 * In-memory `Storage` double for tests — same shape as the browser's `localStorage`, with
 * no persistence beyond the test's lifetime.
 */
export class FakeStorage implements Storage {
  // Satisfies Storage's index signature (real localStorage exposes keys as properties too);
  // this fake is only ever used through the named methods below.
  [name: string]: unknown;

  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }
}

# Challenge Bank entry contract

The Challenge Bank (see `domain-glossary.md`, ADR 0004) is a fixed, bundled dataset shipped identically inside every
client build (no backend — ADR 0001). This is the shape of one entry.

```ts
type ChallengeBankEntry = {
  id: string;                              // stable identifier; referenced as RoundState.challengeId (message-protocol.md)
  type: 'PHYSICAL' | 'MENTAL';
  content: {
    pl: string;                            // Polish wording — Display Language default
    en: string;                            // English wording
  };
  timeLimit: 'NONE' | 'QUARTER_MINUTE' | 'HALF_MINUTE' | 'ONE_MINUTE'; // informational only, not enforced (ADR 0004)
  illustration?: string;                   // optional asset reference; shared unchanged across both languages
};
```

Notes:

- `type` is carried as data but not filterable by the Host in v1 (see round-engine spec 05) — every draw considers the
  whole bank regardless of `type`.
- `content` must have both `pl` and `en` populated for every entry — the bank is the source of translated text a
  client resolves locally per its own Display Language; there is no missing-language fallback at the entry level (that
  fallback chain applies to UI strings, not Challenge Bank content).
- `illustration`, when present, is hidden from the Active Player under the same rule as `content` (see round-engine
  spec 05, `domain-glossary.md`'s Illustration entry).
- v1 ships all 188 entries from the reference dataset, with minor content fixes and a handful of new entries (see ADR
  0004) — this file documents the contract, not the dataset itself.

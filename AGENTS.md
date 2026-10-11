# Wanna Bet

Turn-based social betting game. The Host owns authoritative game state; Guests connect directly over WebRTC.

## Commands

- Build: `npm run build`
- Test: `npm test`
- Smoke test (manual, requires local PeerJS server — see `README.md`): `npm run test:smoke`
- E2E (opt-in, starts its own servers — see `README.md`): `npm run test:e2e`

## Reference

- **Domain language:** `docs/domain-glossary.md`
- **Issue tracker:** `docs/agents/issue-tracker.md`
- **Architecture decisions:** `docs/adr/`
- **Wire protocol:** `docs/message-protocol.md`
- **Game rules:** `docs/game-rules.md`
- **Code conventions:** `docs/conventions/`

# Peer-to-peer, Host-authoritative architecture with no backend

We're building for personal-use scale (2–6 friends/family per Room), so we chose WebRTC via PeerJS for direct
browser-to-browser play instead of a client-server backend: one player's browser (the Host) holds the single
authoritative Game State and validates every action, and Guests connect directly to the Host's data channel. The only
non-P2P piece is a public, free PeerServer used solely for connection bootstrap (signaling) — it never sees or stores
game data. This yields zero recurring infrastructure cost and no server to operate, at the cost of explicitly accepted
limitations: no cheat-proofing beyond basic Host-side validation, no horizontal scale, and no failover if the Host
disconnects (the Room simply ends — no Host migration). These trade-offs are acceptable for a trusted friend-group game
and were a deliberate choice over the more conventional client-server model, which would have added ongoing hosting
cost and ops burden this project explicitly wants to avoid.

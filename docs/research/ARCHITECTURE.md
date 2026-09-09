# Multiplayer Board Game

> **Note**: This is an early research/brainstorm doc. §5's message protocol sketch (`move`, `ts`-based staleness
> detection, single ID sent with every message) has been superseded by the actual Host↔Guest contract in
> `docs/message-protocol.md` and ADR 0003 — refer to those, not this section, for the wire format.

## 1. Overview

A simple turn-based, multiplayer board game played by friends/family, each on their own device, over the web. Goal:
**zero infrastructure cost**, minimal ops burden, personal-use scale (2–20 players per session).

Design choice: **peer-to-peer (P2P) via WebRTC**, using **PeerJS** for connection setup. No application backend server,
no database. Only static file hosting is required.

## 2. Core Principle: Host-Authoritative P2P

One player's browser tab acts as the **Host** and owns the single source of truth for game state. All other players are
**Guests** who connect directly to the Host via a WebRTC data channel.

```
        ┌─────────────┐
        │   Host      │  ← authoritative game state lives here
        │ (Player A)  │
        └──────┬──────┘
       ┌───────┼───────┐
       ▼       ▼       ▼
  ┌────────┐ ┌────────┐ ┌────────┐
  │ Guest  │ │ Guest  │ │ Guest  │
  │(Player │ │(Player │ │(Player │
  │  B)    │ │  C)    │ │  D)    │
  └────────┘ └────────┘ └────────┘
```

There is no game server. The Host's browser *is* the server, for the duration of that session only.

## 3. Components

### 3.1 Static client (the game itself)

- A single-page web app (plain JS/React/whatever) containing:
    - Board rendering / UI
    - Game rules engine (move validation, turn logic, win conditions)
    - Networking layer (PeerJS wrapper)
- Deployed as static files — **GitHub Pages / Netlify / Vercel free tier**. No server-side code required.

### 3.2 Signaling: PeerServer (cloud, free)

- WebRTC peers can't find each other without an initial handshake (exchanging IP/port/session info). PeerJS provides a
  free, publicly hosted **PeerServer** for exactly this purpose.
- Used **only** during connection setup. Once the P2P data channel is open, PeerServer is no longer involved — it cannot
  see or store game data.
- Optional: self-host your own PeerServer later (open-source, single npm package) if you want independence from the
  public one — still free, just needs somewhere to run continuously (not required for this design).

### 3.3 Data channel (WebRTC, direct P2P)

- Once connected, Host and each Guest exchange JSON messages directly, browser-to-browser, no intermediary.
- This carries all real-time game traffic: moves, state updates, chat, presence pings.

## 4. Session Lifecycle

1. **Host creates a room**
    - Host opens the app → PeerJS generates a random `peerId`.
    - App displays a shareable room code/link, e.g.
      `https://yourgame.app/?room=aZ3x9k`.
    - Host initializes the game state (board setup, player order).

2. **Guests join**
    - Guest opens the link → app extracts `room` param → calls
      `peer.connect(roomId)`.
    - Host receives a `connection` event, registers the new Guest, and immediately sends them the current game state.

3. **Gameplay loop**
    - A player (Host or Guest) makes a move locally.
    - **Guest move:** sends `{type: "move", ...}` to Host only.
    - **Host move:** applies directly.
    - **Host validates** every move against game rules (never trust client input, even though this is casual/personal
      use).
    - Host updates canonical state, then **broadcasts** the new state to all connected Guests:
      `{type: "state", board, turn, ...}`.
    - Every client (including Host) re-renders from the received/updated state — i.e., **state flows one-way outward
      from Host**.

4. **Disconnect / reconnect**
    - If a Guest disconnects, Host marks them as offline; game can pause or skip their turn depending on house rules.
    - If a Guest reconnects (same room link), it re-syncs by requesting full state from Host on connect.
    - If the **Host** disconnects, the session ends (no failover) — acceptable tradeoff for personal use. Mitigate by
      having Host periodically persist state to `localStorage` and reload if needed.

## 5. Message Protocol (example)

Simple JSON envelope, one message type per action:

```jsonc
// Guest -> Host
{ "type": "move", "player": "B", "action": {"from": "A1", "to": "A2"} }

// Host -> all Guests (and self)
{ "type": "state", "board": [...], "turn": "C", "seq": 42 }

// Presence / housekeeping
{ "type": "join",  "player": "C", "name": "Charlie" }
{ "type": "leave", "player": "B" }
```

A monotonically increasing `seq` number on state messages lets clients detect and ignore stale/out-of-order updates.

## 6. Responsibilities Split

| Concern               | Where it lives                          |
|-----------------------|-----------------------------------------|
| UI rendering          | Every client                            |
| Move validation/rules | Host only (authoritative)               |
| State storage         | Host's memory (+ optional localStorage) |
| Networking/transport  | PeerJS (WebRTC data channel)            |
| Connection bootstrap  | Public PeerServer (signaling only)      |
| Hosting the app files | Static host (GitHub Pages/Netlify)      |

## 7. Non-Goals / Explicit Limitations

- **No persistence beyond a session** unless you add manual `localStorage`
  save/load — acceptable for casual games.
- **No horizontal scale** — fine, capped at a handful of players.
- **No cheat-proofing beyond basic validation** — trusted friend group, not a public product.
- **No built-in reconnection resilience** if Host closes tab — could be added later (e.g., Guest promotion to new Host)
  but out of scope for v1.
- **Occasional NAT/firewall failures** on restrictive networks — rare on home Wi-Fi; would require a TURN relay server
  (paid/self-hosted) to fully solve — not needed for casual personal use.

## 8. Cost Summary

| Piece                  | Cost                                          |
|------------------------|-----------------------------------------------|
| Static hosting         | $0 (GitHub Pages/Netlify free tier)           |
| PeerJS client library  | $0 (open source, bundled in app)              |
| PeerServer (signaling) | $0 (public cloud instance, or self-host free) |
| Data transport         | $0 (direct P2P, no bandwidth billed to you)   |

**Total recurring cost: $0.**

## 9. Suggested Tech Stack (v1)

- Vanilla JS or lightweight framework (Preact/React) — keep it simple.
- `peerjs` npm package for networking.
- Plain CSS/canvas or SVG for the board.
- Build with Vite, deploy static output to GitHub Pages.

## 10. Future Extensions (optional, not required now)

- Host migration on disconnect (promote a Guest to Host, replaying last known state).
- Spectator mode.
- Self-hosted PeerServer + TURN if you outgrow home-network reliability.
- Swap P2P for Firebase/Supabase Realtime if you ever want persistence, cross-device async play, or more than a handful
  of concurrent players.

**Blocked by**: 1 (Host creates a Room)

**Status**: Done

## What to build

Add a separate smoke-test suite for `PeerJsTransport`, run against a live or locally started `peerjs-server`. The
suite validates the adapter's integration with PeerJS, not Room/Connection Manager behavior; those behaviors remain
covered by the fake-`Transport` unit tests.

The adapter must accept optional PeerJS connection settings for the smoke-test server while preserving the current
production defaults. The exact configuration mechanism and environment variable names are implementation details.

The smoke tests must use observable PeerJS events with explicit timeouts rather than arbitrary sleeps. The manual
workflow must document the server prerequisite, how to start it, how to override its host, port, and path, how to run
the smoke suite, and what successful completion means. The suite does not need to start or stop the server itself.

If deterministic teardown requires it, add a minimal `close()` capability to `PeerJsTransport` only; do not expand the
shared `Transport` interface for this task.

## Acceptance criteria

- [x] A Host `PeerJsTransport` connects to the configured PeerJS server and returns a usable Transport ID.
- [x] A Guest `PeerJsTransport` connects to the Host's Transport ID.
- [x] Both sides report the connection-open event through `onConnectionChange(..., true)`.
- [x] Guest-to-Host and Host-to-Guest messages arrive unchanged through `onMessage`.
- [x] Host `send` delivers a message to every currently connected Guest.
- [x] Closing the concrete PeerJS-backed transports produces `onConnectionChange(..., false)` and releases resources.
- [x] Connecting with an unavailable or invalid server/peer surfaces an error or rejects `connect()` within the test timeout.
- [x] The adapter preserves its existing production defaults while allowing the smoke-test server's host, port, and path
  to be overridden.
- [x] A documented manual command runs the smoke suite against a live/local `peerjs-server`.
- [x] The smoke suite is separate from the fake-`Transport` unit suite and is not required for the room-lifecycle TDD
  loop.

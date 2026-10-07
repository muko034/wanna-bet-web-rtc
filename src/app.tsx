import { Router, route } from 'preact-router';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Home } from './room-lifecycle/Home';
import { CreateRoom } from './room-lifecycle/CreateRoom';
import { JoinCode } from './room-lifecycle/JoinCode';
import { Lobby } from './room-lifecycle/Lobby';
import { JoinRoom } from './room-lifecycle/JoinRoom';
import { StartedGame } from './room-lifecycle/StartedGame';
import { NotFound } from './NotFound';
import { withBase } from './base-path';
import { reopenRoom, startGame, type Room } from './room-lifecycle/room';
import { roomRegistry } from './room-lifecycle/room-registry-instance';
import { deleteHostSession, saveHostSession, type HostSession } from './host-persistence/host-session-store';
import { resolveAutoResume, type AutoResume } from './host-persistence/auto-resume';
import { ReopeningRoom } from './host-persistence/ReopeningRoom';
import { createPeerJsTransport } from './transport/create-peerjs-transport';
import type { PeerJsTransport } from './transport/peerjs-transport';
import type { RecoverableTransport } from './transport/transport';
import { ConnectionManager } from './room-lifecycle/connection-manager';
import { HostConnectionLostBanner } from './room-lifecycle/HostConnectionLostBanner';
import type { GameState, PlaceBetPayload } from './protocol/messages';
import { BetDelivery, type PlaceBetContext } from './room-lifecycle/bet-delivery';
import type { BetRejection } from './round-engine/round-engine';
import { leaveRoom, sitOutOfRoom } from './room-lifecycle/guest-leave';

type RoomRouteProps = {
  path?: string;
  code?: string;
  room: Room | null;
  hostGameState: GameState | null;
  guestGameState: GameState | null;
  onStart: () => void;
  onGameStarted: (code: string) => void;
  onGameState: (state: GameState) => void;
  onPlaceBetReady: (placeBet: ((payload: PlaceBetPayload) => void) | null) => void;
  onBetRejected: (reason: BetRejection) => void;
  onConnectionLost: () => void;
  createGuestTransport: () => PeerJsTransport;
  isSatOut: () => boolean;
  onLeave: (code: string) => void;
  onSitOut: () => void;
};

/** `/room/<CODE>`: the Host sees the Lobby; an unrecognized visitor sees the Guest join form. */
function RoomRoute({ code, room, hostGameState, guestGameState, onStart, onGameStarted, onGameState, onPlaceBetReady, onBetRejected, onConnectionLost, createGuestTransport, isSatOut, onLeave, onSitOut }: RoomRouteProps) {
  if (room && room.code === code) {
    return <Lobby code={code} room={room} gameState={hostGameState} onStart={onStart} />;
  }
  return (
    <JoinRoom
      code={code}
      onGameStarted={onGameStarted}
      onGameState={onGameState}
      gameState={guestGameState}
      onPlaceBetReady={onPlaceBetReady}
      onBetRejected={onBetRejected}
      onConnectionLost={onConnectionLost}
      createGuestTransport={createGuestTransport}
      isSatOut={isSatOut}
      onLeave={onLeave}
      onSitOut={onSitOut}
    />
  );
}

/** Deferred so gameplay never waits on the storage write. */
function autosave(session: HostSession): void {
  setTimeout(() => saveHostSession(localStorage, session), 0);
}

/** Deferred like `autosave`, so it runs after any save still queued. */
function forgetSession(code: string): void {
  setTimeout(() => deleteHostSession(localStorage, code), 0);
}

type Reopening = Extract<AutoResume, { kind: 'resume' }> & { failed: boolean };

/** Checked once, against the URL the app was opened on — later in-app navigation never resumes a Room. */
function openedReopening(): Reopening | null {
  const autoResume = resolveAutoResume(localStorage, window.location.pathname);
  return autoResume.kind === 'resume' ? { ...autoResume, failed: false } : null;
}

export function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [guestGameStartedCode, setGuestGameStartedCode] = useState<string | null>(null);
  const [hostGameState, setHostGameState] = useState<GameState | null>(null);
  const [guestGameState, setGuestGameState] = useState<GameState | null>(null);
  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  /** Round key of the Guest Bet that never reached the Host, until the Bettor locks in again. */
  const [betFailedRoundKey, setBetFailedRoundKey] = useState<string | null>(null);
  const guestConnectionLostRef = useRef<() => void>(() => {});
  const [betDelivery] = useState(() => new BetDelivery(setBetFailedRoundKey, () => guestConnectionLostRef.current()));
  const reopeningTransportRef = useRef<PeerJsTransport | null>(null);
  const guestTransportRef = useRef<PeerJsTransport | null>(null);
  /** Set when this device's Guest sat out or left, so the closing connection's late signals cannot pull the Guest back; cleared by the next transport. */
  const satOutRef = useRef(false);
  const isSatOut = useCallback(() => satOutRef.current, []);
  /** This device's own Host transport, held so the foreground-recovery effect below can reach it regardless of which flow (fresh create vs. reopen) last opened it. `null` on a Guest's device. */
  const hostTransportRef = useRef<RecoverableTransport | null>(null);
  /** Set when `hostTransportRef`'s `recover()` fails. */
  const [hostConnectionLost, setHostConnectionLost] = useState(false);
  // Decided before the first render, so the Room's link never mounts the Guest join form meanwhile.
  const [reopening, setReopening] = useState<Reopening | null>(openedReopening);

  const hostRoom = (transport: RecoverableTransport, initialRoom: Room): ConnectionManager => {
    connectionManagerRef.current?.close();
    const manager = new ConnectionManager(
      transport,
      initialRoom,
      setRoom,
      undefined,
      undefined,
      setHostGameState,
      autosave,
      forgetSession,
    );
    connectionManagerRef.current = manager;
    hostTransportRef.current = transport;
    return manager;
  };

  const handleRoomCreated = (createdRoom: Room, transport: RecoverableTransport) => {
    hostRoom(transport, createdRoom);
    setRoom(createdRoom);
    route(withBase(`room/${createdRoom.code}`));
  };

  const reopen = (target: Reopening) => {
    setReopening({ ...target, failed: false });
    const transport = createPeerJsTransport();
    reopeningTransportRef.current = transport;
    const isCurrent = () => reopeningTransportRef.current === transport;
    reopenRoom(transport, roomRegistry, target.session.room)
      .then(() => {
        if (!isCurrent()) return;
        reopeningTransportRef.current = null;
        hostRoom(transport, target.session.room).resume(target.session);
        setReopening(null);
        route(withBase(target.landingPath), true);
      })
      .catch(() => {
        transport.close();
        if (!isCurrent()) return;
        setReopening({ ...target, failed: true });
      });
  };

  /** Home during a reopen: drop the half-built Peer so it can't finish later and pull the user back into the Room. */
  const cancelReopen = () => {
    reopeningTransportRef.current?.close();
    reopeningTransportRef.current = null;
    route(withBase('/'), true);
    setReopening(null);
  };

  useEffect(() => {
    if (reopening) {
      reopen(reopening);
    }
  }, []);

  /** Recovers the Host's signaling connection whenever its tab returns to the foreground; a backgrounded tab can go stale without a `disconnected` event. */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const transport = hostTransportRef.current;
      if (!transport) return;
      transport.recover().then((recovered) => {
        setHostConnectionLost(!recovered);
        if (recovered) connectionManagerRef.current?.rebroadcastState();
      });
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  /** The Host's Leave: ends the Room for everyone; the Host stays on the Game Result Screen. */
  const handleHostLeave = () => {
    connectionManagerRef.current?.leave();
    hostTransportRef.current = null;
  };

  const handleStart = () => {
    if (!room) return;
    const started = startGame(room);
    if (connectionManagerRef.current) {
      connectionManagerRef.current.room = started;
    }
    setRoom(started);
    connectionManagerRef.current?.startGame();
    connectionManagerRef.current?.startRound();
    route(withBase(`room/${started.code}/play`));
  };

  const handlePlaceBet = useCallback((payload: PlaceBetPayload, context: PlaceBetContext) => {
    if (room && connectionManagerRef.current?.room.code === room.code) {
      connectionManagerRef.current.placeBet(
        room.hostPlayerId,
        payload.amount,
        payload.prediction,
        payload.challengeId,
      );
      return;
    }

    setBetFailedRoundKey(null);
    betDelivery.place({ ...context, payload });
  }, [room, betDelivery]);

  const handleGuestGameState = useCallback((state: GameState) => {
    betDelivery.onState(state);
    setGuestGameState(state);
  }, [betDelivery]);

  const handleBetRejected = useCallback((reason: BetRejection) => betDelivery.onRejected(reason), [betDelivery]);
  const handleReconnectGaveUp = useCallback(() => betDelivery.failPending(), [betDelivery]);

  // Must stay referentially stable: `JoinRoom`'s rejoin effect depends on it, and a new
  // identity per render would re-run that effect (opening a fresh Peer) on every `state`.
  const handlePlaceBetReady = useCallback((placeBet: ((payload: PlaceBetPayload) => void) | null) => {
    betDelivery.setSender(placeBet);
  }, [betDelivery]);

  /**
   * A Guest's live connection was lost, on whichever route wired the connection that
   * dropped. Resets `guestGameStartedCode` — held here, at the App level, rather than inside
   * either route — so it outlives whichever route happens to be mounted when the drop is
   * detected: the connection a Guest is using while playing was often established earlier,
   * on the Lobby's join screen, before the game started and the Guest navigated to `/play`.
   * Clearing it makes `StartedGame`'s own `isGuestUnresolved` true again, which re-enters its
   * reconnect effect the same way a stored-identity mount does; `watchForGameStart` restores
   * it once the Host resends the in-progress GameState on the follow-up rejoin.
   */
  const handleGuestConnectionLost = useCallback(() => {
    setGuestGameStartedCode(null);
    handlePlaceBetReady(null);
  }, [handlePlaceBetReady]);

  guestConnectionLostRef.current = handleGuestConnectionLost;

  /**
   * The Guest's one live transport, held here so it outlives whichever route established it:
   * the connection made on the Lobby's join screen keeps serving `/play` after that screen
   * unmounts. Closing the previous one before handing out a new one means a drop is never
   * left with a stale Peer still registered and watching, on either route.
   */
  const createGuestTransport = useCallback((): PeerJsTransport => {
    guestTransportRef.current?.close();
    satOutRef.current = false;
    const transport = createPeerJsTransport();
    guestTransportRef.current = transport;
    return transport;
  }, []);

  /** Ends this device's Guest session: runs `exit` on the live transport, drops every trace of the Game and goes Home. */
  const exitGuestGame = useCallback((exit: (transport: PeerJsTransport) => void) => {
    const transport = guestTransportRef.current;
    guestTransportRef.current = null;
    satOutRef.current = true;
    if (transport) {
      exit(transport);
    }
    handlePlaceBetReady(null);
    setGuestGameStartedCode(null);
    setGuestGameState(null);
    route(withBase('/'));
  }, [handlePlaceBetReady]);

  /** A Guest's Leave: tells the Host, closes the connection and forgets the identity. */
  const handleGuestLeave = useCallback((code: string) => {
    exitGuestGame((transport) => leaveRoom(transport, localStorage, code));
  }, [exitGuestGame]);

  /** A Guest's Sit out: tells the Host and closes the connection but keeps the identity, so the play URL rejoins later. */
  const handleGuestSitOut = useCallback(() => {
    exitGuestGame(sitOutOfRoom);
  }, [exitGuestGame]);

  if (reopening) {
    return (
      <ReopeningRoom roomCode={reopening.session.room.code} failed={reopening.failed} onRetry={() => reopen(reopening)} onHome={cancelReopen} />
    );
  }

  return (
    <>
      {hostConnectionLost && <HostConnectionLostBanner onDismiss={() => setHostConnectionLost(false)} />}
      <Router>
        <Home path={withBase('/')} />
        <CreateRoom path={withBase('room')} onRoomCreated={handleRoomCreated} />
        <JoinCode path={withBase('join')} />
        <RoomRoute
          path={withBase('room/:code')}
          room={room}
          hostGameState={hostGameState}
          guestGameState={guestGameState}
          onStart={handleStart}
          onGameStarted={setGuestGameStartedCode}
          onGameState={handleGuestGameState}
          onPlaceBetReady={handlePlaceBetReady}
          onBetRejected={handleBetRejected}
          onConnectionLost={handleGuestConnectionLost}
          createGuestTransport={createGuestTransport}
          isSatOut={isSatOut}
          onLeave={handleGuestLeave}
          onSitOut={handleGuestSitOut}
        />
        <StartedGame
          path={withBase('room/:code/play')}
          room={room}
          guestGameStartedCode={guestGameStartedCode}
          gameState={hostGameState ?? guestGameState}
          onPlaceBet={handlePlaceBet}
          betFailedRoundKey={betFailedRoundKey}
          onReconnectGaveUp={handleReconnectGaveUp}
          onResolveRound={(outcome) => {
            connectionManagerRef.current?.resolveRound(outcome);
          }}
          onRedraw={() => {
            connectionManagerRef.current?.redrawChallenge();
          }}
          onGameStarted={setGuestGameStartedCode}
          onGameState={handleGuestGameState}
          onPlaceBetReady={handlePlaceBetReady}
          onBetRejected={handleBetRejected}
          onConnectionLost={handleGuestConnectionLost}
          onLeave={handleGuestLeave}
          onSitOut={handleGuestSitOut}
          onHostLeave={handleHostLeave}
          createGuestTransport={createGuestTransport}
          isSatOut={isSatOut}
        />
        <NotFound default />
      </Router>
    </>
  );
}

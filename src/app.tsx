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
import { saveHostSession, type HostSession } from './host-persistence/host-session-store';
import { resolveAutoResume, type AutoResume } from './host-persistence/auto-resume';
import { ReopeningRoom } from './host-persistence/ReopeningRoom';
import { PeerJsTransport } from './transport/peerjs-transport';
import { ConnectionManager } from './room-lifecycle/connection-manager';
import type { Transport } from './transport/transport';
import type { GameState, PlaceBetPayload } from './protocol/messages';

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
};

/** `/room/<CODE>`: the Host sees the Lobby; an unrecognized visitor sees the Guest join form. */
function RoomRoute({ code, room, hostGameState, guestGameState, onStart, onGameStarted, onGameState, onPlaceBetReady }: RoomRouteProps) {
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
    />
  );
}

/** Deferred so gameplay never waits on the storage write. */
function autosave(session: HostSession): void {
  setTimeout(() => saveHostSession(localStorage, session), 0);
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
  const guestPlaceBetRef = useRef<((payload: PlaceBetPayload) => void) | null>(null);
  // Decided before the first render, so the Room's link never mounts the Guest join form meanwhile.
  const [reopening, setReopening] = useState<Reopening | null>(openedReopening);

  const hostRoom = (transport: Transport, initialRoom: Room): ConnectionManager => {
    const manager = new ConnectionManager(
      transport,
      initialRoom,
      setRoom,
      undefined,
      undefined,
      setHostGameState,
      autosave,
    );
    connectionManagerRef.current = manager;
    return manager;
  };

  const handleRoomCreated = (createdRoom: Room, transport: Transport) => {
    hostRoom(transport, createdRoom);
    setRoom(createdRoom);
    route(withBase(`room/${createdRoom.code}`));
  };

  const reopen = (target: Reopening) => {
    setReopening({ ...target, failed: false });
    const transport = new PeerJsTransport();
    reopenRoom(transport, roomRegistry, target.session.room)
      .then(() => {
        hostRoom(transport, target.session.room).resume(target.session);
        setReopening(null);
        route(withBase(target.landingPath), true);
      })
      .catch(() => {
        transport.close();
        setReopening({ ...target, failed: true });
      });
  };

  useEffect(() => {
    if (reopening) {
      reopen(reopening);
    }
  }, []);

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

  const handlePlaceBet = useCallback((payload: PlaceBetPayload) => {
    if (room && connectionManagerRef.current?.room.code === room.code) {
      connectionManagerRef.current.placeBet(room.hostPlayerId, payload.amount, payload.prediction);
      return;
    }

    guestPlaceBetRef.current?.(payload);
  }, [room]);

  // Must stay referentially stable: `JoinRoom`'s rejoin effect depends on it, and a new
  // identity per render would re-run that effect (opening a fresh Peer) on every `state`.
  const handlePlaceBetReady = useCallback((placeBet: ((payload: PlaceBetPayload) => void) | null) => {
    guestPlaceBetRef.current = placeBet;
  }, []);

  if (reopening) {
    return (
      <ReopeningRoom roomCode={reopening.session.room.code} failed={reopening.failed} onRetry={() => reopen(reopening)} />
    );
  }

  return (
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
        onGameState={setGuestGameState}
        onPlaceBetReady={handlePlaceBetReady}
      />
      <StartedGame
        path={withBase('room/:code/play')}
        room={room}
        guestGameStartedCode={guestGameStartedCode}
        gameState={hostGameState ?? guestGameState}
        onPlaceBet={handlePlaceBet}
        onResolveRound={(outcome) => {
          connectionManagerRef.current?.resolveRound(outcome);
        }}
      />
      <NotFound default />
    </Router>
  );
}

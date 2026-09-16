import { Router, route } from 'preact-router';
import { useRef, useState } from 'preact/hooks';
import { Home } from './room-lifecycle/Home';
import { CreateRoom } from './room-lifecycle/CreateRoom';
import { JoinCode } from './room-lifecycle/JoinCode';
import { Lobby } from './room-lifecycle/Lobby';
import { JoinRoom } from './room-lifecycle/JoinRoom';
import { StartedGame } from './room-lifecycle/StartedGame';
import { NotFound } from './NotFound';
import { withBase } from './base-path';
import { startGame, type Room } from './room-lifecycle/room';
import { ConnectionManager } from './room-lifecycle/connection-manager';
import type { Transport } from './transport/transport';
import type { GameState } from './protocol/messages';

type RoomRouteProps = {
  path?: string;
  code?: string;
  room: Room | null;
  onStart: () => void;
  onGameStarted: (code: string) => void;
  onGameState: (state: GameState) => void;
};

/** `/room/<CODE>`: the Host sees the Lobby; an unrecognized visitor sees the Guest join form. */
function RoomRoute({ code, room, onStart, onGameStarted, onGameState }: RoomRouteProps) {
  if (room && room.code === code) {
    return <Lobby code={code} room={room} onStart={onStart} />;
  }
  return <JoinRoom code={code} onGameStarted={onGameStarted} onGameState={onGameState} />;
}

export function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [guestGameStartedCode, setGuestGameStartedCode] = useState<string | null>(null);
  const [hostGameState, setHostGameState] = useState<GameState | null>(null);
  const [guestGameState, setGuestGameState] = useState<GameState | null>(null);
  const connectionManagerRef = useRef<ConnectionManager | null>(null);

  const handleRoomCreated = (createdRoom: Room, transport: Transport) => {
    connectionManagerRef.current = new ConnectionManager(transport, createdRoom, setRoom);
    setRoom(createdRoom);
    route(withBase(`room/${createdRoom.code}`));
  };

  const handleStart = () => {
    if (!room) return;
    const started = startGame(room);
    if (connectionManagerRef.current) {
      connectionManagerRef.current.room = started;
    }
    setRoom(started);
    const gameState = connectionManagerRef.current?.startGame() ?? null;
    setHostGameState(gameState);
    route(withBase(`room/${started.code}/play`));
  };

  const handleStartRound = (activePlayerId: string) => {
    const gameState = connectionManagerRef.current?.startRound(activePlayerId) ?? null;
    setHostGameState(gameState);
  };

  return (
    <Router>
      <Home path={withBase('/')} />
      <CreateRoom path={withBase('room')} onRoomCreated={handleRoomCreated} />
      <JoinCode path={withBase('join')} />
      <RoomRoute
        path={withBase('room/:code')}
        room={room}
        onStart={handleStart}
        onGameStarted={setGuestGameStartedCode}
        onGameState={setGuestGameState}
      />
      <StartedGame
        path={withBase('room/:code/play')}
        room={room}
        guestGameStartedCode={guestGameStartedCode}
        gameState={hostGameState ?? guestGameState}
        onStartRound={handleStartRound}
      />
      <NotFound default />
    </Router>
  );
}

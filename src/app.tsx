import { Router, route } from 'preact-router';
import { useRef, useState } from 'preact/hooks';
import { Home } from './room-lifecycle/Home';
import { CreateRoom } from './room-lifecycle/CreateRoom';
import { Lobby } from './room-lifecycle/Lobby';
import { JoinRoom } from './room-lifecycle/JoinRoom';
import { StartedGame } from './room-lifecycle/StartedGame';
import { NotFound } from './NotFound';
import { startGame, type Room } from './room-lifecycle/room';
import { ConnectionManager } from './room-lifecycle/connection-manager';
import type { Transport } from './transport/transport';

type RoomRouteProps = {
  path?: string;
  code?: string;
  room: Room | null;
  onStart: () => void;
};

/** `/room/<CODE>`: the Host sees the Lobby; an unrecognized visitor sees the Guest join form. */
function RoomRoute({ code, room, onStart }: RoomRouteProps) {
  if (room && room.code === code) {
    return <Lobby code={code} room={room} onStart={onStart} />;
  }
  return <JoinRoom code={code} />;
}

export function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const connectionManagerRef = useRef<ConnectionManager | null>(null);

  const handleRoomCreated = (createdRoom: Room, transport: Transport) => {
    connectionManagerRef.current = new ConnectionManager(transport, createdRoom, setRoom);
    setRoom(createdRoom);
    route(`/room/${createdRoom.code}`);
  };

  const handleStart = () => {
    if (!room) return;
    const started = startGame(room);
    setRoom(started);
    route(`/room/${started.code}/play`);
  };

  return (
    <Router>
      <Home path="/" />
      <CreateRoom path="/room" onRoomCreated={handleRoomCreated} />
      <RoomRoute path="/room/:code" room={room} onStart={handleStart} />
      <StartedGame path="/room/:code/play" room={room} />
      <NotFound default />
    </Router>
  );
}

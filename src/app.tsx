import { Router, route } from 'preact-router';
import { useState } from 'preact/hooks';
import { Home } from './room-lifecycle/Home';
import { CreateRoom } from './room-lifecycle/CreateRoom';
import { Lobby } from './room-lifecycle/Lobby';
import { StartedGame } from './room-lifecycle/StartedGame';
import { NotFound } from './NotFound';
import { startGame, type Room } from './room-lifecycle/room';

export function App() {
  const [room, setRoom] = useState<Room | null>(null);

  const handleRoomCreated = (createdRoom: Room) => {
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
      <Lobby path="/room/:code" room={room} onStart={handleStart} />
      <StartedGame path="/room/:code/play" room={room} />
      <NotFound default />
    </Router>
  );
}

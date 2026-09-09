import { useEffect, useState } from 'preact/hooks';
import { PeerJsTransport } from '../transport/peerjs-transport';
import { createRoom, type Room } from './room';

/**
 * The Host's lobby: shows the Room's shareable link/code and the list of connected
 * players (empty until a Guest joins — see docs/spec/room-lifecycle/01-host-creates-a-room.md).
 */
export function HostLobby() {
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    let cancelled = false;
    createRoom(new PeerJsTransport()).then((createdRoom) => {
      if (!cancelled) setRoom(createdRoom);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!room) {
    return <p>Creating your Room…</p>;
  }

  return (
    <section>
      <h1>Your Room</h1>
      <p>
        Share this link/code with your friends: <code>{room.roomId}</code>
      </p>
      <h2>Players</h2>
      {room.players.length === 0 ? (
        <p>Waiting for players to join…</p>
      ) : (
        <ul>
          {room.players.map((player) => (
            <li key={player.playerId}>{player.name}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

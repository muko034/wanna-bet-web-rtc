/** Unambiguous alphabet for Room Codes — excludes visually confusable characters `0`, `O`, `1`, `I`. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const ROOM_CODE_LENGTH = 6;

/**
 * Namespaces the deterministic Transport ID derived from a Room Code, reducing (not
 * eliminating) accidental collision with unrelated peers on the shared public PeerServer.
 */
const TRANSPORT_ID_PREFIX = 'wannabet-';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Generates Room Codes and derives the Transport ID a Room's Host is reachable under.
 * Holds no lookup state — a Room Code's Transport ID is a pure function of the code
 * itself, so any device can resolve it locally, without a shared registry no device
 * other than the Host could ever see (there is no backend to hold one — see ADR 0001).
 */
export class RoomRegistry {
  private readonly generateRoomCode: () => string;

  constructor(generateRoomCode: () => string = generateCode) {
    this.generateRoomCode = generateRoomCode;
  }

  /** Generates a fresh Room Code. */
  generate(): string {
    return this.generateRoomCode();
  }

  /** Deterministically derives the Transport ID `code`'s Host can be reached at. */
  transportIdFor(code: string): string {
    return `${TRANSPORT_ID_PREFIX}${code.toLowerCase()}`;
  }
}


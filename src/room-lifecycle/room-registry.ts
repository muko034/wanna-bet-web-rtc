/** Unambiguous alphabet for Room Codes — excludes visually confusable characters `0`, `O`, `1`, `I`. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const ROOM_CODE_LENGTH = 6;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Resolves Room Codes to Transport IDs. Generates a fresh Room Code per registration,
 * retrying on collision with an already-registered code.
 */
export class RoomRegistry {
  private readonly transportIdsByCode = new Map<string, string>();
  private readonly generateRoomCode: () => string;

  constructor(generateRoomCode: () => string = generateCode) {
    this.generateRoomCode = generateRoomCode;
  }

  /** Registers `transportId` under a newly generated Room Code and returns that code. */
  register(transportId: string): string {
    let code: string;
    do {
      code = this.generateRoomCode();
    } while (this.transportIdsByCode.has(code));

    this.transportIdsByCode.set(code, transportId);
    return code;
  }

  /** Returns the Transport ID registered under `code`, or `undefined` if none is. */
  resolve(code: string): string | undefined {
    return this.transportIdsByCode.get(code);
  }
}

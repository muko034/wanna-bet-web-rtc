/** Matches the code segment right after `/room/`, stopping at the next path, query or hash delimiter. */
const ROOM_URL_CODE = /\/room\/([^/?#\s]+)/i;

/** Reduces raw input — a typed code or a pasted invite URL — to an uppercased Room Code. */
export function extractRoomCode(input: string): string {
  const trimmed = input.trim();
  const code = ROOM_URL_CODE.exec(trimmed)?.[1] ?? trimmed;
  return code.toUpperCase();
}

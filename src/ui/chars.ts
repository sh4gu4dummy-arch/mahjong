/** Character roster + human seat mapping (you always sit bottom = seat 0). */

export type CharId = "A" | "L" | "J" | "C";

export const CHAR_IDS: CharId[] = ["A", "L", "J", "C"];

/** Fixed world order; rotated so chosen human is at seat 0. */
const WORLD_ORDER: CharId[] = ["A", "L", "J", "C"];

export type CharBody = "player" | "opposite" | "portrait";

export interface CharDef {
  id: CharId;
  letter: CharId;
  /** Default circular avatar. */
  avatarSrc: string;
  body: CharBody;
}

export const CHAR_DEFS: Record<CharId, CharDef> = {
  A: { id: "A", letter: "A", avatarSrc: "avatars/player.png?v=a1", body: "player" },
  L: { id: "L", letter: "L", avatarSrc: "avatars/right.png?v=l1", body: "portrait" },
  J: { id: "J", letter: "J", avatarSrc: "avatars/opposite.png?v=j2", body: "opposite" },
  C: { id: "C", letter: "C", avatarSrc: "avatars/left.png?v=c2", body: "portrait" },
};

const HUMAN_KEY = "aa-mahjong-human-char";

let humanChar: CharId = "A";

export function isCharId(x: unknown): x is CharId {
  return x === "A" || x === "L" || x === "J" || x === "C";
}

export function loadHumanChar(): CharId {
  try {
    const v = localStorage.getItem(HUMAN_KEY);
    if (isCharId(v)) humanChar = v;
  } catch {
    /* ignore */
  }
  return humanChar;
}

export function getHumanChar(): CharId {
  return humanChar;
}

export function setHumanChar(next: CharId): void {
  humanChar = isCharId(next) ? next : "A";
  try {
    localStorage.setItem(HUMAN_KEY, humanChar);
  } catch {
    /* ignore */
  }
}

/** Seat 0 = human; seats 1/2/3 = leftover in WORLD_ORDER cycling from human. */
export function seatsForHuman(human: CharId = humanChar): CharId[] {
  const start = WORLD_ORDER.indexOf(human);
  const i0 = start >= 0 ? start : 0;
  return [0, 1, 2, 3].map((k) => WORLD_ORDER[(i0 + k) % 4]!);
}

export function charAtSeat(seat: number, human: CharId = humanChar): CharId {
  return seatsForHuman(human)[((seat % 4) + 4) % 4]!;
}

export function seatOfChar(id: CharId, human: CharId = humanChar): number {
  return seatsForHuman(human).indexOf(id);
}

export function defOf(id: CharId): CharDef {
  return CHAR_DEFS[id];
}

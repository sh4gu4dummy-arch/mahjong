export type Suit = "man" | "sou" | "pin" | "wind" | "dragon";
export type Wind = "E" | "S" | "W" | "N";
export type Dragon = "R" | "G" | "Wh";
export type MeldType = "chow" | "pung" | "kong";
export type ClaimType = "win" | "kong" | "pung" | "chow";
export type Phase = "bet" | "idle" | "discard" | "claim" | "draw" | "over";

export interface Tile {
  id: number;
  kind: string;
  suit: Suit;
  value: number;
}

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  concealed: boolean;
  from?: number;
}

export interface ChowOption {
  tiles: [Tile, Tile];
  claimed: Tile;
}

export interface Claim {
  player: number;
  type: ClaimType;
  chow?: ChowOption;
}

export interface FanLine {
  name: string;
  nameZh: string;
  fan: number;
}

export interface Payout {
  from: number;
  to: number;
  amount: number;
}

export interface WinResult {
  winner: number;
  loser: number | null;
  selfDraw: boolean;
  pairKind: string;
  melds: Meld[];
  concealed: Tile[];
  fan: number;
  lines: FanLine[];
  payouts: Payout[];
  stake: number;
}

export interface DongbeiFlags {
  opened: boolean;
  hasKe: boolean;
  dragonEyes: boolean;
  yaojiu: boolean;
  threeSuits: boolean;
}

export interface Player {
  seat: Wind;
  name: string;
  nameZh: string;
  isHuman: boolean;
  hand: Tile[];
  melds: Meld[];
  river: Tile[];
  cash: number;
}

export interface GameState {
  players: Player[];
  wall: Tile[];
  current: number;
  phase: Phase;
  dealer: number;
  roundWind: Wind;
  lastDiscard: Tile | null;
  lastDiscarder: number | null;
  lastDraw: Tile | null;
  winner: number | null;
  winResult: WinResult | null;
  drawGame: boolean;
  turnCount: number;
  pendingHumanClaims: Claim[];
  message: string;
  messageZh: string;
  stake: number;
  handNumber: number;
}

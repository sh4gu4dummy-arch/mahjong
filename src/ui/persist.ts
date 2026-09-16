import type { GameState, Phase, Player, Tile, Wind } from "../game/types";

const KEY = "aa-mahjong-save";
const SAVE_VERSION = 1 as const;

export interface SavePayload {
  v: typeof SAVE_VERSION;
  state: GameState;
  betDraft: number;
  selected: number | null;
}

const PHASES: Phase[] = ["bet", "idle", "discard", "claim", "draw", "over"];
const WINDS: Wind[] = ["E", "S", "W", "N"];

function isTile(x: unknown): x is Tile {
  if (!x || typeof x !== "object") return false;
  const t = x as Record<string, unknown>;
  return typeof t.id === "number" && typeof t.kind === "string" && typeof t.suit === "string" && typeof t.value === "number";
}

function isPlayer(x: unknown): x is Player {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return (
    WINDS.includes(p.seat as Wind) &&
    typeof p.name === "string" &&
    typeof p.nameZh === "string" &&
    typeof p.isHuman === "boolean" &&
    Array.isArray(p.hand) &&
    Array.isArray(p.melds) &&
    Array.isArray(p.river) &&
    typeof p.cash === "number"
  );
}

function isGameState(x: unknown): x is GameState {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  if (!Array.isArray(s.players) || s.players.length !== 4 || !s.players.every(isPlayer)) return false;
  if (!Array.isArray(s.wall)) return false;
  if (typeof s.current !== "number" || s.current < 0 || s.current > 3) return false;
  if (!PHASES.includes(s.phase as Phase)) return false;
  if (typeof s.dealer !== "number") return false;
  if (!WINDS.includes(s.roundWind as Wind)) return false;
  if (s.lastDiscard !== null && !isTile(s.lastDiscard)) return false;
  if (s.lastDiscarder !== null && typeof s.lastDiscarder !== "number") return false;
  if (s.lastDraw !== null && !isTile(s.lastDraw)) return false;
  if (s.winner !== null && typeof s.winner !== "number") return false;
  if (s.winResult !== null && (typeof s.winResult !== "object" || !s.winResult)) return false;
  if (typeof s.drawGame !== "boolean") return false;
  if (typeof s.turnCount !== "number") return false;
  if (!Array.isArray(s.pendingHumanClaims)) return false;
  // pendingAiClaims optional for older saves — normalized in loadSave
  if (s.pendingAiClaims !== undefined && !Array.isArray(s.pendingAiClaims)) return false;
  if (typeof s.message !== "string" || typeof s.messageZh !== "string") return false;
  if (typeof s.stake !== "number" || typeof s.handNumber !== "number") return false;
  return true;
}

export function loadSave(): SavePayload | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const obj = data as Record<string, unknown>;
    if (obj.v !== SAVE_VERSION) return null;
    if (!isGameState(obj.state)) return null;
    const betDraft = typeof obj.betDraft === "number" && Number.isFinite(obj.betDraft) ? obj.betDraft : 10;
    const selected =
      obj.selected === null || typeof obj.selected === "number" ? (obj.selected as number | null) : null;
    // Normalize: ensure human is seat 0
    if (!obj.state.players[0]?.isHuman) return null;
    const state = obj.state as GameState;
    if (!Array.isArray(state.pendingAiClaims)) state.pendingAiClaims = [];
    return { v: SAVE_VERSION, state, betDraft, selected };
  } catch {
    return null;
  }
}

export function saveGame(state: GameState, betDraft: number, selected: number | null): void {
  try {
    const payload: SavePayload = { v: SAVE_VERSION, state, betDraft, selected };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}


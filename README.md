# AA 麻将 · 长春滚番

**AA 麻将** — a browser game of **Changchun-style mahjong** (长春麻将 · 滚番) for 4 players: you plus 3 AIs. Static SPA, no backend.

Win legality still uses Northeast table constraints (刻/将 · 幺九 · 三门齐), but **立胡 (closed wins) are allowed**, and cash uses **长春滚番** plus separate **蛋/杠** money.

## Run

```bash
npm install
npm run dev
```

Production:

```bash
npm run build
npm run preview
```

Dev defaults to port 5173, preview to 4173.

## View locally

From a clone (needs [Node.js](https://nodejs.org/) + npm):

```bash
node view-local.mjs
```

That installs deps if needed, builds `dist/` when missing, serves the production build on **http://127.0.0.1:4173** (next free port if busy), and opens your browser. Leave the terminal open; Ctrl+C stops the server.

Options: `--rebuild` force a fresh build · `--port N` · `--no-open`.

On macOS / Windows you can also double-click `view-local.command` / `view-local.bat`.

## How to play

- **136 tiles**, no flowers: 万 / 条 / 筒 (1–9 × 4), winds 东南西北 × 4, dragons 中发白 × 4.
- Each player is dealt **13**. East (you) draws first to **14** and discards to start.
- Play is **counter-clockwise**: East → South → West → North.
- Turn: **draw** → optional **杠 / 胡** → **discard** one.
- **吃** only from the player on your left (the previous discard, if you are next). Same-suit sequence.
- **碰 / 明杠** from any discard. **暗杠** on your turn (replacement draw). 暗杠 **does not** open the hand (but 立胡 can still win).
- Tap a tile, then **Discard** (or double-click / Enter). Claim buttons: 吃 / 碰 / 杠 / 胡 / 过.

### 胡牌 (normal hand, 4 melds + pair)

All of these must be true:

1. **有刻** — at least one pung or kong (concealed or exposed). If you have no pung, **中 / 发 / 白 as the pair (将)** may substitute.
2. **带幺九** — the hand contains a 1 or 9 of a suit, **or** any wind/dragon.
3. **三门齐** — 万, 筒, and 条 all appear in the hand.
4. **立胡 OK** — closed hands are legal (and score +1 立胡). Opening is no longer required.

点炮 and 自摸 both allowed. 七对 is **not** implemented.

### Fan → cash (长春滚滚番)

Per payer: **`stake × 2^(fanTotal − 1)`**.

Shared stack on the win:

| Fan | Name |
|-----|------|
| 1 | 平胡 (base) |
| +1 | 自摸, 夹胡 (edge/middle/pair wait if detected), 庄胡 (winner is dealer — seat 0 / East), 立胡 (closed) |
| +2 | 飘胡 (all pungs) |

**点炮**: all three non-winners pay. Discarder’s amount uses shared fan **+1 放炮**; the other two use shared fan only.  
**自摸**: all three pay the shared fan (includes 自摸).

宝牌 / 对宝: not implemented.

### 蛋 / 杠 money (separate, not ×庄)

Settled **immediately** on kong:

- **明杠** (from discard): discarder pays `1 × stake`
- **补杠**: each other seat pays `1 × stake`
- **暗杠**: each other seat pays `2 × stake`

Special 旋风/喜/幺九蛋 are not in the engine.

## Money / bankrolls

- You (A / East) start with **$100**. Opponents L / J / C start with **$1000** each (visible on seat avatars).
- Before each hand you pick a **stake** (clamped to your cash). At **$0** the stake is $0 and you can still play; broke top-up restores **$10**.
- Human payments are clamped to wallet. AI cash moves for real; if an AI hits **≤ $0**, they refill to **$1000** and a beat is counted (persisted in `localStorage`).
- **荒庄** (wall exhausted): win stake does not move; egg money already settled stays.
- **下一局** keeps stacks; **重置** restores $100 / $1000 / $1000 / $1000.

## v1 limits

- No 七对, 十三幺, 抢杠, or bao/ting UI.
- AI is heuristic (open early, keep 幺九 and all three suits).
- You always sit East. Bankrolls persist until Reset.

## Shop

Open **约会**. Shared shop items: **Coffee $5**, **Cigarette $1**, **Beer $5**. One purchase from your wallet gives **both you and the opposite male** that prop in hand for a few seconds.

## Stack

Vite + TypeScript, vanilla DOM. Modules: `tiles`, `win` (legality + Changchun fan), `claims`, `ai`, `engine`, UI. Version: see `src/version.ts` / `package.json`.

## Tile art

Face artwork from [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles) (**CC0 / public domain**). Regular SVG faces are vendored under `public/tiles/` (see `public/tiles/LICENSE.md`). Ivory bevel frame, soft shadow, and green lattice backs are CSS in this project.

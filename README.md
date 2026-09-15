# AA 麻将 · 东北麻将

**AA 麻将** — a browser game of **Northeast China mahjong** (东北麻将, 辽宁 / 沈阳常见桌规) for 4 players: you plus 3 simple AIs. Static SPA, no backend.

This is **not** Hong Kong / Cantonese scoring. v1 follows a common Shenyang-style table: you must **open**, hold a **pung**, include a **terminal or honor**, and use **all three suits**.

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

## How to play

- **136 tiles**, no flowers: 万 / 条 / 筒 (1–9 × 4), winds 东南西北 × 4, dragons 中发白 × 4.
- Each player is dealt **13**. East (you) draws first to **14** and discards to start.
- Play is **counter-clockwise**: East → South → West → North.
- Turn: **draw** → optional **杠 / 胡** → **discard** one.
- **吃** only from the player on your left (the previous discard, if you are next). Same-suit sequence.
- **碰 / 明杠** from any discard. **暗杠** on your turn (replacement draw). 暗杠 **does not** open the hand.
- Tap a tile, then **Discard** (or double-click / Enter). Claim buttons: 吃 / 碰 / 杠 / 胡 / 过.

### 胡牌 (normal hand, 4 melds + pair)

All four must be true:

1. **开门** — you have eaten, pungen, or melded a kong. A concealed kong (暗杠) does **not** count.
2. **有刻** — at least one pung or kong (concealed or exposed). If you have no pung, **中 / 发 / 白 as the pair (将)** may substitute.
3. **带幺九** — the hand contains a 1 or 9 of a suit, **or** any wind/dragon.
4. **三门齐** — 万, 筒, and 条 all appear in the hand.

点炮 and 自摸 both allowed. 七对 is **not** implemented in v1.

A live checklist under the table tracks these four conditions.

## Money

- Everyone starts with **$100**.
- Before each hand you pick a **stake** (clamped to your cash). At **$0** the stake is $0 and you can still play.
- **点炮**: the player who discarded pays **one stake** to the winner (or whatever cash they still have).
- **自摸**: each of the other three pays **one stake** to the winner (or all they have).
- **荒庄** (wall exhausted): no money moves.
- Hitting $0 does **not** eliminate anyone. **下一局** keeps stacks; **重置** restores $100 each.

## v1 limits

- No 七对, 十三幺, 抢杠, or extra 东北 extras (站立 / 闭门清 / 幺九刻翻倍, etc.).
- Fan list is flavor; cash uses the flat stake scheme above.
- AI is heuristic (open early, keep 幺九 and all three suits).
- You always sit East. Bankrolls persist until Reset.

## Shop

Open **Shop 小卖部**. Shared shop items: **Coffee $5**, **Cigarette $1**, **Beer $5**. One purchase from your wallet gives **both you and the opposite male** that prop in hand for a few seconds.

## Stack

Vite + TypeScript, vanilla DOM. Modules: `tiles`, `win` (东北 checks), `claims`, `ai`, `engine`, UI.

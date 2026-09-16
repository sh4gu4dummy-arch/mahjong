# Grok thread handoff — Date Face holds

Saved 2026-09-16 so a later Grok chat can resume without this thread.

## Repo

- GitHub: https://github.com/sh4gu4dummy-arch/mahjong
- Owner is **sh4gu4dummy-arch**, not the X handle dummySh4Gu4
- Live: Cloudflare Pages (command-only). Do **not** use the Grok App Builder preview.
- GitHub Pages workflow was added after v1.4.44 (`9f3217c`) for a preview site from `main`
- Game version on `main`: **1.4.44** (`dcb6c3f`). `HOLD_POSE_V` / warmImages: **hold10**
- No git tag for 1.4.x (tags still stop at v1.3.5). No GitHub Releases.

## What shipped this thread

Date shop, A facing camera (`getAFace() === "camera"`):

- `public/chars/player-hold-beer-face.png`
- `public/chars/player-hold-coffee-face.png`
- `public/chars/player-hold-cigarette-face.png`

Idle Face A (locked identity): `public/chars/player-face.png` (280×720 RGBA pullover, hands in pocket).

Away (back) holds were **not** changed: `player-hold-{beer,coffee,cigarette}.png` and opposite-male holds.

Shop wiring already swaps Face vs Away in `playerFullSrc()` (`src/ui/app.ts`). Cache bust: bump `HOLD_POSE_V`, `src/main.ts` hold string, `VERSION`, `package.json`, `src/version.ts`, `public/sw.js` `CACHE` together. SW uses `ignoreSearch: true`.

## Do not repeat

v1.4.41–43 looked like “no change” because idle A’s **pocket body** was pasted onto the holds. Result: both hands in the hoodie, item stuck beside her. Male opposite still showed real holds.

**v1.4.44 rule:** keep the Imagine **right-arm-out** pose. Paste-lock **head/hair only** from `player-face.png`. Never copy idle A’s torso/pocket/hands. Zipper kill = cream paint on upper chest only (`y` ~165–250), not the pocket.

User bar: right hand out of kangaroo pocket, fingers wrapped around a **hand-sized** prop; left hand stays in pocket; same face/hair as locked A; pullover (no zipper).

## Code review leftovers (not done this thread)

- `src/game/win.ts` `tryForm` is greedy; can miss legal 3-chow shapes (e.g. 567×2 + 789)
- Dealer is always seat 0; no 庄 rotation
- `src/game/rules.ts` `loadRules()` is dead
- Next-hand confirmation strings unused

## How to resume

1. Connect GitHub; clone `sh4gu4dummy-arch/mahjong`
2. Confirm `VERSION` and `HOLD_POSE_V`
3. If Face holds still look pocketed on live: hard-refresh / unregister SW, then inspect the three `*-face.png` files — if those PNGs show a visible right forearm, it is cache; if not, regenerate from locked A plate and **do not** body-paste idle A

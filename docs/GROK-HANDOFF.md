# Grok thread handoff — AA Mahjong (mahj + mahj-sup)

Saved/updated 2026-09-16 so a later Grok chat can resume without this thread.

## Agents

- **mahj** (builder): implements AA Mahjong. Before non-trivial work, send mahj-sup a gate packet and wait for **Approve / Approve-with-changes / Reject**.
- **mahj-sup** (this role): reviews plans; does **not** implement/edit/push/deploy unless the user explicitly asks. Independent QA with proof for Face/assets when the user requires it.
- Packet must include: exact user words, interpretation (what stays vs changes), plan, out of scope, verify, deploy intent.
- Ask-understanding: quote decisive user lines (including corrections). Call out keep-English branding vs translate. If two readings are possible, stop and re-packet — do not implement the convenient guess.
- User “lmk” = text explanation only; do not implement/edit/push from that alone.

## Repo & versions (as of handoff)

- GitHub: https://github.com/sh4gu4dummy-arch/mahjong (owner **sh4gu4dummy-arch**)
- `main` tip should include GitHub Pages workflow (`9f3217c`) + this handoff doc
- Game version last promoted live: **1.4.44** (`dcb6c3f`). `HOLD_POSE_V` / warmImages: **hold10**
- No git tag for 1.4.x (tags still stop at v1.3.5). No GitHub Releases.

## Hosting (locked)

| Surface | Rule |
|--------|------|
| **Cloudflare Pages** https://aa-mahjong.pages.dev | Fed from **`live` branch only**. Update **only** on explicit user “push live”. Do **not** auto-point production at `main`. |
| **GitHub Pages** https://sh4gu4dummy-arch.github.io/mahjong/ | Auto-deploys from **`main`** via Actions. Prefer this for day-to-day preview (no quick tunnel required). |
| **Quick tunnel** (cloudflared → local vite `:4173`) | Fallback only. Should track newest `main` if used; mahj added weekday routine `aa-mahjong-tunnel-sync-to-main` (*/15 9–21) to pull+rebuild+refresh when main moves. trycloudflare hostnames change on restart — report new URL. |

Never paste API tokens into chat. Never deploy uncommitted WIP.

## What shipped (Face / Date)

Date shop, A facing camera (`getAFace() === "camera"`):

- `public/chars/player-hold-beer-face.png`
- `public/chars/player-hold-coffee-face.png`
- `public/chars/player-hold-cigarette-face.png`

Idle Face A (locked identity): `public/chars/player-face.png` (280×720 RGBA pullover, hands in pocket). Restored historically from `4f1af4a` + hair-harden; straight side-part; no waves.

Away (back) holds were **not** changed: `player-hold-{beer,coffee,cigarette}.png` and opposite-male holds.

Shop wiring swaps Face vs Away in `playerFullSrc()` (`src/ui/app.ts`). Cache bust: bump `HOLD_POSE_V`, `src/main.ts` hold string, `VERSION`, `package.json`, `src/version.ts`, `public/sw.js` `CACHE` together. SW uses `ignoreSearch: true`.

**Date branding:** In Chinese UI, shop still says English **Date** / `Date ❤️` / `Date · 钱包` (v1.4.39). Do **not** “fix” to 约会 unless the user asks.

## Do not repeat (Face holds)

v1.4.40: true body composites but **pocket hands + oversized sticker props** — mahj-sup wrongly PASSed on pixel-only; user rejected player-feel.

v1.4.41–43: looked like “no change” because idle A’s **pocket body** was pasted onto the holds → both hands in hoodie, item beside her.

**v1.4.44 rule:** keep the Imagine **right-arm-out** pose. Paste-lock **head/hair only** from `player-face.png`. Never copy idle A’s torso/pocket/hands. Zipper kill = cream paint on upper chest only (`y` ~165–250), not the pocket.

**User / QA bar (both required):**

1. **Player-feel first:** right hand out of kangaroo pocket, fingers wrapped around a **hand-sized** prop; left hand stays in pocket; looks held, not floating sticker; no giant props; no hoodie seam artifacts.
2. **Identity:** same face/hair as locked A (paste-lock head/hair); pullover (no zipper); no wavy regen; no full-body new person without Approve.
3. mahj-sup re-QA: visual hold+scale **before** pixel bands; show proof. No “pixel-only PASS.”

## Code review leftovers (not done)

- `src/game/win.ts` `tryForm` is greedy; can miss legal 3-chow shapes (e.g. 567×2 + 789)
- Dealer is always seat 0; no 庄 rotation
- `src/game/rules.ts` `loadRules()` is dead
- Next-hand confirmation strings unused

## Pending / clean at handoff

- Working intent: no open Approve packets required to close this thread.
- If local `main` was behind origin, fast-forward; keep working tree clean before leave.
- Confirm after resume: `VERSION`, `HOLD_POSE_V`, GH Pages serves main tip, CF Pages only moves on “push live”.

## How to resume

1. Connect GitHub; clone `sh4gu4dummy-arch/mahjong`
2. Read this file; confirm `VERSION` and `HOLD_POSE_V`
3. Day-to-day preview: https://sh4gu4dummy-arch.github.io/mahjong/ (not App Builder preview; not CF unless user said push live)
4. Non-trivial change → mahj packet → mahj-sup verdict → implement → (Face) independent QA with proof → ship `main` → GH Pages auto; CF only if user says push live
5. If Face holds look pocketed on a deployed site: hard-refresh / unregister SW, then inspect the three `*-face.png` files — if PNGs show a visible right forearm, it is cache; if not, regenerate from locked A plate and **do not** body-paste idle A

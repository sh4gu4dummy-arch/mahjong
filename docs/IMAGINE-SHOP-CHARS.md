# Imagine sets — shop full-body characters (AA Mahjong)

Drafted 2026-09-25 for Ash. Repo previously had **no** create-from-scratch SOP; Face-hold QA for A only lives in `GROK-HANDOFF.md`.

## Locked pipeline (match A / J)

| Step | Rule |
|------|------|
| Canvas | A plate **280×720** RGBA; J plate **300×760** RGBA. Use the same for L/C. Prefer **300×760** for all new full bodies so feet/height scale cleanly next to J. |
| Background | Solid **pure black** `#000000` (or pure chroma key) — later rembg / cutout to transparent PNG. No park bg in the render. |
| Style | Clean **2D anime / cel-shade**, thin line, soft gradients, modern casual streetwear — match `public/chars/player-*.png` + `opposite-*.png`, **not** the flat vector avatar look. |
| Pose idle | Standing, feet together-ish, full body head-to-toe, centered, bottoms near canvas bottom. |
| Cutout | Ship only RGBA cutouts (transparent corners). Run `npm run verify:cutouts` / scripts/verify-cutouts.mjs after add. See skill *Transparent overlay cutouts*. |
| Holds | Same body + wardrobe as idle. **Right arm out of pocket**, fingers around a **hand-sized** prop; left hand stays in pocket (A Face-hold rule). No floating sticker props; no pocketed idle body paste. |
| Identity | Paste-lock / img2img face+hair from the **avatar** crop for that letter. Do not invent a new face. |
| Files to drop | `public/chars/{left,right}-full.png` and `{left,right}-hold-{beer,coffee,cigarette}.png` Wire in code after art lands. |

Seat map (table): **0=A you, 1=L right, 2=J opp, 3=C left**.  
Avatar refs: L = `public/avatars/right.png`, C = `public/avatars/left.png`.

Height in UI (code): **J tallest**; L/C ≈ just under J (near A+ / not dwarfed); A petite. Side slots size L/C near center-A scale.

---

## Shared negative prompt (all gens)

```
photorealistic, 3d render, plastic skin, western cartoon, chibi, oversized head, cropped feet, cropped head, sitting, kneeling, dynamic action pose, weapon, text, watermark, logo, frame, border, white background, grey plate, park background, busy background, floating props, giant prop, both hands in pockets on hold pose, zipper hoodie for A-style cream pullover mistakes, wavy regen hair unless character is L
```

---

## Character L (seat right · `avatars/right.png`)

**Identity lock:** Young woman, **medium-warm brown skin**, large dark brown eyes, soft smile. **Dark brown / near-black wavy hair** in a **high voluminous ponytail** with a **sage-green scrunchie**; loose strands / side-bangs framing the face. Casual: **white crew-neck tee** under an **open sage-green collared shirt/light jacket**; dark jeans or soft olive trousers; simple white or sage sneakers. Friendly, approachable. Same art language as A/J full bodies (not flat avatar).

### L1 — idle full (`right-full.png`)
```
Full-body 2D anime cel-shaded game character sprite of a young woman, standing facing camera, hands casually in jacket or pants pockets, medium-warm brown skin, large dark brown eyes, gentle closed-mouth smile, dark brown wavy hair in a high ponytail with sage-green scrunchie, side-bangs framing face, white crew-neck t-shirt under open sage-green collared shirt, olive or dark jeans cuffed at ankles, white sneakers, clean thin line art, soft cel shading, modern mobile-game character art matching AA Mahjong shop sprites, centered full figure head to toe, pure black background, transparent-cutout ready, 300x760
```
**Refs:** attach `avatars/right.png` (face lock) + `chars/opposite-full.png` or `player-face.png` (style/pose density). Strength: face high, body medium.

### L2 — hold beer (`right-hold-beer.png`)
```
Same character and outfit as L idle: young woman medium-warm brown skin, high dark wavy ponytail sage scrunchie, white tee under open sage jacket. Standing full body facing camera. LEFT hand stays in pocket. RIGHT arm extended slightly forward/out of pocket, fingers wrapped around a small hand-sized amber beer bottle (realistic scale, not giant). Clean 2D anime cel-shade, thin lines, pure black background, 300x760, AA Mahjong shop hold pose
```

### L3 — hold coffee (`right-hold-coffee.png`)
```
Same L character and outfit. Standing full body facing camera. LEFT hand in pocket. RIGHT hand holding a small takeaway coffee cup with lid at chest/hand height (hand-sized). Clean 2D anime cel-shade, pure black background, 300x760
```

### L4 — hold cigarette (`right-hold-cigarette.png`)
```
Same L character and outfit. Standing full body facing camera. LEFT hand in pocket. RIGHT hand raised near chest holding a thin cigarette between fingers (small, not a cigar). Clean 2D anime cel-shade, pure black background, 300x760
```

---

## Character C (seat left · `avatars/left.png`)

**Identity lock:** Young woman, warm light skin, large dark almond eyes, friendly smile showing a hint of teeth. **Dark hair in a neat low bun**, side part, two thin curved strands framing the face. Outfit from avatar: **pale sage / mint crossover V-neck soft robe or wrap top** (minimal traditional-casual hybrid), soft pants or wide straight trousers in cream/sage, simple flat shoes or white sneakers. Softer, calmer vibe than L. Same 2D anime shop style as A/J.

### C1 — idle full (`left-full.png`)
```
Full-body 2D anime cel-shaded game character sprite of a young woman, standing facing camera, relaxed arms / hands lightly at sides or one hand resting at waist, warm light skin, large dark almond eyes, gentle smile, dark hair in a neat low bun with side part and two thin face-framing strands, pale sage mint crossover V-neck wrap top, soft cream or sage trousers, simple white flat shoes, clean thin line art, soft cel shading, modern mobile-game character art matching AA Mahjong shop sprites, centered full figure head to toe, pure black background, transparent-cutout ready, 300x760
```
**Refs:** attach `avatars/left.png` (face lock) + `chars/player-full.png` or `player-face.png` (style).

### C2 — hold beer (`left-hold-beer.png`)
```
Same C character and outfit. Standing full body facing camera. LEFT hand relaxed near pocket/hip. RIGHT arm out, fingers wrapped around a small hand-sized amber beer bottle. Clean 2D anime cel-shade, pure black background, 300x760, AA Mahjong shop hold pose
```

### C3 — hold coffee (`left-hold-coffee.png`)
```
Same C character and outfit. Standing full body facing camera. RIGHT hand holding a small takeaway coffee cup with lid (hand-sized). Clean 2D anime cel-shade, pure black background, 300x760
```

### C4 — hold cigarette (`left-hold-cigarette.png`)
```
Same C character and outfit. Standing full body facing camera. RIGHT hand holding a thin cigarette between fingers. Clean 2D anime cel-shade, pure black background, 300x760
```

---


---

## Shipped v1.4.49

Full-body L (`right-*`) and C (`left-*`) idle + beer/coffee/cigarette holds are on disk under `public/chars/` and wired in `shopFigureSrc` (kind `"full"`). Cache bust `HOLD_POSE_V=hold11`.

**Caveat:** C beer hold (`left-hold-beer.png`) may show the bottle in the **left** hand — acceptable for v1; re-gen later if needed.

## After Imagine

1. Background-remove → RGBA; tight crop; match A/J vertical framing (feet near bottom).
2. Drop files under `public/chars/` with names above.
3. Add paths to `scripts/verify-cutouts.mjs`, `public/sw.js`, `src/main.ts` warm list; wire `shopFigureSrc` for L/C to full/hold like A/J.
4. Bump `HOLD_POSE_V` / cache bust if replacing holds.
5. Visual QA on park shop: L/C full bodies, J taller than A, no rectangular plate.

## Out of scope for this draft

- Regenerating A or J plates
- Camera/away face variants for L/C
- Pushing art until Ash / Imagine approves picks

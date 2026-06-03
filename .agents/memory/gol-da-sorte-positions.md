---
name: Gol da Sorte ball overlay positions
description: Pixel-scan confirmed ball centers (yFrac) in IMG_7715 image and clickable overlay layout for the Gol da Sorte PWA
---

## Image dimensions
1125 × 2175 px, aspect ratio 0.5172

## Pixel scan results (Canvas API, threshold=50 luminance)
Ball bright-band centers from browser Canvas scan:
- R5 (prize, top): band 2 → yFrac center **0.255**
- R4 (VALENDO+5): band 3 → yFrac center **0.359**
- R3 (VALENDO+1): band 6 → yFrac center **0.466**
- R2 (plain row): band 9 → yFrac center **0.587**
- R1 (plain row): band 10 → yFrac center **0.697**
- R0 (bottom, near JOGAR): band 11 → yFrac center **0.806**
- JOGAR button: band 12 → yFrac [0.860, 0.905]

Note: For VALENDO rows (R3, R4), the bright shelf/label appears as secondary sub-bands just below the ball band. Use only the FIRST (highest) band for the ball center.

## Applied overlay positions (center ± 0.042)
```
R0: y=[0.764, 0.848], x=[[0.048,0.210],[0.218,0.382],[0.390,0.553]]
R1: y=[0.655, 0.739], x=[[0.048,0.210],[0.218,0.382],[0.390,0.553]]
R2: y=[0.545, 0.629], x=[[0.048,0.210],[0.218,0.382],[0.390,0.553]]
R3: y=[0.424, 0.508], x=[[0.198,0.360],[0.368,0.530],[0.538,0.670]]
R4: y=[0.317, 0.401], x=[[0.198,0.360],[0.368,0.530],[0.538,0.670]]
R5: y=[0.213, 0.297], x=[[0.048,0.210],[0.218,0.382],[0.390,0.553]]
JOGAR: ov(0.030, 0.860, 0.560, 0.045)
```

## Row wrong-ball counts
ROW_WRONG_COUNT = [1, 1, 2, 2, 2, 1]  (R0→R5, 1 wrong = 2 correct, 2 wrong = 1 correct)

## How to re-scan
In App.tsx set `scanImageRows(e.currentTarget)` on the img onLoad, run app, read browser console logs. The scanner uses Canvas API + luminance threshold 50 over the left 60% of image width.

**Why:** Previous manual/visual estimates were inconsistent across rows (off by up to 0.076 in yFrac). Pixel scan via Canvas API is the only reliable method. Different rows needed opposite direction corrections so uniform shifts always broke other rows.

**How to apply:** If alignment complaints return, run the pixel scan again (it's already coded in App.tsx as `scanImageRows`), compare band centers to current ROWS constants, adjust center ± 0.042 for each row.

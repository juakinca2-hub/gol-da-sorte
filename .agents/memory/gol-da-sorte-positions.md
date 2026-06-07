---
name: Gol da Sorte ball overlay positions
description: Pixel-scan + real device tap calibration confirmed ball centers (yFrac) and clickable overlay layout for the Gol da Sorte PWA
---

## Image dimensions
1125 × 2175 px, aspect ratio 0.5172

## Device calibration data (user's iPhone, viewport 375×619)
User tapped center of each ball, recorded by TOUCH_CALIB mode:
- R5: y=0.255, x≈0.261
- R4: y=0.359, x≈0.355
- R3: y=0.451, x≈0.353
- R2: y=0.586, x≈0.245
- R1: y=0.696, x≈0.245
- R0: not tapped (extrapolated from pixel scan: 0.806)

## Applied overlay positions (center ± 0.042 in y)
```
R0: y=[0.764, 0.848], x=[[0.048,0.210],[0.218,0.382],[0.390,0.553]]
R1: y=[0.654, 0.738], x=[[0.048,0.210],[0.218,0.382],[0.390,0.553]]
R2: y=[0.544, 0.628], x=[[0.048,0.210],[0.218,0.382],[0.390,0.553]]
R3: y=[0.409, 0.493], x=[[0.190,0.370],[0.375,0.530],[0.535,0.670]]
R4: y=[0.317, 0.401], x=[[0.190,0.370],[0.375,0.530],[0.535,0.670]]
R5: y=[0.213, 0.297], x=[[0.048,0.210],[0.218,0.382],[0.390,0.553]]
JOGAR: ov(0.030, 0.860, 0.560, 0.045)
```

## Key findings
- R3 (VALENDO+1) real center is y=0.451, NOT 0.466 from pixel scan (9px discrepancy)
- VALENDO rows (R3, R4) balls start further left: Ball 0 covers x=[0.190, 0.370]
- Plain rows (R0, R1, R2, R5) x positions confirmed accurate via pixel scan
- R5, R4, R2, R1 y positions matched pixel scan exactly

## Row wrong-ball counts
ROW_WRONG_COUNT = [1, 1, 2, 2, 2, 1]  (R0→R5, 1 wrong = 2 correct, 2 wrong = 1 correct)

## Visual circle
Inner circle is 62% of overlay area (centered). Outer div is transparent click area.

## How to re-calibrate
Set TOUCH_CALIB=true in App.tsx, use onTouchEnd (NOT onTouchStart — iOS needs changedTouches).
Ask user to tap center of ONE ball per row and photograph the "Últimos toques" panel.

**Why:** Manual/visual estimates were inconsistent. R3 pixel scan gave 0.466 but real device tap showed 0.451. Always trust real device tap data over pixel scan when available.

**How to apply:** If alignment complaints return, enable TOUCH_CALIB=true and collect fresh tap data.

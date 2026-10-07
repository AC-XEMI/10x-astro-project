# Token value source — deviation-rule series (`--rule-*`)

Added in Phase 2 of `dashboard-ui-tokens`. The dashboard coloured the three deviation
rules with opacity steps of `--primary` (`bg-primary`, `/55`, `/25`), which fell below
WCAG 1.4.11's 3:1 non-text contrast against `--card` in both themes (see
`research.md`, charge 1). These tokens replace them.

## Values

Source: Tailwind CSS v4 default palette, `node_modules/tailwindcss/theme.css`
(`--color-indigo-500/600` at `:147-148`, `--color-teal-400/600` at `:98,100`,
`--color-amber-400/600` at `:38,40`) — the installed version in this repo.

| Token          | Theme           | Value                                           | Tailwind name | Contrast vs `--card` |
| -------------- | --------------- | ----------------------------------------------- | ------------- | -------------------- |
| `--rule-gps`   | `:root` (light) | `var(--primary)` = `oklch(51.1% 0.262 276.966)` | indigo-600    | 6.44:1               |
| `--rule-gps`   | `.dark`         | `var(--primary)` = `oklch(58.5% 0.233 277.117)` | indigo-500    | 3.91:1               |
| `--rule-phone` | `:root` (light) | `oklch(0.6 0.118 184.704)`                      | teal-600      | 3.66:1               |
| `--rule-phone` | `.dark`         | `oklch(0.777 0.152 181.912)`                    | teal-400      | 9.60:1               |
| `--rule-route` | `:root` (light) | `oklch(0.666 0.179 58.318)`                     | amber-600     | 3.19:1               |
| `--rule-route` | `.dark`         | `oklch(0.828 0.189 84.429)`                     | amber-400     | 10.43:1              |

`--card` is `oklch(1 0 0)` in light and `oklch(0.205 0 0)` in dark (`global.css`).
`--rule-gps` references `--primary` on purpose: GPS stays the brand colour, and a future
rebrand of `--primary` moves it too — re-check its contrast when that happens.

Each hue is the same family in both themes (indigo / teal / amber), so a rule keeps its
colour when the theme toggle flips.

## Method

oklch → OKLab → linear sRGB (clamped) → WCAG 2.x relative luminance
(0.2126 R + 0.7152 G + 0.0722 B), contrast = (L1 + 0.05) / (L2 + 0.05). Computed with a
one-off Node script during planning and re-run in Phase 2; the numbers above are the
re-run output.

## Rejected options

| Option                                | Why not                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Keep `bg-primary/55`, `bg-primary/25` | 2.63:1 / 1.50:1 (light), 2.02:1 / 1.31:1 (dark) vs card                                                                         |
| Map onto `--chart-1..3`               | shadcn chart tokens swap hue between themes (`--chart-1` orange in light, blue in dark), and `--chart-1` dark is 2.63:1 vs card |
| One hue, three lightness steps        | Hard to keep all three ≥3:1 vs card and clearly apart from each other; weakest for colour-vision deficiencies                   |

## Usage

Classes `bg-rule-gps`, `bg-rule-phone`, `bg-rule-route`, mapped per rule in
`src/lib/rule-series.ts` (`RULE_SERIES`, `RULE_SERIES_ORDER`). Do not colour a rule series
with `primary/NN` or a palette class.

# Token value source — dark `--primary` / `--primary-foreground`

Changed in Phase 1 of `landing-ui-contract`. The landing audit (`research.md`, charge 1)
measured the dark brand pair below WCAG's 4.5:1 for small text in both directions. The light
theme is unchanged.

## Values

Source: Tailwind CSS v4 default palette, `node_modules/tailwindcss/theme.css:146`
(`--color-indigo-400`), installed version in this repo.

| Token                               | Theme   | Before                                    | After                                            |
| ----------------------------------- | ------- | ----------------------------------------- | ------------------------------------------------ |
| `--primary`                         | `.dark` | `oklch(58.5% 0.233 277.117)` (indigo-500) | `oklch(67.3% 0.182 276.935)` (indigo-400)        |
| `--primary-foreground`              | `.dark` | `oklch(0.985 0 0)` (near-white)           | `oklch(0.205 0 0)` (near-black, = dark `--card`) |
| `--primary`, `--primary-foreground` | `:root` | unchanged (indigo-600, near-white)        | unchanged                                        |

## Contrast (dark theme)

| Pair                                                             | Before | After | Threshold                 |
| ---------------------------------------------------------------- | ------ | ----- | ------------------------- |
| `text-primary` on `--background` (`oklch(0.145 0 0)`)            | 4.32   | 6.34  | 4.5 (small text)          |
| `--primary-foreground` on `--primary`                            | 4.38   | 5.74  | 4.5 (button labels, 14px) |
| `--rule-gps` (`var(--primary)`) vs `--card` (`oklch(0.205 0 0)`) | 3.91   | 5.74  | 3 (non-text series)       |

Light theme for reference (unchanged): 6.44 / 6.17 / 6.44.

Method: oklch → OKLab → linear sRGB (clamped) → WCAG 2.x relative luminance, contrast =
(L1 + 0.05) / (L2 + 0.05). Re-run in Phase 1 by a one-off Node script that reads the values
from `src/styles/global.css` itself (exit 0 on the new file, exit 1 on the previous commit).

## Affected surfaces

Every surface that puts text on `--primary` uses the token, so all move together:

- `src/components/ui/button.tsx:12` — `default` variant (`bg-primary text-primary-foreground`): every primary button in the app.
- `src/components/Welcome.astro:245` — step-number badges; `:337` — CTA band (`bg-primary text-primary-foreground`).
- `src/layouts/AuthLayout.astro:17-18` — brand panel on sign-in / sign-up / confirm-email.
- `src/styles/global.css` `--rule-gps: var(--primary)` — dashboard GPS series (legend, trend, ranking bar).
- Every `text-primary` link / label (landing eyebrow, footer link, "Wszystkie" on the dashboard, …).

Not affected: the destructive button (`text-white` on `--destructive`), `--ring`, tints
`bg-primary/10` (still the same hue family).

## Rejected options

| Option                                                      | Why not                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Keep indigo-500 fill, add a `--primary-text` token for text | Button labels stay at 4.38:1; a second token to remember at every `text-primary` |
| Darker dark fill with white text                            | Fixes button labels, makes `text-primary` on the dark background worse           |
| indigo-400 with white text                                  | White on indigo-400 is 2.99:1                                                    |
| indigo-300 with dark text                                   | Passes (9.85 / 8.92) but drifts far from the light-theme brand colour            |

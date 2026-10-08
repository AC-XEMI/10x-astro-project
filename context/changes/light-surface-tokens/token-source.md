# Token value source — light `--background`

Changed in Phase 1 of `light-surface-tokens`. In the light theme the page, cards and popovers were
all `oklch(1 0 0)`, so surfaces separated from the page by border only. The light page now gets a
neutral-50 tint; every surface on top of it stays white. The dark theme tokens are unchanged.

## Values

Source: Tailwind CSS v4 default palette, `node_modules/tailwindcss/theme.css:250` (`--color-neutral-50`
is `oklch(98.5% 0 none)`), the same step already used for light `--sidebar`.

| Token                    | Theme   | Before           | After                          |
| ------------------------ | ------- | ---------------- | ------------------------------ |
| `--background`           | `:root` | `oklch(1 0 0)`   | `oklch(0.985 0 0)` (neutral-50) |
| `--card`, `--popover`    | `:root` | `oklch(1 0 0)`   | unchanged                      |
| all tokens               | `.dark` | —                | unchanged                      |

## Contrast (light theme)

| Pair                                       | Before | After | Threshold        |
| ------------------------------------------ | ------ | ----- | ---------------- |
| `--foreground` on `--background`           | 19.79  | 18.96 | 4.5              |
| `--muted-foreground` on `--background`     | 4.73   | 4.53  | 4.5              |
| `text-primary` on `--background`           | 6.44   | 6.17  | 4.5              |
| `text-destructive` on `--background`       | 4.76   | 4.56  | 4.5              |
| `text-success` on `--background`           | 4.94   | 4.73  | 4.5              |
| `--card` vs `--background`                 | 1.00   | 1.04  | — (informational) |

0.985 is the darkest neutral step that keeps `--muted-foreground` ≥ 4.5 on the page (0.97 → 4.34).
Consequence: no band or panel *darker* than the page may carry `text-muted-foreground` directly.
`--muted-foreground` on `--muted` is 4.34 (unchanged by this change — pre-existing, both before and
after); that is why the landing bands moved to `bg-card` instead of `bg-muted` (see below).

Method: oklch → OKLab → linear sRGB (clamped) → WCAG 2.x relative luminance, contrast =
(L1 + 0.05) / (L2 + 0.05) — same as `context/archive/2026-10-07-landing-ui-contract/token-source.md`.
Computed by a one-off Node script that reads the `:root` values from `src/styles/global.css`
itself, run against the new file and against `git show HEAD:src/styles/global.css` (the "Before"
column).

## Affected surfaces

`bg-background` is now the page only. Surfaces on top of it use the surface roles:

- `src/components/ui/card.tsx`, `src/components/ui/alert.tsx` — already `bg-card`, white on the tinted page.
- `src/components/ui/button.tsx` — `outline` variant `bg-background` → `bg-card` (dark keeps `dark:bg-input/30`).
- `src/components/ui/dialog.tsx` — `DialogContent` `bg-background` → `bg-popover dark:bg-background` (dark unchanged).
- `src/components/Welcome.astro` — bands `#jak` and `#mozliwosci` `bg-muted/50` → `bg-card`: white bands
  on the tinted page keep the section rhythm and keep their `text-muted-foreground` intros at 4.73.
  Planned as `bg-muted`, changed during Phase 1 because `--muted-foreground` on `--muted` is 4.34
  (and `bg-muted/50` over the tinted page ≈ 4.42). In dark the bands become `--card` (0.205) on the
  0.145 page.
- Form fields (`src/components/auth/FormField.tsx`) are `bg-transparent` and follow their surface.

# Token value source — `--primary` brand color

Added mid-implementation, Phase 1, after manual verification showed Topbar nav
icons rendering black once their literal `text-indigo-600` was replaced by
tokens (`--primary` was Tailwind's default `neutral`, fully achromatic —
`components.json` ships `baseColor: "neutral"`, never customized after the
"Kontrola Trasówek" rebrand).

`indigo-600` was the de facto brand color used as a literal throughout the
pre-token codebase (`bg-indigo-600`/`text-indigo-600` in `reports/index.astro`,
`Topbar.astro`, `ReportsList.tsx`). This promotes that literal into the
already-existing `--primary` token slot instead of leaving it unset or
inventing a second color system.

## Values

Source: `node_modules/tailwindcss/theme.css:147-148` (Tailwind CSS v4 default
palette, installed version in this repo).

| Token | Theme | Value | Tailwind name |
| --- | --- | --- | --- |
| `--primary` | `:root` (light) | `oklch(51.1% 0.262 276.966)` | `indigo-600` |
| `--primary-foreground` | `:root` (light) | unchanged — existing near-white | — |
| `--primary` | `.dark` | `oklch(58.5% 0.233 277.117)` | `indigo-500` |
| `--primary-foreground` | `.dark` | `oklch(0.985 0 0)` (white) — overrides the previous near-black value, which assumed a light/near-white `.dark` primary | — |

No other token (`--ring`, `--accent`, `--secondary`, etc.) was changed — only
the brand/CTA color slot.

// UI token check for the dashboard (Pulpit): fails when a dashboard file gains a colour literal,
// a Tailwind palette class, an unlisted arbitrary value, or an opacity step of --primary used as a
// colour (series colours must come from the --rule-* tokens via src/lib/rule-series.ts).
// Patterns follow the /10x-ui hardcoded-value scan; see context/archive/2026-10-07-dashboard-ui-tokens/.
// Zero dependencies. Not wired into CI or lint-staged - run with `npm run check:ui-tokens`.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const dashboardDir = "src/components/dashboard";
const files = [
  "src/pages/dashboard.astro",
  "src/lib/rule-series.ts", // source of the series colour classes
  ...readdirSync(path.join(root, dashboardDir))
    .filter((name) => /\.(astro|tsx)$/.test(name))
    .map((name) => `${dashboardDir}/${name}`),
];

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const RULES = [
  { name: "colour literal", re: /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/g },
  {
    name: "palette class",
    re: new RegExp(`\\b(bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide)-(${PALETTE})\\b`, "g"),
  },
  {
    name: "primary opacity step (use a --rule-* token for series)",
    re: /\b(bg|text|border|fill|stroke)-primary\/\d+/g,
  },
  // Any Tailwind arbitrary value (px, %, fr, var(), calc() ...), not just px/rem.
  { name: "arbitrary value", re: /[\w-]+-\[[^\]\s]+\]/g },
];

// Known, reviewed arbitrary values (context/archive/2026-10-07-dashboard-ui-tokens/research.md, Deferred).
const ALLOWED_ARBITRARY = new Set([
  "max-w-[1100px]", // page width shared by 5 views - layout change, not this view's
  "h-[180px]", // trend chart height, coupled to the 130px max bar
  "w-[150px]", // ranking "Struktura" column, coupled to MAX_BAR_PX
  "ring-[3px]", // focus ring width, same as src/components/ui/button.tsx
  "grid-cols-[1.4fr_1fr]", // trend chart vs recent reports split, from the Claude Design mockup
]);

const hits = [];
for (const file of files) {
  const lines = readFileSync(path.join(root, file), "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      for (const match of line.matchAll(rule.re)) {
        if (rule.name === "arbitrary value" && ALLOWED_ARBITRARY.has(match[0])) continue;
        hits.push(`${file}:${index + 1}  ${rule.name}: ${match[0]}`);
      }
    }
  });
}

if (hits.length > 0) {
  console.error(`check:ui-tokens FAILED (${hits.length} hit${hits.length === 1 ? "" : "s"}):`);
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log(`check:ui-tokens OK (${files.length} files: ${files.join(", ")})`);

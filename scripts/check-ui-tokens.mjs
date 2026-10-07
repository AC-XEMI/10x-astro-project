// UI token check for the dashboard (Pulpit), the reports list (Raporty), the landing page (Strona startowa) and the report details (Szczegóły raportu): fails when a scanned file gains a colour literal,
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
  // Reports list (context/archive/2026-10-07-reports-list-ui-contract/).
  "src/pages/reports/index.astro",
  "src/components/reports/ReportsList.tsx",
  "src/components/reports/ReportUpload.tsx",
  "src/components/ui/alert.tsx",
  // Landing page (context/archive/2026-10-07-landing-ui-contract/).
  "src/components/Welcome.astro",
  // Report details (context/changes/report-details-ui-contract/).
  "src/pages/reports/[id].astro",
  "src/components/reports/DeviationsList.tsx",
  "src/components/reports/ReportLoadError.astro",
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
  // Any Tailwind arbitrary value (px, %, fr, var(), calc() ...), not just px/rem. A bracket followed by
  // ":" is a variant selector (has-[>svg]:, data-[slot=x]:), not a value, so it is skipped.
  { name: "arbitrary value", re: /[\w-]+-\[[^\]\s]+\](?!:)/g },
];

// Known, reviewed arbitrary values (context/archive/2026-10-07-dashboard-ui-tokens/research.md, Deferred).
const ALLOWED_ARBITRARY = new Set([
  "max-w-[1100px]", // page width shared by 5 views - layout change, not this view's
  "h-[180px]", // trend chart height, coupled to the 130px max bar
  "w-[150px]", // ranking "Struktura" column, coupled to MAX_BAR_PX
  "ring-[3px]", // focus ring width, same as src/components/ui/button.tsx
  "grid-cols-[1.4fr_1fr]", // trend chart vs recent reports split, from the Claude Design mockup
  // Reports list upload card, kept at the Claude Design ("Dialogi i błędy") dimensions on request.
  "pl-[18px]", // fix-list indent
  "border-[1.5px]", // dashed drop-zone outline
  // shadcn alert layout (src/components/ui/alert.tsx), as generated.
  "grid-cols-[0_1fr]",
  "grid-cols-[calc(var(--spacing)*4)_1fr]",
  // Landing headline from the Claude Design file (no Tailwind scale equivalent).
  "text-[44px]",
  "leading-[1.1]",
  // Claude Design report details layout (no Tailwind scale equivalent).
  "transition-[width]", // progress bar fill animates width only
  "grid-cols-[300px_minmax(0,1fr)]", // expanded visit: context column vs broken rules
  "grid-cols-[1.2fr_repeat(3,1fr)_1.3fr]", // summary tiles row
]);

// Opacity steps of --primary that are tints, not data-series colours (series use --rule-*).
// Keyed by file, so the dashboard keeps the strict "no primary/NN" rule for its series colours.
const ALLOWED_PRIMARY_TINTS = new Map([
  // upload icon chip / drag-over fill (Claude Design upload card), landing feature icon chips and the
  // report details "Sprawdzone" status pill
  [
    "bg-primary/10",
    [
      "src/components/reports/ReportUpload.tsx",
      "src/components/Welcome.astro",
      "src/components/reports/DeviationsList.tsx",
    ],
  ],
]);

const hits = [];
for (const file of files) {
  const lines = readFileSync(path.join(root, file), "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      for (const match of line.matchAll(rule.re)) {
        if (rule.name === "arbitrary value" && ALLOWED_ARBITRARY.has(match[0])) continue;
        if (rule.name.startsWith("primary opacity step") && ALLOWED_PRIMARY_TINTS.get(match[0])?.includes(file))
          continue;
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

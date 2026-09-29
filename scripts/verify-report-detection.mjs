// Report detection verification: proves parseReportFile + detectMissingGps/detectRouteDeviations
// produce the expected deviations for both supported file formats (CSV and XLSX), without
// needing a local Supabase instance.
// Zero dependencies beyond the project's own source modules. Node (>= 22.6, type-stripping)
// can import the referenced .ts files directly. report-parser.ts's only cross-module import
// (`import type { Json } from "@/types"`) is type-only and erased at strip time, but
// deviation-rules.ts also does `import { haversineDistanceKm } from "@/lib/services/geo"` —
// a real runtime import using the `@/*` -> `src/*` path alias from tsconfig.json, which Node's
// native type-stripping does NOT apply (it strips types, it doesn't read tsconfig `paths`).
// A tiny inline resolve hook (registered as a data: URL, so no extra loader file is needed)
// teaches Node that one alias before dynamically importing the modules that need it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcUrl = pathToFileURL(path.join(__dirname, "..", "src") + path.sep).href;

const resolveHookSource = `
  export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      let target = new URL(specifier.slice(2), "${srcUrl}").href;
      if (!/\\.[a-zA-Z0-9]+$/.test(target)) target += ".ts";
      return nextResolve(target, context);
    }
    return nextResolve(specifier, context);
  }
`;
register(`data:text/javascript,${encodeURIComponent(resolveHookSource)}`, import.meta.url);

const { parseReportFile } = await import("../src/lib/services/report-parser.ts");
const { detectMissingGps, detectRouteDeviations } = await import("../src/lib/services/deviation-rules.ts");

// Index-based (0-indexed, header excluded) since "Tomasz Kowalczyk" appears twice in the
// fixture — only his 2nd row (Klient S) is missing_gps, so a name-based list is no longer
// precise enough to disambiguate.
const EXPECTED_MISSING_GPS_INDEXES = [1, 3, 8]; // Anna Nowak, Katarzyna Zielińska, Tomasz Kowalczyk (Klient S)
const EXPECTED_ROUTE_DEVIATION_INDEXES = [4, 6, 8]; // Ewa Testowa, Marek Nowicki (Klient Q), Tomasz Kowalczyk (Klient S)
const EXPECTED_BOTH_RULES_INDEX = 8; // Tomasz Kowalczyk (Klient S): missing_gps AND route_deviation
const EXPECTED_ZERO_DEVIATION_INDEXES = [0, 2, 5, 7]; // Jan Kowalski, Piotr Wiśniewski, Marek Nowicki (Klient P), Tomasz Kowalczyk (Klient R)

function readAsArrayBuffer(filePath) {
  const buffer = readFileSync(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

let failed = 0;
function record(ok, name) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

function sameNumberSet(actual, expected) {
  if (actual.length !== expected.length) return false;
  const sortedActual = [...actual].sort((a, b) => a - b);
  const sortedExpected = [...expected].sort((a, b) => a - b);
  return sortedActual.every((value, index) => value === sortedExpected[index]);
}

function verifyFixture(filename) {
  const filePath = path.join(__dirname, "..", "test-data", filename);
  const bytes = readAsArrayBuffer(filePath);
  const result = parseReportFile(bytes, filename);

  if ("error" in result) {
    record(false, `${filename}: parseReportFile succeeds (got error: ${result.error})`);
    return;
  }
  record(true, `${filename}: parseReportFile succeeds`);
  record(result.rows.length === 9, `${filename}: parses exactly 9 data rows`);

  // --- missing_gps (per-visit) ---
  const missingGpsIndexes = result.rows
    .map((visit, index) => ({ index, flagged: detectMissingGps(visit) === "missing_gps" }))
    .filter((entry) => entry.flagged)
    .map((entry) => entry.index);

  record(
    sameNumberSet(missingGpsIndexes, EXPECTED_MISSING_GPS_INDEXES),
    `${filename}: exactly 3 missing_gps deviations (Anna Nowak, Katarzyna Zielińska, Tomasz Kowalczyk/Klient S)`,
  );

  // --- route_deviation (whole-array, needs Tables<"visits">-shaped rows with an id) ---
  const syntheticVisits = result.rows.map((row, index) => ({ ...row, id: String(index) }));
  const routeDeviationFlags = detectRouteDeviations(syntheticVisits);
  const routeDeviationIndexes = routeDeviationFlags.map((flag) => Number(flag.visit_id));

  record(
    sameNumberSet(routeDeviationIndexes, EXPECTED_ROUTE_DEVIATION_INDEXES),
    `${filename}: exactly 3 route_deviation flags (Ewa Testowa, Marek Nowicki/Klient Q, Tomasz Kowalczyk/Klient S)`,
  );

  const outsidePlanFlag = routeDeviationFlags.find((flag) => flag.visit_id === "4");
  record(
    Boolean(outsidePlanFlag && outsidePlanFlag.detail.includes("poza zaplanowaną trasą")),
    `${filename}: Ewa Testowa's flag detail mentions "poza zaplanowaną trasą"`,
  );

  const excessDistanceFlags = routeDeviationFlags.filter((flag) => flag.visit_id === "6" || flag.visit_id === "8");
  record(
    excessDistanceFlags.length === 2 && excessDistanceFlags.every((flag) => flag.detail.includes("nadmiarowy dystans")),
    `${filename}: Marek Nowicki/Klient Q and Tomasz Kowalczyk/Klient S flag details mention "nadmiarowy dystans"`,
  );

  // --- both rules on the same visit (US-01 acceptance criterion) ---
  const bothRulesVisit =
    missingGpsIndexes.includes(EXPECTED_BOTH_RULES_INDEX) && routeDeviationIndexes.includes(EXPECTED_BOTH_RULES_INDEX);
  record(
    bothRulesVisit,
    `${filename}: Tomasz Kowalczyk's 2nd row (Klient S) is flagged by BOTH missing_gps and route_deviation`,
  );

  // --- zero deviations from either rule combined ---
  const zeroDeviationIndexes = result.rows
    .map((_, index) => index)
    .filter((index) => !missingGpsIndexes.includes(index) && !routeDeviationIndexes.includes(index));
  record(
    sameNumberSet(zeroDeviationIndexes, EXPECTED_ZERO_DEVIATION_INDEXES),
    `${filename}: exactly 4 visits have zero deviations (Jan Kowalski, Piotr Wiśniewski, Marek Nowicki/Klient P, Tomasz Kowalczyk/Klient R)`,
  );
}

verifyFixture("sample-report.csv");
verifyFixture("sample-report.xlsx");

console.log(failed ? `\n${failed} assertion(s) failed` : "\nAll report detection checks passed");
process.exit(failed ? 1 : 0);

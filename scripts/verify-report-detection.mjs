// Report detection verification: proves parseReportFile + detectMissingGps produce the
// expected missing_gps deviations for both supported file formats (CSV and XLSX), without
// needing a local Supabase instance.
// Zero dependencies beyond the project's own source modules. Node (>= 22.6, type-stripping)
// can import the referenced .ts files directly since their only cross-module import
// (`import type { Json } from "@/types"`) is a type-only import erased at strip time —
// no ts-node/tsx/loader needed, and no path-alias resolution is required at runtime.
// Run: node scripts/verify-report-detection.mjs

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseReportFile } from "../src/lib/services/report-parser.ts";
import { detectMissingGps } from "../src/lib/services/deviation-rules.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXPECTED_MISSING_GPS_NAMES = ["Anna Nowak", "Katarzyna Zielińska"];

function readAsArrayBuffer(filePath) {
  const buffer = readFileSync(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

let failed = 0;
function record(ok, name) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
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

  const deviatingNames = result.rows
    .filter((visit) => detectMissingGps(visit) === "missing_gps")
    .map((visit) => visit.representative_name);

  record(deviatingNames.length === EXPECTED_MISSING_GPS_NAMES.length, `${filename}: exactly 2 missing_gps deviations`);

  const namesMatch = EXPECTED_MISSING_GPS_NAMES.every((name) => deviatingNames.includes(name));
  record(namesMatch, `${filename}: missing_gps deviations are for ${EXPECTED_MISSING_GPS_NAMES.join(", ")}`);

  const gpsEnabledNames = result.rows
    .filter((visit) => detectMissingGps(visit) === null)
    .map((visit) => visit.representative_name);
  record(
    gpsEnabledNames.length === result.rows.length - EXPECTED_MISSING_GPS_NAMES.length,
    `${filename}: remaining visits have no deviation (GPS enabled)`,
  );
}

verifyFixture("sample-report.csv");
verifyFixture("sample-report.xlsx");

console.log(failed ? `\n${failed} assertion(s) failed` : "\nAll report detection checks passed");
process.exit(failed ? 1 : 0);

// One-off backfill: deviations.detail for the phone_instead_of_visit heuristic path leaked the
// raw column name "typ_aktywnosci" into user-facing text (see deviation-rules.ts, fixed in
// commit e4ef16d). This updates already-stored rows to the corrected wording. New uploads are
// unaffected — they already get the fixed text from deviation-rules.ts directly.
//
// Idempotent: matches only the exact old substring, so re-running after rows are fixed finds
// zero matches and does nothing.
//
// Updates go through the normal Supabase client + RLS (same as the app's own
// /api/deviations/review endpoint) — this script signs in as a real account and can only touch
// that account's own deviations, never anyone else's.
//
// Usage:
//   node --env-file=.dev.vars scripts/backfill-phone-detail-text.mjs                  (dry run)
//   node --env-file=.dev.vars scripts/backfill-phone-detail-text.mjs --apply          (writes)
// Reads BACKFILL_EMAIL / BACKFILL_PASSWORD from the environment — do not hardcode credentials
// here or add them to a tracked file. Export them in your shell before running, e.g.:
//   BACKFILL_EMAIL=you@example.com BACKFILL_PASSWORD=... node --env-file=.dev.vars scripts/backfill-phone-detail-text.mjs

import { createClient } from "@supabase/supabase-js";

const OLD_SUBSTRING = "(pole typ_aktywnosci puste lub nierozpoznane)";
const NEW_SUBSTRING = "(typ aktywności: brak danych lub nierozpoznany)";

const apply = process.argv.includes("--apply");

const { SUPABASE_URL, SUPABASE_KEY, BACKFILL_EMAIL, BACKFILL_PASSWORD } = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "FAIL  SUPABASE_URL/SUPABASE_KEY not set — run with e.g. `node --env-file=.dev.vars scripts/backfill-phone-detail-text.mjs`",
  );
  process.exit(1);
}
if (!BACKFILL_EMAIL || !BACKFILL_PASSWORD) {
  console.error("FAIL  set BACKFILL_EMAIL/BACKFILL_PASSWORD to the account that owns the reports to fix");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: signInError } = await supabase.auth.signInWithPassword({
  email: BACKFILL_EMAIL,
  password: BACKFILL_PASSWORD,
});
if (signInError) {
  console.error(`FAIL  sign-in failed: ${signInError.message}`);
  process.exit(1);
}

const { data: rows, error: selectError } = await supabase
  .from("deviations")
  .select("id, detail")
  .like("detail", `%${OLD_SUBSTRING}%`);

if (selectError) {
  console.error(`FAIL  select failed: ${selectError.message}`);
  process.exit(1);
}

console.log(`Found ${rows.length} row(s) with the old wording.\n`);

for (const row of rows) {
  const nextDetail = row.detail.replace(OLD_SUBSTRING, NEW_SUBSTRING);
  console.log(`${apply ? "UPDATING" : "WOULD UPDATE"} ${row.id}`);
  console.log(`  old: ${row.detail}`);
  console.log(`  new: ${nextDetail}\n`);

  if (apply) {
    const { error: updateError } = await supabase.from("deviations").update({ detail: nextDetail }).eq("id", row.id);
    if (updateError) {
      console.error(`  FAIL  update failed: ${updateError.message}`);
    }
  }
}

if (!apply) {
  console.log("Dry run only — re-run with --apply to write changes.");
}

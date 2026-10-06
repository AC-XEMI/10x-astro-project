-- Migration: add report deviation count
-- Purpose: let the reports list show how many deviations each report has
-- without joining visits -> deviations on every list render.
-- Scope: one nullable column + backfill. Written by the upload endpoint once
-- deviations are inserted; null means "not computed" (shown as "—" in the UI).
-- Counts deviation rows (one visit can break several rules), regardless of
-- review status — reviewing a deviation does not change this number.
-- No RLS change needed: the existing reports_update_own policy covers it.

alter table reports add column deviation_count integer;

update reports r
set deviation_count = (
  select count(*)
  from deviations d
  join visits v on v.id = d.visit_id
  where v.report_id = r.id
);

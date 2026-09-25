-- Migration: report schema RLS policies
-- Purpose: enforce per-user data isolation on reports, visits, and deviations
-- via granular per-operation (SELECT/INSERT/UPDATE/DELETE) policies, per the
-- CLAUDE.md convention and the PRD data-isolation guardrail.
-- Scope: ENABLE ROW LEVEL SECURITY + policies only. No schema changes.

-- reports ------------------------------------------------------------------
-- Ownership is direct: reports.user_id is the source of truth.

alter table reports enable row level security;

create policy "reports_select_own" on reports
  for select using (
    auth.uid() = user_id
  );

create policy "reports_insert_own" on reports
  for insert with check (
    auth.uid() = user_id
  );

create policy "reports_update_own" on reports
  for update using (
    auth.uid() = user_id
  ) with check (
    auth.uid() = user_id
  );

create policy "reports_delete_own" on reports
  for delete using (
    auth.uid() = user_id
  );

-- visits ---------------------------------------------------------------
-- No own user_id column; ownership resolved via one-level EXISTS to reports.

alter table visits enable row level security;

create policy "visits_select_own" on visits
  for select using (
    exists (
      select 1 from reports
      where reports.id = visits.report_id
        and reports.user_id = auth.uid()
    )
  );

create policy "visits_insert_own" on visits
  for insert with check (
    exists (
      select 1 from reports
      where reports.id = visits.report_id
        and reports.user_id = auth.uid()
    )
  );

create policy "visits_update_own" on visits
  for update using (
    exists (
      select 1 from reports
      where reports.id = visits.report_id
        and reports.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from reports
      where reports.id = visits.report_id
        and reports.user_id = auth.uid()
    )
  );

create policy "visits_delete_own" on visits
  for delete using (
    exists (
      select 1 from reports
      where reports.id = visits.report_id
        and reports.user_id = auth.uid()
    )
  );

-- deviations -------------------------------------------------------------
-- No own user_id column; ownership resolved via two-level EXISTS through
-- visits to reports.

alter table deviations enable row level security;

create policy "deviations_select_own" on deviations
  for select using (
    exists (
      select 1 from visits
      join reports on reports.id = visits.report_id
      where visits.id = deviations.visit_id
        and reports.user_id = auth.uid()
    )
  );

create policy "deviations_insert_own" on deviations
  for insert with check (
    exists (
      select 1 from visits
      join reports on reports.id = visits.report_id
      where visits.id = deviations.visit_id
        and reports.user_id = auth.uid()
    )
  );

create policy "deviations_update_own" on deviations
  for update using (
    exists (
      select 1 from visits
      join reports on reports.id = visits.report_id
      where visits.id = deviations.visit_id
        and reports.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from visits
      join reports on reports.id = visits.report_id
      where visits.id = deviations.visit_id
        and reports.user_id = auth.uid()
    )
  );

create policy "deviations_delete_own" on deviations
  for delete using (
    exists (
      select 1 from visits
      join reports on reports.id = visits.report_id
      where visits.id = deviations.visit_id
        and reports.user_id = auth.uid()
    )
  );

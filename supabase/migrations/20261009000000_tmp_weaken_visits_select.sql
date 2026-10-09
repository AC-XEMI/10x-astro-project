-- TEMPORARY sensitivity check (testing-data-isolation-access 2.6): never merge.
drop policy "visits_select_own" on visits;
create policy "visits_select_own" on visits for select using (true);

-- MANUAL ONLY: this file lives outside supabase/migrations/ specifically so `supabase migration up`/`db reset` never picks it up automatically.
-- Run by hand against the local DB via psql inside the Supabase Docker container (the Supabase CLI's own
-- `db query -f` rejects multi-statement files — "cannot insert multiple commands into a prepared statement"):
--   docker exec -i supabase_db_<project> psql -U postgres -d postgres < <this file>
-- (find <project> via `docker ps` — container name is `supabase_db_<project-id>`).
-- Rollback for: 20260929120000_add_route_deviation_columns.sql
-- Purpose: drop the columns added by the "up" migration, in reverse order.

alter table deviations drop column if exists detail;
alter table visits drop column if exists visited_longitude;
alter table visits drop column if exists visited_latitude;
alter table visits drop column if exists visited_client;

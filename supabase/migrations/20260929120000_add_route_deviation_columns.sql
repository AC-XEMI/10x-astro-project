-- Migration: add route deviation columns
-- Purpose: store the visited client, its coordinates, and a free-text
-- deviation reason so the route-deviation rule has somewhere to write.
-- Scope: additive column changes only. All columns are nullable — this is
-- test data with no production traffic, so no default/backfill is needed.

alter table visits add column visited_client text;
alter table visits add column visited_latitude numeric;
alter table visits add column visited_longitude numeric;
alter table deviations add column detail text;

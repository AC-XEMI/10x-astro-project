-- Migration: create report schema
-- Purpose: store extracted report data (reports, visits, deviations) so that
-- F-01 and the downstream S-01..S-05 slices have a place to write/read data.
-- Scope: enums, tables, and supporting indexes only.
-- RLS policies are intentionally NOT part of this migration — they are added
-- in a separate Phase 2 migration.

-- Enums ----------------------------------------------------------------

create type deviation_rule as enum (
  'missing_gps',
  'route_deviation',
  'phone_instead_of_visit'
);

create type deviation_review_status as enum (
  'unreviewed',
  'reviewed'
);

-- Tables -----------------------------------------------------------------

create table reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  original_filename text not null,
  uploaded_at timestamptz not null default now(),
  row_count integer,
  created_at timestamptz not null default now()
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports (id) on delete cascade,
  representative_name text not null,
  visit_date timestamptz not null,
  gps_enabled boolean not null,
  activity_type text,
  time_on_site_minutes numeric,
  distance_km numeric,
  planned_route_raw jsonb,
  raw_data jsonb,
  created_at timestamptz not null default now()
);

create table deviations (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits (id) on delete cascade,
  rule deviation_rule not null,
  status deviation_review_status not null default 'unreviewed',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes ------------------------------------------------------------------
-- Support the most frequent queries: a user's list of reports, a report's
-- visits, and a visit's deviations.

create index reports_user_id_idx on reports (user_id);
create index visits_report_id_idx on visits (report_id);
create index deviations_visit_id_idx on deviations (visit_id);

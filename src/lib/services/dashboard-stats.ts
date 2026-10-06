import type { Tables } from "@/types";

/**
 * Manager dashboard aggregation. Visits are bucketed by the calendar month of `visit_date`
 * in Polish local time (not by report upload time - a September report is usually uploaded
 * in early October). The reference month is the latest month that has any visit, so the
 * dashboard keeps showing the last reported month instead of an empty current month.
 */

export type DashboardVisit = Pick<Tables<"visits">, "representative_name" | "visit_date"> & {
  deviations: Pick<Tables<"deviations">, "rule" | "status">[];
};

export const PERIODS = { "1m": 1, "3m": 3, "6m": 6 } as const;
export type PeriodKey = keyof typeof PERIODS;

export const TREND_MONTHS = 6;

const TIME_ZONE = "Europe/Warsaw";

const MONTHS = [
  ["styczeń", "styczniem", "Sty"],
  ["luty", "lutym", "Lut"],
  ["marzec", "marcem", "Mar"],
  ["kwiecień", "kwietniem", "Kwi"],
  ["maj", "majem", "Maj"],
  ["czerwiec", "czerwcem", "Cze"],
  ["lipiec", "lipcem", "Lip"],
  ["sierpień", "sierpniem", "Sie"],
  ["wrzesień", "wrześniem", "Wrz"],
  ["październik", "październikiem", "Paź"],
  ["listopad", "listopadem", "Lis"],
  ["grudzień", "grudniem", "Gru"],
] as const;

/** Month index counted from year 0 (year * 12 + month0) - makes month arithmetic trivial. */
type MonthIndex = number;

const monthFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" });

export function toMonthIndex(value: string | Date): MonthIndex {
  const parts = monthFormatter.formatToParts(typeof value === "string" ? new Date(value) : value);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return year * 12 + (month - 1);
}

const yearOf = (m: MonthIndex) => Math.floor(m / 12);
const monthOf = (m: MonthIndex) => m % 12;

export function monthName(m: MonthIndex) {
  return `${MONTHS[monthOf(m)][0]} ${yearOf(m)}`;
}

/** Instrumental case, for "porównanie z sierpniem 2026". */
export function monthNameInstrumental(m: MonthIndex) {
  return `${MONTHS[monthOf(m)][1]} ${yearOf(m)}`;
}

export function monthShort(m: MonthIndex) {
  return MONTHS[monthOf(m)][2];
}

/** First instant (UTC ISO) safely before the given month starts in Polish time - a query lower bound. */
export function monthLowerBound(m: MonthIndex) {
  return new Date(Date.UTC(yearOf(m), monthOf(m), 1) - 24 * 60 * 60 * 1000).toISOString();
}

/** Signed change with a real minus sign: +4, −3, 0. */
export function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${-delta}`;
  return "0";
}

export interface RuleCounts {
  missing_gps: number;
  phone_instead_of_visit: number;
  route_deviation: number;
}

export interface WindowTotals extends RuleCounts {
  visits: number;
  /** Deviation rows - one visit can break several rules. */
  deviations: number;
  flaggedVisits: number;
  unreviewed: number;
}

export interface RankingRow extends WindowTotals {
  name: string;
  /** Deviations in the current window minus deviations in the previous window. */
  delta: number;
}

export interface TrendMonth extends RuleCounts {
  month: MonthIndex;
  label: string;
  hasVisits: boolean;
  total: number;
}

export interface DashboardStats {
  refMonth: MonthIndex;
  current: WindowTotals;
  previous: WindowTotals;
  ranking: RankingRow[];
  trend: TrendMonth[];
}

function emptyTotals(): WindowTotals {
  return {
    visits: 0,
    deviations: 0,
    flaggedVisits: 0,
    unreviewed: 0,
    missing_gps: 0,
    phone_instead_of_visit: 0,
    route_deviation: 0,
  };
}

function addVisit(totals: WindowTotals, visit: DashboardVisit) {
  totals.visits += 1;
  totals.deviations += visit.deviations.length;
  if (visit.deviations.length > 0) totals.flaggedVisits += 1;
  for (const deviation of visit.deviations) {
    totals[deviation.rule] += 1;
    if (deviation.status === "unreviewed") totals.unreviewed += 1;
  }
}

/**
 * Current window = the `periodMonths` months ending at `refMonth`; previous window = the same
 * number of months right before it. Trend always covers the last TREND_MONTHS months.
 */
export function computeDashboardStats(
  visits: DashboardVisit[],
  refMonth: MonthIndex,
  periodMonths: number,
): DashboardStats {
  const currentStart = refMonth - periodMonths + 1;
  const previousStart = currentStart - periodMonths;
  const trendStart = refMonth - TREND_MONTHS + 1;

  const current = emptyTotals();
  const previous = emptyTotals();
  const byRep = new Map<string, { current: WindowTotals; previous: WindowTotals }>();
  const trend = new Map<MonthIndex, WindowTotals>();

  for (const visit of visits) {
    const m = toMonthIndex(visit.visit_date);
    if (m > refMonth) continue;

    if (m >= trendStart) {
      const bucket = trend.get(m) ?? emptyTotals();
      addVisit(bucket, visit);
      trend.set(m, bucket);
    }

    const window = m >= currentStart ? "current" : m >= previousStart ? "previous" : null;
    if (!window) continue;

    addVisit(window === "current" ? current : previous, visit);
    const rep = byRep.get(visit.representative_name) ?? { current: emptyTotals(), previous: emptyTotals() };
    addVisit(rep[window], visit);
    byRep.set(visit.representative_name, rep);
  }

  const ranking: RankingRow[] = [...byRep.entries()]
    // Representatives seen only in the previous window are not part of the current ranking.
    .filter(([, rep]) => rep.current.visits > 0)
    .map(([name, rep]) => ({ name, ...rep.current, delta: rep.current.deviations - rep.previous.deviations }))
    .sort((a, b) => b.deviations - a.deviations || b.visits - a.visits || a.name.localeCompare(b.name, "pl"));

  const trendMonths: TrendMonth[] = [];
  for (let m = trendStart; m <= refMonth; m++) {
    const bucket = trend.get(m) ?? emptyTotals();
    trendMonths.push({
      month: m,
      label: monthShort(m),
      hasVisits: bucket.visits > 0,
      total: bucket.deviations,
      missing_gps: bucket.missing_gps,
      phone_instead_of_visit: bucket.phone_instead_of_visit,
      route_deviation: bucket.route_deviation,
    });
  }

  return { refMonth, current, previous, ranking, trend: trendMonths };
}

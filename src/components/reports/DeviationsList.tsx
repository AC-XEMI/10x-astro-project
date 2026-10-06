import { Fragment, useState, type ComponentType } from "react";
import { Check, CheckCheck, ChevronDown, CircleAlert, Download, MapPin, Phone, Undo2, X } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Constants, type Tables } from "@/types";
import type { DeviationRule } from "@/lib/services/deviation-rules";
// "xlsx" resolves to the @e965/xlsx npm mirror (see package.json) - same package already used
// server-side in report-parser.ts for parsing uploads.
import * as XLSX from "xlsx";

export type VisitWithDeviations = Tables<"visits"> & { deviations: Tables<"deviations">[] };

interface Props {
  visits: VisitWithDeviations[];
  reportId: string;
}

type DeviationStatus = Tables<"deviations">["status"];
type StatusFilter = "all" | "todo" | "done";

interface FilterState {
  representative: string;
  rule: DeviationRule | "";
  status: StatusFilter;
  sortDesc: boolean;
}

const INITIAL_FILTERS: FilterState = { representative: "", rule: "", status: "all", sortDesc: true };

const ALL_RULES = Constants.public.Enums.deviation_rule;

const RULE_LABELS: Record<DeviationRule, string> = {
  missing_gps: "Brak GPS",
  phone_instead_of_visit: "Telefon zamiast wizyty",
  route_deviation: "Odchylenie od trasy",
};

const RULE_ICONS: Record<DeviationRule, ComponentType<{ className?: string }>> = {
  missing_gps: MapPin,
  phone_instead_of_visit: Phone,
  route_deviation: CircleAlert,
};

/** Summary-card hint under each rule's count. */
const RULE_HINTS: Record<DeviationRule, string> = {
  missing_gps: "wizyt bez lokalizacji",
  phone_instead_of_visit: "kontaktów telefonicznych",
  route_deviation: "trasa > 1,5× linii prostej",
};

/** Why the rule matters - static per rule, shown under the stored detail in the expanded row. */
const RULE_EXPLANATIONS: Record<DeviationRule, string> = {
  missing_gps: "Bez lokalizacji GPS nie da się potwierdzić, że przedstawiciel faktycznie był u klienta.",
  phone_instead_of_visit: "Zaraportowany kontakt nie potwierdza osobistej wizyty u klienta.",
  route_deviation:
    "Wizyta poza zaplanowaną trasą lub przejechany dystans przekracza dopuszczalne 1,5× odległości w linii prostej.",
};

/** detectMissingGps stores no detail string, so the UI needs a fallback for it. */
const RULE_DEFAULT_DETAILS: Record<DeviationRule, string> = {
  missing_gps: "GPS wyłączony podczas wizyty",
  phone_instead_of_visit: "Kontakt telefoniczny",
  route_deviation: "Odchylenie od zaplanowanej trasy",
};

const STATUS_LABELS: Record<DeviationStatus, string> = {
  unreviewed: "Nieprzejrzane",
  reviewed: "Sprawdzone",
};

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "todo", label: "Nieprzejrzane" },
  { value: "done", label: "Sprawdzone" },
];

const SELECT_CLASS = "border-input bg-card h-9 rounded-md border px-3 text-sm shadow-xs";

/** `visit_date` comes back as a full ISO timestamp (e.g. "2026-09-02T00:00:00+00:00"); UI and export only care about the date part. */
function toDateOnly(isoDate: string) {
  return isoDate.slice(0, 10);
}

/** "2026-09-02..." -> "02.09.2026" */
function formatVisitDate(isoDate: string) {
  const [year, month, day] = toDateOnly(isoDate).split("-");
  return `${day}.${month}.${year}`;
}

/** Formats as dd.mm.yyyy, HH:MM, independent of browser locale. */
function formatTimestamp(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Polish plural for "wizyta" (1 wizyta, 2-4 wizyty, 5+ wizyt, 12-14 wizyt). */
function visitsWord(n: number) {
  if (n === 1) return "wizyta";
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? "wizyty" : "wizyt";
}

function percent(part: number, total: number) {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

/** `activity_type` is free text straight from the uploaded file's "Typ aktywności" column - only "wizyta"/"telefon" are recognized values. */
function formatActivityType(value: string | null) {
  if (!value?.trim()) return "Brak danych";
  const normalized = value.trim().toLowerCase();
  if (normalized === "wizyta") return "Wizyta";
  if (normalized === "telefon") return "Telefon";
  return `Nierozpoznany (${value})`;
}

/** planned_route_raw is stored by report-parser.ts as a string[] of route stops. */
function formatPlannedRoute(value: VisitWithDeviations["planned_route_raw"]) {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value.join(" → ");
  return value ? JSON.stringify(value) : "—";
}

function isReviewed(deviation: Tables<"deviations">) {
  return deviation.status === "reviewed";
}

function isVisitReviewed(visit: VisitWithDeviations) {
  return visit.deviations.every(isReviewed);
}

/**
 * Guards against CSV formula injection: source data (e.g. representative_name) is free text
 * from the uploaded file, not system-generated. A leading =/+/-/@/tab/CR is how spreadsheet
 * apps detect a formula in a CSV cell (no type info in the format itself, unlike XLSX), so
 * such values get a leading apostrophe to force plain-text interpretation on open.
 */
function csvField(value: string) {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

const EXPORT_HEADERS = [
  "Przedstawiciel",
  "Data wizyty",
  "Reguła",
  "Status",
  "Szczegół",
  "GPS włączony",
  "Typ aktywności",
  "Dystans (km)",
  "Czas na miejscu (min)",
];

/** One row per deviation. Shared by both the CSV and XLSX export formats. */
function buildExportRows(visits: VisitWithDeviations[]): string[][] {
  const rows: string[][] = [EXPORT_HEADERS];

  for (const visit of visits) {
    for (const deviation of visit.deviations) {
      rows.push([
        visit.representative_name,
        toDateOnly(visit.visit_date),
        RULE_LABELS[deviation.rule],
        STATUS_LABELS[deviation.status],
        deviation.detail ?? "-",
        visit.gps_enabled ? "TAK" : "NIE",
        formatActivityType(visit.activity_type),
        visit.distance_km !== null ? String(visit.distance_km) : "-",
        visit.time_on_site_minutes !== null ? String(visit.time_on_site_minutes) : "-",
      ]);
    }
  }

  return rows;
}

function buildCsv(rows: string[][]): string {
  const csvBody = rows.map((row) => row.map(csvField).join(";")).join("\n");
  const byteOrderMark = String.fromCharCode(0xfeff);
  return byteOrderMark + csvBody;
}

function buildXlsx(rows: string[][]): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Odstępstwa");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/**
 * Pure filter+sort step over flagged visits. The rule filter narrows which deviations of a
 * visit are "relevant"; the status filter is then evaluated over those same deviations -
 * "todo" = at least one relevant deviation unreviewed, "done" = all relevant deviations
 * reviewed. Without a rule filter this is the visit-level status (fully reviewed or not).
 */
function getVisibleVisits(visits: VisitWithDeviations[], filters: FilterState) {
  const filtered = visits.filter((visit) => {
    if (filters.representative && visit.representative_name !== filters.representative) return false;
    const relevant = filters.rule ? visit.deviations.filter((d) => d.rule === filters.rule) : visit.deviations;
    if (relevant.length === 0) return false;
    if (filters.status === "todo") return relevant.some((d) => !isReviewed(d));
    if (filters.status === "done") return relevant.every(isReviewed);
    return true;
  });

  return filtered.sort((a, b) =>
    filters.sortDesc ? b.visit_date.localeCompare(a.visit_date) : a.visit_date.localeCompare(b.visit_date),
  );
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("bg-muted h-1.5 overflow-hidden rounded-full", className)}>
      <div className="bg-primary h-full rounded-full transition-[width]" style={{ width: `${value}%` }} />
    </div>
  );
}

function StatusPill({ reviewed }: { reviewed: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        reviewed ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
      )}
    >
      {reviewed ? "Sprawdzone" : "Do sprawdzenia"}
    </span>
  );
}

export default function DeviationsList({ visits: initialVisits, reportId }: Props) {
  const [visits, setVisits] = useState<VisitWithDeviations[]>(initialVisits);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  // Only the representative with the most flagged visits starts expanded; computed once so the
  // expansion doesn't jump around when the date sort reorders groups.
  const [expandedReps, setExpandedReps] = useState<Set<string>>(() => {
    const counts = new Map<string, number>();
    for (const visit of initialVisits) {
      if (visit.deviations.length === 0) continue;
      counts.set(visit.representative_name, (counts.get(visit.representative_name) ?? 0) + 1);
    }
    const largest = [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl"))
      .slice(0, 1)
      .map(([name]) => name);
    return new Set(largest);
  });
  const [openVisitIds, setOpenVisitIds] = useState<Set<string>>(new Set());

  const flaggedVisits = visits.filter((visit) => visit.deviations.length > 0);
  const reviewedVisitCount = flaggedVisits.filter(isVisitReviewed).length;
  const representatives = [...new Set(flaggedVisits.map((v) => v.representative_name))].sort((a, b) =>
    a.localeCompare(b, "pl"),
  );
  const visibleVisits = getVisibleVisits(flaggedVisits, filters);

  // Groups follow the date sort: each group sits at the position of its first visible visit
  // (visits are already sorted), so "od najnowszych" puts the rep with the newest visit first.
  // Ties fall back to the larger group.
  const groups = representatives
    .map((name) => {
      const all = flaggedVisits.filter((v) => v.representative_name === name);
      return {
        name,
        all,
        visible: visibleVisits.filter((v) => v.representative_name === name),
        reviewed: all.filter(isVisitReviewed).length,
      };
    })
    .filter((group) => group.visible.length > 0)
    .sort(
      (a, b) =>
        (filters.sortDesc
          ? b.visible[0].visit_date.localeCompare(a.visible[0].visit_date)
          : a.visible[0].visit_date.localeCompare(b.visible[0].visit_date)) ||
        b.all.length - a.all.length ||
        a.name.localeCompare(b.name, "pl"),
    );

  const hasActiveFilters = filters.representative !== "" || filters.rule !== "" || filters.status !== "all";

  /** Resets every filter but keeps the chosen sort direction - sorting doesn't hide anything. */
  function clearFilters() {
    setFilters((prev) => ({ ...INITIAL_FILTERS, sortDesc: prev.sortDesc }));
  }

  function toggleRep(name: string) {
    setExpandedReps((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function toggleVisit(id: string) {
    setOpenVisitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function updateDeviationStatus(ids: string[], status: DeviationStatus) {
    if (ids.length === 0) return;
    setPendingIds((prev) => new Set([...prev, ...ids]));

    try {
      const response = await fetch("/api/deviations/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });

      const isJson = response.headers.get("content-type")?.includes("application/json");
      if (!response.ok || !isJson) {
        console.error(`Nie udało się zaktualizować statusu odstępstw (HTTP ${response.status})`);
        return;
      }

      const { updated } = (await response.json()) as { updated: Tables<"deviations">[] };

      setVisits((prevVisits) =>
        prevVisits.map((visit) => ({
          ...visit,
          deviations: visit.deviations.map((deviation) => {
            const match = updated.find((u) => u.id === deviation.id);
            return match ? { ...deviation, status: match.status, reviewed_at: match.reviewed_at } : deviation;
          }),
        })),
      );
    } catch (error) {
      console.error("Błąd podczas aktualizacji statusu odstępstw:", error);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function exportList(format: "csv" | "xlsx") {
    try {
      const rows = buildExportRows(visibleVisits);
      if (format === "csv") {
        const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8;" });
        downloadBlob(blob, `odstepstwa-raport-${reportId}.csv`);
      } else {
        const blob = new Blob([buildXlsx(rows)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        downloadBlob(blob, `odstepstwa-raport-${reportId}.xlsx`);
      }
    } catch (error) {
      console.error("Błąd podczas eksportu listy odstępstw:", error);
    }
  }

  const ruleCount = (rule: DeviationRule, from: VisitWithDeviations[]) =>
    from.filter((v) => v.deviations.some((d) => d.rule === rule)).length;

  function renderVisitRows(groupVisits: VisitWithDeviations[]) {
    return groupVisits.map((visit) => {
      const isOpen = openVisitIds.has(visit.id);
      const total = visit.deviations.length;
      const doneCount = visit.deviations.filter(isReviewed).length;
      const allReviewed = doneCount === total;
      const isMulti = total > 1;
      const isPending = visit.deviations.some((d) => pendingIds.has(d.id));
      const allIds = visit.deviations.map((d) => d.id);

      return (
        <Fragment key={visit.id}>
          <TableRow
            onClick={() => {
              toggleVisit(visit.id);
            }}
            aria-expanded={isOpen}
            data-state={isOpen ? "selected" : undefined}
            className="cursor-pointer"
          >
            <TableCell className="w-7 py-3 align-top">
              <ChevronDown
                className={cn("text-muted-foreground size-4 transition-transform", !isOpen && "-rotate-90")}
              />
            </TableCell>
            <TableCell className="py-3 align-top font-medium tabular-nums">
              {formatVisitDate(visit.visit_date)}
            </TableCell>
            <TableCell className="text-muted-foreground py-3 align-top whitespace-normal">
              {visit.visited_client ?? "—"}
            </TableCell>
            <TableCell className="py-3 whitespace-normal">
              <div className="space-y-1">
                {visit.deviations.map((deviation) => {
                  const done = isReviewed(deviation);
                  const Icon = done ? CheckCheck : RULE_ICONS[deviation.rule];
                  return (
                    <div key={deviation.id} className="flex flex-wrap items-start gap-x-2">
                      <span
                        className={cn(
                          "flex w-[200px] shrink-0 items-center gap-2 font-medium",
                          done ? "text-muted-foreground" : "text-destructive",
                        )}
                      >
                        <Icon className="size-4" />
                        {RULE_LABELS[deviation.rule]}
                      </span>
                      <span className="text-muted-foreground min-w-0 break-words">
                        {deviation.detail ?? RULE_DEFAULT_DETAILS[deviation.rule]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </TableCell>
            <TableCell className="py-2 text-right align-top">
              {allReviewed ? (
                <span className="text-primary inline-flex h-8 items-center gap-1 text-sm font-medium">
                  <CheckCheck className="size-4" />
                  Sprawdzone
                </span>
              ) : (
                <div className="flex items-center justify-end gap-3">
                  {isMulti && (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {doneCount} z {total}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      void updateDeviationStatus(allIds, "reviewed");
                    }}
                  >
                    {isMulti ? <CheckCheck /> : <Check />}
                    {isMulti ? "Oznacz wszystkie" : "Oznacz jako sprawdzone"}
                  </Button>
                </div>
              )}
            </TableCell>
          </TableRow>
          {isOpen && (
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableCell colSpan={5} className="p-0 whitespace-normal">
                <div className="grid gap-6 px-4 pt-4 pb-5 md:grid-cols-[300px_minmax(0,1fr)] md:pl-11">
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Kontekst wizyty</div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm [&_dd]:break-words">
                      <dt className="font-medium">Klient</dt>
                      <dd>{visit.visited_client ?? "—"}</dd>
                      <dt className="font-medium">Typ aktywności</dt>
                      <dd className="text-muted-foreground">{formatActivityType(visit.activity_type)}</dd>
                      <dt className="font-medium">Dystans</dt>
                      <dd className="text-muted-foreground">
                        {visit.distance_km !== null ? `${visit.distance_km} km` : "—"}
                      </dd>
                      <dt className="font-medium">Czas na miejscu</dt>
                      <dd className="text-muted-foreground">
                        {visit.time_on_site_minutes !== null ? `${visit.time_on_site_minutes} min` : "—"}
                      </dd>
                      <dt className="font-medium">GPS</dt>
                      <dd className={visit.gps_enabled ? "text-muted-foreground" : "text-destructive font-medium"}>
                        {visit.gps_enabled ? "Tak" : "Nie"}
                      </dd>
                      <dt className="font-medium">Współrzędne</dt>
                      <dd className="text-muted-foreground tabular-nums">
                        {visit.visited_latitude !== null && visit.visited_longitude !== null
                          ? `${visit.visited_latitude}, ${visit.visited_longitude}`
                          : "—"}
                      </dd>
                      <dt className="font-medium">Planowana trasa</dt>
                      <dd className="text-muted-foreground">{formatPlannedRoute(visit.planned_route_raw)}</dd>
                    </dl>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="text-sm font-semibold">
                        Złamane reguły ({total})
                        <span className="text-muted-foreground ml-2 font-normal">
                          {doneCount} z {total} sprawdzone
                        </span>
                      </div>
                      {allReviewed ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="cursor-pointer"
                          disabled={isPending}
                          onClick={() => {
                            void updateDeviationStatus(allIds, "unreviewed");
                          }}
                        >
                          <Undo2 />
                          Cofnij wszystkie
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          disabled={isPending}
                          onClick={() => {
                            void updateDeviationStatus(allIds, "reviewed");
                          }}
                        >
                          <CheckCheck />
                          Oznacz wszystkie dla tej wizyty
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {visit.deviations.map((deviation) => {
                        const done = isReviewed(deviation);
                        const Icon = RULE_ICONS[deviation.rule];
                        return (
                          <div
                            key={deviation.id}
                            className={cn(
                              "flex flex-wrap items-start justify-between gap-4 rounded-lg border p-3",
                              done ? "bg-muted/50" : "bg-card border-destructive shadow-xs",
                            )}
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "flex items-center gap-2 text-sm font-semibold",
                                    done ? "text-muted-foreground" : "text-destructive",
                                  )}
                                >
                                  <Icon className="size-4" />
                                  {RULE_LABELS[deviation.rule]}
                                </span>
                                <StatusPill reviewed={done} />
                              </div>
                              <div
                                className={cn(
                                  "text-sm font-medium break-words",
                                  done ? "text-muted-foreground" : "text-foreground",
                                )}
                              >
                                {deviation.detail ?? RULE_DEFAULT_DETAILS[deviation.rule]}
                              </div>
                              <div className="text-muted-foreground text-sm">{RULE_EXPLANATIONS[deviation.rule]}</div>
                              {done && deviation.reviewed_at && (
                                <div className="text-muted-foreground pt-1 text-xs">
                                  Sprawdzono: {formatTimestamp(deviation.reviewed_at)}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant={done ? "ghost" : "outline"}
                              className="cursor-pointer"
                              disabled={pendingIds.has(deviation.id)}
                              onClick={() => {
                                void updateDeviationStatus([deviation.id], done ? "unreviewed" : "reviewed");
                              }}
                            >
                              {done ? <Undo2 /> : <Check />}
                              {done ? "Cofnij" : "Oznacz jako sprawdzone"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          )}
        </Fragment>
      );
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1.2fr_repeat(3,1fr)_1.3fr]">
        <div className="bg-card space-y-1 rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">Wizyty</div>
          <div className="text-2xl font-semibold tabular-nums">{visits.length}</div>
          <div className="text-muted-foreground text-xs">
            <span className="text-destructive font-medium tabular-nums">{flaggedVisits.length}</span> z odstępstwami (
            {percent(flaggedVisits.length, visits.length)}%)
          </div>
        </div>
        {ALL_RULES.map((rule) => {
          const Icon = RULE_ICONS[rule];
          const count = ruleCount(rule, flaggedVisits);
          return (
            <div key={rule} className="bg-card space-y-1 rounded-lg border p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Icon className="size-4 shrink-0" />
                <span>{RULE_LABELS[rule]}</span>
              </div>
              <div
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  count > 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {count}
              </div>
              <div className="text-muted-foreground text-xs">{RULE_HINTS[rule]}</div>
            </div>
          );
        })}
        <div className="bg-card space-y-2 rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">Przejrzane</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-semibold tabular-nums">{reviewedVisitCount}</span>
            <span className="text-muted-foreground text-sm tabular-nums">/ {flaggedVisits.length}</span>
          </div>
          <ProgressBar value={percent(reviewedVisitCount, flaggedVisits.length)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Przedstawiciel"
            className={SELECT_CLASS}
            value={filters.representative}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, representative: e.target.value }));
            }}
          >
            <option value="">Wszyscy przedstawiciele</option>
            {representatives.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Rodzaj odstępstwa"
            className={SELECT_CLASS}
            value={filters.rule}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, rule: e.target.value as DeviationRule | "" }));
            }}
          >
            <option value="">Wszystkie odstępstwa</option>
            {ALL_RULES.map((rule) => (
              <option key={rule} value={rule}>
                {RULE_LABELS[rule]}
              </option>
            ))}
          </select>
          <div role="group" aria-label="Status" className="bg-card flex items-center gap-1 rounded-md border p-0.5">
            {STATUS_FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={filters.status === option.value ? "secondary" : "ghost"}
                aria-pressed={filters.status === option.value}
                className="cursor-pointer"
                onClick={() => {
                  setFilters((prev) => ({ ...prev, status: option.value }));
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => {
              setFilters((prev) => ({ ...prev, sortDesc: !prev.sortDesc }));
            }}
          >
            {filters.sortDesc ? "Data: od najnowszych" : "Data: od najstarszych"}
            <ChevronDown className={cn("transition-transform", !filters.sortDesc && "rotate-180")} />
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" className="cursor-pointer" onClick={clearFilters}>
              <X />
              Wyczyść filtry
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="cursor-pointer"
            disabled={visibleVisits.length === 0}
            onClick={() => {
              exportList("csv");
            }}
          >
            <Download />
            CSV
          </Button>
          <Button
            variant="outline"
            className="cursor-pointer"
            disabled={visibleVisits.length === 0}
            onClick={() => {
              exportList("xlsx");
            }}
          >
            <Download />
            XLSX
          </Button>
        </div>
      </div>

      {flaggedVisits.length === 0 ? (
        <div className="bg-card text-muted-foreground rounded-lg border p-10 text-center text-sm">
          {visits.length === 0 ? "Brak wizyt w tym raporcie." : "Brak wykrytych odstępstw w tym raporcie."}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-card text-muted-foreground flex flex-col items-center gap-3 rounded-lg border p-10 text-center text-sm">
          Brak wizyt spełniających wybrane filtry.
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={clearFilters}>
            <X />
            Wyczyść filtry
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expandedReps.has(group.name);
            const multiRuleCount = group.all.filter((v) => v.deviations.length > 1).length;
            const countLabel = [
              `${group.all.length} ${visitsWord(group.all.length)} z odstępstwami`,
              group.visible.length < group.all.length ? `${group.visible.length} po filtrach` : null,
              multiRuleCount > 0 ? `${multiRuleCount} z kilkoma regułami` : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div key={group.name} className="bg-card rounded-lg border">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  className="flex w-full cursor-pointer flex-wrap items-center gap-4 px-4 py-3 text-left"
                  onClick={() => {
                    toggleRep(group.name);
                  }}
                >
                  <ChevronDown
                    className={cn("text-muted-foreground size-4 transition-transform", !isExpanded && "-rotate-90")}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{group.name}</div>
                    <div className="text-muted-foreground text-xs">{countLabel}</div>
                  </div>
                  <div className="text-destructive flex items-center gap-4 text-sm">
                    {ALL_RULES.map((rule) => {
                      const count = ruleCount(rule, group.all);
                      if (count === 0) return null;
                      const Icon = RULE_ICONS[rule];
                      return (
                        <span
                          key={rule}
                          className="flex items-center gap-1 font-medium tabular-nums"
                          title={RULE_LABELS[rule]}
                        >
                          <Icon className="size-4" />
                          {count}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex w-[150px] items-center gap-2">
                    <ProgressBar value={percent(group.reviewed, group.all.length)} className="flex-1" />
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {group.reviewed}/{group.all.length}
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t px-4 pb-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-7" />
                          <TableHead className="w-[110px]">Data wizyty</TableHead>
                          <TableHead className="w-[200px]">Klient</TableHead>
                          <TableHead>Odstępstwa</TableHead>
                          <TableHead className="w-[230px] text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>{renderVisitRows(group.visible)}</TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

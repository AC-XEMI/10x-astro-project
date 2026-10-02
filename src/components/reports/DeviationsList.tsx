import { Fragment, useEffect, useRef, useState } from "react";
import { Check, CheckCheck, ChevronDown, Undo2, X } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
type SortMode = "date_desc" | "representative_asc";

interface FilterState {
  selectedReps: Set<string>;
  dateFrom: string | null;
  dateTo: string | null;
  selectedRules: Set<DeviationRule>;
  selectedStatuses: Set<DeviationStatus>;
}

const EMPTY_FILTERS: FilterState = {
  selectedReps: new Set(),
  dateFrom: null,
  dateTo: null,
  selectedRules: new Set(),
  selectedStatuses: new Set(),
};

const ALL_RULES = Constants.public.Enums.deviation_rule;
const ALL_STATUSES = Constants.public.Enums.deviation_review_status;

const RULE_LABELS: Record<DeviationRule, string> = {
  missing_gps: "Brak GPS",
  route_deviation: "Odchylenie trasy",
  phone_instead_of_visit: "Telefon zamiast wizyty",
};

const STATUS_LABELS: Record<DeviationStatus, string> = {
  unreviewed: "Nieprzejrzane",
  reviewed: "Sprawdzone",
};

interface MultiSelectOption {
  value: string;
  label: string;
}

/**
 * Closed-by-default dropdown with checkbox options - unlike a native `<select multiple>`,
 * each option toggles on a plain click (no Ctrl/Cmd required).
 */
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  function toggleValue(value: string) {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(next);
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 whitespace-nowrap text-slate-700 hover:bg-slate-100"
        onClick={() => {
          setIsOpen((prev) => !prev);
        }}
      >
        {selected.size === 0 ? label : `${label} (${selected.size})`}
        <ChevronDown className="size-3.5" />
      </button>
      {selected.size > 0 && (
        <button
          type="button"
          aria-label={`Wyczyść filtr: ${label}`}
          className="cursor-pointer rounded px-1 text-slate-400 hover:text-slate-700"
          onClick={() => {
            onChange(new Set());
          }}
        >
          <X className="size-3.5" />
        </button>
      )}
      {isOpen && (
        // Opaque background is deliberate here: this panel overlays table rows and needs
        // to stay legible regardless of what's behind it.
        <div className="absolute top-full left-0 z-10 mt-1 min-w-full rounded border border-slate-200 bg-white p-2 text-slate-700 shadow-lg">
          {options.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 py-0.5 whitespace-nowrap">
              <input
                type="checkbox"
                checked={selected.has(option.value)}
                onChange={() => {
                  toggleValue(option.value);
                }}
                className="cursor-pointer"
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Button trigger showing our own label/value text (no native date-format placeholder);
 * the real `<input type="date">` stays invisible and is opened via showPicker() on click.
 */
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
    }
  }

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        className="cursor-pointer rounded border border-slate-200 bg-slate-50 px-2 py-1 whitespace-nowrap text-slate-700 hover:bg-slate-100"
        onClick={openPicker}
      >
        {value ? `${label}: ${value}` : `${label}: wybierz datę`}
      </button>
      {value && (
        <button
          type="button"
          aria-label={`Wyczyść: ${label}`}
          className="cursor-pointer rounded px-1 text-slate-400 hover:text-slate-700"
          onClick={() => {
            onChange(null);
          }}
        >
          <X className="size-3.5" />
        </button>
      )}
      <input
        ref={inputRef}
        type="date"
        value={value ?? ""}
        onChange={(e) => {
          onChange(e.target.value || null);
        }}
        className="absolute top-full left-0 h-0 w-0 opacity-0"
        tabIndex={-1}
      />
    </div>
  );
}

interface ExportMenuOption {
  value: string;
  label: string;
}

/**
 * Closed-by-default action menu - unlike MultiSelectDropdown, clicking an option fires once
 * and closes the menu immediately, rather than toggling a persistent selection.
 */
function ExportMenu({
  label,
  options,
  disabled,
  onSelect,
}: {
  label: string;
  options: ExportMenuOption[];
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      <Button
        variant="outline"
        disabled={disabled}
        className="h-fit cursor-pointer"
        onClick={() => {
          setIsOpen((prev) => !prev);
        }}
      >
        {label}
        <ChevronDown className="size-3.5" />
      </Button>
      {isOpen && (
        // Opaque background is deliberate here, matching MultiSelectDropdown's popup panel.
        <div className="absolute top-full left-0 z-10 mt-1 min-w-full rounded border border-slate-200 bg-white p-1 text-slate-700 shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="block w-full cursor-pointer rounded px-2 py-1 text-left whitespace-nowrap hover:bg-slate-100"
              onClick={() => {
                setIsOpen(false);
                onSelect(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** `visit_date` comes back as a full ISO timestamp (e.g. "2026-09-02T00:00:00+00:00"); UI and date-range filtering only care about the date part. */
function toDateOnly(isoDate: string) {
  return isoDate.slice(0, 10);
}

/** `activity_type` is free text straight from the uploaded file's "Typ aktywności" column - only "wizyta"/"telefon" are recognized values. */
function formatActivityType(value: string | null) {
  if (!value?.trim()) return "Brak danych";
  const normalized = value.trim().toLowerCase();
  if (normalized === "wizyta") return "Wizyta";
  if (normalized === "telefon") return "Telefon";
  return `Nierozpoznany (${value})`;
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

/**
 * One row per deviation; a visit with zero deviations (only possible when showOnlyDeviations
 * is off) still gets one row with empty Reguła/Status/Szczegół, so nothing visible on screen
 * silently disappears from the export. Shared by both the CSV and XLSX export formats.
 */
function buildExportRows(visits: VisitWithDeviations[]): string[][] {
  const rows: string[][] = [EXPORT_HEADERS];

  for (const visit of visits) {
    const representative = visit.representative_name;
    const visitDate = toDateOnly(visit.visit_date);
    const gpsEnabled = visit.gps_enabled ? "TAK" : "NIE";
    const activityType = formatActivityType(visit.activity_type);
    const distanceKm = visit.distance_km !== null ? String(visit.distance_km) : "-";
    const timeOnSite = visit.time_on_site_minutes !== null ? String(visit.time_on_site_minutes) : "-";

    if (visit.deviations.length === 0) {
      rows.push([representative, visitDate, "-", "-", "-", gpsEnabled, activityType, distanceKm, timeOnSite]);
    } else {
      for (const deviation of visit.deviations) {
        rows.push([
          representative,
          visitDate,
          RULE_LABELS[deviation.rule],
          STATUS_LABELS[deviation.status],
          deviation.detail ?? "-",
          gpsEnabled,
          activityType,
          distanceKm,
          timeOnSite,
        ]);
      }
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
 * Pure filter+sort step between flaggedVisits and the rendered rows. rule/status are
 * deviation-level and must both match the SAME deviation record (see deviationMatches) -
 * independent matches across different deviations of the same visit are not enough.
 * representative_name/visit_date are visit-level and apply regardless of deviations.
 */
function getVisibleVisits(visits: VisitWithDeviations[], filters: FilterState, sortMode: SortMode) {
  const deviationMatches = (d: Tables<"deviations">) =>
    (filters.selectedRules.size === 0 || filters.selectedRules.has(d.rule)) &&
    (filters.selectedStatuses.size === 0 || filters.selectedStatuses.has(d.status));

  const visitMatches = (v: VisitWithDeviations) =>
    (filters.selectedReps.size === 0 || filters.selectedReps.has(v.representative_name)) &&
    (!filters.dateFrom || toDateOnly(v.visit_date) >= filters.dateFrom) &&
    (!filters.dateTo || toDateOnly(v.visit_date) <= filters.dateTo) &&
    (filters.selectedRules.size === 0 && filters.selectedStatuses.size === 0
      ? true
      : v.deviations.some(deviationMatches));

  const filtered = visits.filter(visitMatches);

  return [...filtered].sort((a, b) =>
    sortMode === "representative_asc"
      ? a.representative_name.localeCompare(b.representative_name)
      : b.visit_date.localeCompare(a.visit_date),
  );
}

export default function DeviationsList({ visits: initialVisits, reportId }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [visits, setVisits] = useState<VisitWithDeviations[]>(initialVisits);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sortMode, setSortMode] = useState<SortMode>("date_desc");
  const [showOnlyDeviations, setShowOnlyDeviations] = useState(true);

  if (visits.length === 0) {
    return <p className="text-sm text-slate-500">Brak wizyt w tym raporcie.</p>;
  }

  const visitsWithDeviations = visits.filter((visit) => visit.deviations.length > 0);
  const baseVisits = showOnlyDeviations ? visitsWithDeviations : visits;

  const availableReps = [...new Set(baseVisits.map((v) => v.representative_name))].sort((a, b) =>
    a.localeCompare(b, "pl"),
  );
  const visibleVisits = getVisibleVisits(baseVisits, filters, sortMode);

  let emptyMessage: string | null = null;
  if (baseVisits.length === 0) {
    emptyMessage = "Brak wykrytych odstępstw w tym raporcie.";
  } else if (visibleVisits.length === 0) {
    emptyMessage = "Brak wyników pasujących do filtrów.";
  }

  const hasActiveFilters =
    filters.selectedRules.size > 0 ||
    filters.selectedStatuses.size > 0 ||
    filters.selectedReps.size > 0 ||
    filters.dateFrom !== null ||
    filters.dateTo !== null;

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function updateDeviationStatus(ids: string[], status: "reviewed" | "unreviewed") {
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

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 whitespace-nowrap text-slate-700 hover:bg-slate-100">
            <input
              type="checkbox"
              checked={showOnlyDeviations}
              onChange={(e) => {
                setShowOnlyDeviations(e.target.checked);
              }}
              className="cursor-pointer"
            />
            Wyświetl odstępstwa
          </label>

          <MultiSelectDropdown
            label="Reguła"
            options={ALL_RULES.map((rule) => ({ value: rule, label: RULE_LABELS[rule] }))}
            selected={filters.selectedRules}
            onChange={(next) => {
              setFilters((prev) => ({ ...prev, selectedRules: next as Set<DeviationRule> }));
            }}
          />

          <MultiSelectDropdown
            label="Status"
            options={ALL_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
            selected={filters.selectedStatuses}
            onChange={(next) => {
              setFilters((prev) => ({ ...prev, selectedStatuses: next as Set<DeviationStatus> }));
            }}
          />

          <MultiSelectDropdown
            label="Przedstawiciel"
            options={availableReps.map((rep) => ({ value: rep, label: rep }))}
            selected={filters.selectedReps}
            onChange={(next) => {
              setFilters((prev) => ({ ...prev, selectedReps: next }));
            }}
          />

          <DateField
            label="Od"
            value={filters.dateFrom}
            onChange={(next) => {
              setFilters((prev) => ({ ...prev, dateFrom: next }));
            }}
          />
          <DateField
            label="Do"
            value={filters.dateTo}
            onChange={(next) => {
              setFilters((prev) => ({ ...prev, dateTo: next }));
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="h-fit cursor-pointer"
            onClick={() => {
              setSortMode((prev) => (prev === "date_desc" ? "representative_asc" : "date_desc"));
            }}
          >
            Sortuj: {sortMode === "date_desc" ? "Data (najnowsze)" : "Przedstawiciel (A-Z)"}
          </Button>

          {hasActiveFilters && (
            <Button
              variant="outline"
              className="h-fit cursor-pointer"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
              }}
            >
              Wyczyść filtry
            </Button>
          )}

          <ExportMenu
            label="Eksportuj"
            disabled={visibleVisits.length === 0}
            options={[
              { value: "csv", label: "CSV" },
              { value: "xlsx", label: "XLS" },
            ]}
            onSelect={(value) => {
              exportList(value as "csv" | "xlsx");
            }}
          />
        </div>
      </div>

      {emptyMessage ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Przedstawiciel</TableHead>
              <TableHead>Data wizyty</TableHead>
              <TableHead>Odstępstwo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleVisits.map((visit) => {
              const isExpanded = expandedIds.has(visit.id);
              const reviewedCount = visit.deviations.filter((deviation) => deviation.status === "reviewed").length;
              const total = visit.deviations.length;
              const allReviewed = reviewedCount === total;
              const isVisitPending = visit.deviations.some((deviation) => pendingIds.has(deviation.id));

              return (
                <Fragment key={visit.id}>
                  <TableRow
                    onClick={() => {
                      toggleExpanded(visit.id);
                    }}
                    aria-expanded={isExpanded}
                    className="cursor-pointer"
                  >
                    <TableCell>{visit.representative_name}</TableCell>
                    <TableCell>{toDateOnly(visit.visit_date)}</TableCell>
                    <TableCell>
                      {total === 0 ? (
                        <span className="text-slate-500">Brak odstępstw</span>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 break-words">
                            {visit.deviations.map((deviation) => RULE_LABELS[deviation.rule]).join(", ")}{" "}
                            <span className="text-slate-500">
                              ({reviewedCount}/{total} sprawdzone)
                            </span>
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-foreground size-7 cursor-pointer hover:border-slate-400 hover:bg-slate-200"
                            title={allReviewed ? "Cofnij oznaczenie wszystkich" : "Oznacz wszystkie jako sprawdzone"}
                            aria-label={
                              allReviewed ? "Cofnij oznaczenie wszystkich" : "Oznacz wszystkie jako sprawdzone"
                            }
                            disabled={isVisitPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              void updateDeviationStatus(
                                visit.deviations.map((deviation) => deviation.id),
                                allReviewed ? "unreviewed" : "reviewed",
                              );
                            }}
                          >
                            {allReviewed ? <Undo2 className="size-3.5" /> : <CheckCheck className="size-3.5" />}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="whitespace-normal">
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm [&_dd]:break-words">
                          <dt className="font-medium">Przedstawiciel</dt>
                          <dd>{visit.representative_name}</dd>
                          <dt className="font-medium">Data wizyty</dt>
                          <dd>{toDateOnly(visit.visit_date)}</dd>
                          <dt className="font-medium">GPS włączony</dt>
                          <dd>{visit.gps_enabled ? "TAK" : "NIE"}</dd>
                          <dt className="font-medium">Typ aktywności</dt>
                          <dd>{formatActivityType(visit.activity_type)}</dd>
                          <dt className="font-medium">Dystans (km)</dt>
                          <dd>{visit.distance_km ?? "-"}</dd>
                          <dt className="font-medium">Czas na miejscu (min)</dt>
                          <dd>{visit.time_on_site_minutes ?? "-"}</dd>
                          <dt className="font-medium">Planowana trasa</dt>
                          <dd>{visit.planned_route_raw ? JSON.stringify(visit.planned_route_raw) : "-"}</dd>
                          <dt className="font-medium">Odwiedzony klient</dt>
                          <dd>{visit.visited_client ?? "-"}</dd>
                          <dt className="font-medium">Współrzędne</dt>
                          <dd>
                            {visit.visited_latitude !== null && visit.visited_longitude !== null
                              ? `${visit.visited_latitude}, ${visit.visited_longitude}`
                              : "-"}
                          </dd>
                        </dl>
                        <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3">
                          <p className="font-medium text-amber-800">Odstępstwa</p>
                          {visit.deviations.length === 0 ? (
                            <p className="mt-1 text-sm text-slate-500">Brak odstępstw dla tej wizyty.</p>
                          ) : (
                            <ul className="mt-1 space-y-1 text-sm">
                              {visit.deviations.map((deviation) => (
                                <li key={deviation.id} className="flex items-start justify-between gap-2 py-1">
                                  <span className="min-w-0 break-words">
                                    <span className="font-medium">{RULE_LABELS[deviation.rule]}</span>
                                    {deviation.detail ? `: ${deviation.detail}` : null}{" "}
                                    <span className="text-slate-500">
                                      ({deviation.status === "reviewed" ? "Sprawdzone" : "Nieprzejrzane"})
                                    </span>
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="text-foreground size-7 cursor-pointer hover:border-slate-400 hover:bg-slate-200"
                                    title={
                                      deviation.status === "reviewed" ? "Cofnij oznaczenie" : "Oznacz jako sprawdzone"
                                    }
                                    aria-label={
                                      deviation.status === "reviewed" ? "Cofnij oznaczenie" : "Oznacz jako sprawdzone"
                                    }
                                    disabled={pendingIds.has(deviation.id)}
                                    onClick={() => {
                                      void updateDeviationStatus(
                                        [deviation.id],
                                        deviation.status === "reviewed" ? "unreviewed" : "reviewed",
                                      );
                                    }}
                                  >
                                    {deviation.status === "reviewed" ? (
                                      <Undo2 className="size-3.5" />
                                    ) : (
                                      <Check className="size-3.5" />
                                    )}
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

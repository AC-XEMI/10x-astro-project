import { Fragment, useEffect, useRef, useState } from "react";
import { Check, CheckCheck, ChevronDown, Undo2, X } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/types";
import type { DeviationRule } from "@/lib/services/deviation-rules";

export type VisitWithDeviations = Tables<"visits"> & { deviations: Tables<"deviations">[] };

interface Props {
  visits: VisitWithDeviations[];
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

const ALL_RULES: DeviationRule[] = ["missing_gps", "route_deviation", "phone_instead_of_visit"];
const ALL_STATUSES: DeviationStatus[] = ["unreviewed", "reviewed"];

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
 * Closed-by-default dropdown with checkbox options — unlike a native `<select multiple>`,
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
        className="flex items-center gap-1 rounded border border-white/10 bg-white/10 px-2 py-1 whitespace-nowrap text-blue-100 backdrop-blur-xl hover:bg-white/20"
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
          className="rounded px-1 text-blue-100 hover:text-white"
          onClick={() => {
            onChange(new Set());
          }}
        >
          <X className="size-3.5" />
        </button>
      )}
      {isOpen && (
        <div className="absolute top-full left-0 z-10 mt-1 min-w-full rounded border border-slate-700 bg-slate-800 p-2 text-blue-100 shadow-lg">
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 py-0.5 whitespace-nowrap">
              <input
                type="checkbox"
                checked={selected.has(option.value)}
                onChange={() => {
                  toggleValue(option.value);
                }}
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
        className="rounded border border-white/10 bg-white/10 px-2 py-1 whitespace-nowrap text-blue-100 backdrop-blur-xl hover:bg-white/20"
        onClick={openPicker}
      >
        {value ? `${label}: ${value}` : `${label}: wybierz datę`}
      </button>
      {value && (
        <button
          type="button"
          aria-label={`Wyczyść: ${label}`}
          className="rounded px-1 text-blue-100 hover:text-white"
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
        className="absolute h-0 w-0 opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Pure filter+sort step between flaggedVisits and the rendered rows. rule/status are
 * deviation-level and must both match the SAME deviation record (see deviationMatches) —
 * independent matches across different deviations of the same visit are not enough.
 * representative_name/visit_date are visit-level and apply regardless of deviations.
 */
function getVisibleVisits(visits: VisitWithDeviations[], filters: FilterState, sortMode: SortMode) {
  const deviationMatches = (d: Tables<"deviations">) =>
    (filters.selectedRules.size === 0 || filters.selectedRules.has(d.rule)) &&
    (filters.selectedStatuses.size === 0 || filters.selectedStatuses.has(d.status));

  const visitMatches = (v: VisitWithDeviations) =>
    (filters.selectedReps.size === 0 || filters.selectedReps.has(v.representative_name)) &&
    (!filters.dateFrom || v.visit_date >= filters.dateFrom) &&
    (!filters.dateTo || v.visit_date <= filters.dateTo) &&
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

export default function DeviationsList({ visits: initialVisits }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [visits, setVisits] = useState<VisitWithDeviations[]>(initialVisits);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sortMode, setSortMode] = useState<SortMode>("date_desc");

  const flaggedVisits = visits.filter((visit) => visit.deviations.length > 0);

  if (flaggedVisits.length === 0) {
    return <p className="text-sm text-blue-100/80">Brak wykrytych odstępstw w tym raporcie.</p>;
  }

  const availableReps = [...new Set(flaggedVisits.map((v) => v.representative_name))];
  const visibleVisits = getVisibleVisits(flaggedVisits, filters, sortMode);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded border border-slate-700 p-3 text-sm">
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

        <Button
          variant="outline"
          className="h-fit cursor-pointer border-white/10 bg-white/10 text-blue-100 backdrop-blur-xl hover:bg-white/20 hover:text-white"
          onClick={() => {
            setSortMode((prev) => (prev === "date_desc" ? "representative_asc" : "date_desc"));
          }}
        >
          Sortuj: {sortMode === "date_desc" ? "Data (najnowsze)" : "Przedstawiciel (A-Z)"}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="outline"
            className="h-fit cursor-pointer border-white/10 bg-white/10 text-blue-100 backdrop-blur-xl hover:bg-white/20 hover:text-white"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
            }}
          >
            Wyczyść filtry
          </Button>
        )}
      </div>

      {visibleVisits.length === 0 ? (
        <p className="text-sm text-blue-100/80">Brak odstępstw pasujących do filtra.</p>
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
                    <TableCell>{visit.visit_date}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {visit.deviations.map((deviation) => deviation.rule).join(", ")}{" "}
                          <span className="text-blue-100/70">
                            ({reviewedCount}/{total} sprawdzone)
                          </span>
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-foreground size-7 cursor-pointer hover:border-slate-400 hover:bg-slate-200"
                          title={allReviewed ? "Cofnij oznaczenie wszystkich" : "Oznacz wszystkie jako sprawdzone"}
                          aria-label={allReviewed ? "Cofnij oznaczenie wszystkich" : "Oznacz wszystkie jako sprawdzone"}
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
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <dt className="font-medium">Przedstawiciel</dt>
                          <dd>{visit.representative_name}</dd>
                          <dt className="font-medium">Data wizyty</dt>
                          <dd>{visit.visit_date}</dd>
                          <dt className="font-medium">GPS włączony</dt>
                          <dd>{visit.gps_enabled ? "TAK" : "NIE"}</dd>
                          <dt className="font-medium">Typ aktywności</dt>
                          <dd>{visit.activity_type ?? "—"}</dd>
                          <dt className="font-medium">Dystans (km)</dt>
                          <dd>{visit.distance_km ?? "—"}</dd>
                          <dt className="font-medium">Czas na miejscu (min)</dt>
                          <dd>{visit.time_on_site_minutes ?? "—"}</dd>
                          <dt className="font-medium">Planowana trasa</dt>
                          <dd>{visit.planned_route_raw ? JSON.stringify(visit.planned_route_raw) : "—"}</dd>
                          <dt className="font-medium">Odwiedzony klient</dt>
                          <dd>{visit.visited_client ?? "—"}</dd>
                          <dt className="font-medium">Współrzędne</dt>
                          <dd>
                            {visit.visited_latitude !== null && visit.visited_longitude !== null
                              ? `${visit.visited_latitude}, ${visit.visited_longitude}`
                              : "—"}
                          </dd>
                        </dl>
                        <p className="mt-2 font-medium">Odstępstwa</p>
                        <ul className="space-y-1 text-sm">
                          {visit.deviations.map((deviation) => (
                            <li key={deviation.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                              <span>
                                <span className="font-medium">{deviation.rule}</span>
                                {deviation.detail ? `: ${deviation.detail}` : null}{" "}
                                <span className="text-blue-100/70">
                                  ({deviation.status === "reviewed" ? "Sprawdzone" : "Nieprzejrzane"})
                                </span>
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-foreground size-7 cursor-pointer hover:border-slate-400 hover:bg-slate-200"
                                title={deviation.status === "reviewed" ? "Cofnij oznaczenie" : "Oznacz jako sprawdzone"}
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

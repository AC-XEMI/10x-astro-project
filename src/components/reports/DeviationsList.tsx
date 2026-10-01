import { Fragment, useState } from "react";
import { Check, CheckCheck, Undo2 } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/types";

export type VisitWithDeviations = Tables<"visits"> & { deviations: Tables<"deviations">[] };

interface Props {
  visits: VisitWithDeviations[];
}

export default function DeviationsList({ visits: initialVisits }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [visits, setVisits] = useState<VisitWithDeviations[]>(initialVisits);

  const flaggedVisits = visits.filter((visit) => visit.deviations.length > 0);

  if (flaggedVisits.length === 0) {
    return <p className="text-sm text-blue-100/80">Brak wykrytych odstępstw w tym raporcie.</p>;
  }

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
    try {
      const response = await fetch("/api/deviations/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });

      if (!response.ok) {
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
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Przedstawiciel</TableHead>
          <TableHead>Data wizyty</TableHead>
          <TableHead>Odstępstwo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {flaggedVisits.map((visit) => {
          const isExpanded = expandedIds.has(visit.id);
          const reviewedCount = visit.deviations.filter((deviation) => deviation.status === "reviewed").length;
          const total = visit.deviations.length;
          const allReviewed = reviewedCount === total;

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
  );
}

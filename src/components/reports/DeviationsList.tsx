import { Fragment, useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { Tables } from "@/types";

export type VisitWithDeviations = Tables<"visits"> & { deviations: Tables<"deviations">[] };

interface Props {
  visits: VisitWithDeviations[];
}

export default function DeviationsList({ visits }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
                <TableCell>{visit.deviations.map((deviation) => deviation.rule).join(", ")}</TableCell>
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
                    {visit.deviations.some((deviation) => deviation.detail) && (
                      <>
                        <p className="mt-2 font-medium">Szczegóły odstępstw</p>
                        <ul className="list-disc pl-5 text-sm">
                          {visit.deviations
                            .filter((deviation) => deviation.detail)
                            .map((deviation) => (
                              <li key={deviation.id}>{deviation.detail}</li>
                            ))}
                        </ul>
                      </>
                    )}
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

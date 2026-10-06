import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDelta, type RankingRow } from "@/lib/services/dashboard-stats";

interface Props {
  ranking: RankingRow[];
  comparisonLabel: string;
}

/** Widest "Struktura" bar in px; other bars scale against the representative with most deviations. */
const MAX_BAR_PX = 130;

// Rendered server-side only (no client directive) - React here just reuses the shadcn table.
export default function RankingTable({ ranking, comparisonLabel }: Props) {
  const maxDeviations = Math.max(1, ...ranking.map((r) => r.deviations));
  const num = "text-right tabular-nums";
  const optional = (n: number) => <TableCell className={cn(num, !n && "text-muted-foreground")}>{n || "—"}</TableCell>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Przedstawiciel</TableHead>
          <TableHead className="text-right">Wizyty</TableHead>
          <TableHead className="text-right">Odstępstwa</TableHead>
          <TableHead className="text-right" title="Odsetek wizyt z co najmniej jednym odstępstwem">
            % wizyt
          </TableHead>
          <TableHead className="w-[150px]">Struktura</TableHead>
          <TableHead className="text-right">Brak GPS</TableHead>
          <TableHead className="text-right">Telefon</TableHead>
          <TableHead className="text-right">Trasa</TableHead>
          <TableHead className="text-right">{comparisonLabel}</TableHead>
          <TableHead className="text-right">Do przeglądu</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ranking.map((row, i) => (
          <TableRow key={row.name}>
            <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className={cn(num, "text-muted-foreground")}>{row.visits}</TableCell>
            <TableCell className={cn(num, row.deviations ? "text-destructive font-semibold" : "text-muted-foreground")}>
              {row.deviations}
            </TableCell>
            <TableCell className={num}>{Math.round((row.flaggedVisits / row.visits) * 100)}%</TableCell>
            <TableCell>
              {row.deviations > 0 && (
                <div
                  className="flex h-2 gap-0.5 overflow-hidden rounded-full"
                  style={{ width: Math.max(12, (row.deviations / maxDeviations) * MAX_BAR_PX) }}
                  aria-label={`Brak GPS: ${row.missing_gps}, telefon: ${row.phone_instead_of_visit}, trasa: ${row.route_deviation}`}
                >
                  <div className="bg-primary" style={{ flex: row.missing_gps }} />
                  <div className="bg-primary/55" style={{ flex: row.phone_instead_of_visit }} />
                  <div className="bg-primary/25" style={{ flex: row.route_deviation }} />
                </div>
              )}
            </TableCell>
            {optional(row.missing_gps)}
            {optional(row.phone_instead_of_visit)}
            {optional(row.route_deviation)}
            <TableCell className={cn(num, row.delta > 0 ? "text-destructive font-medium" : "text-muted-foreground")}>
              {formatDelta(row.delta)}
            </TableCell>
            <TableCell className={cn(num, row.unreviewed ? "font-medium" : "text-muted-foreground")}>
              {row.unreviewed}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

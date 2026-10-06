import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildCsv, downloadBlob } from "@/lib/export-file";
import type { RankingRow } from "@/lib/services/dashboard-stats";

interface Props {
  ranking: RankingRow[];
  periodLabel: string;
  comparisonLabel: string;
  filename: string;
}

/** Exports the representatives ranking exactly as shown on the dashboard. */
export default function DashboardExport({ ranking, periodLabel, comparisonLabel, filename }: Props) {
  function exportRanking() {
    const rows: string[][] = [
      [
        "Okres",
        "Przedstawiciel",
        "Wizyty",
        "Odstępstwa",
        "% wizyt z odstępstwem",
        "Brak GPS",
        "Telefon zamiast wizyty",
        "Odchylenie od trasy",
        `Zmiana ${comparisonLabel}`,
        "Do przeglądu",
      ],
      ...ranking.map((row) => [
        periodLabel,
        row.name,
        String(row.visits),
        String(row.deviations),
        String(Math.round((row.flaggedVisits / row.visits) * 100)),
        String(row.missing_gps),
        String(row.phone_instead_of_visit),
        String(row.route_deviation),
        String(row.delta),
        String(row.unreviewed),
      ]),
    ];
    try {
      downloadBlob(new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8;" }), filename);
    } catch (error) {
      console.error("Błąd podczas eksportu pulpitu:", error);
    }
  }

  return (
    <Button variant="outline" onClick={exportRanking} disabled={ranking.length === 0}>
      <Download />
      Eksportuj
    </Button>
  );
}

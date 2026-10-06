import { useState } from "react";
import { CircleAlert, FileText, Search, Trash2 } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Tables } from "@/types";
import { plural } from "@/lib/utils";

/** Formats as Y-m-d H:i (e.g. "2026-10-02 14:30"), independent of browser locale. */
function formatUploadedAt(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * What the cascade delete takes with it. row_count = visits (one visit per parsed row),
 * deviation_count = deviation records; either can be null (not stored), which falls back
 * to wording without a number rather than a wrong one.
 */
function DeleteWarning({ report }: { report: Tables<"reports"> }) {
  const visits =
    report.row_count === null
      ? "wszystkie wizyty"
      : `${report.row_count} ${plural(report.row_count, "wizyta", "wizyty", "wizyt")}`;
  const deviations =
    report.deviation_count === null
      ? "wszystkie wykryte odstępstwa"
      : report.deviation_count === 0
        ? null
        : `${report.deviation_count} ${plural(report.deviation_count, "wykryte odstępstwo", "wykryte odstępstwa", "wykrytych odstępstw")}`;

  return (
    <div className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md p-3 text-sm">
      <CircleAlert className="mt-0.5 size-4 flex-none" />
      <span>
        Razem z raportem znikną wszystkie jego dane: <strong>{visits}</strong>
        {deviations ? (
          <>
            {" "}
            i <strong>{deviations}</strong>, także te już oznaczone jako sprawdzone.
          </>
        ) : (
          "."
        )}
      </span>
    </div>
  );
}

/** null = count not stored (e.g. the count update failed after upload) - shown as unknown, never as "Brak". */
function DeviationCount({ count }: { count: number | null }) {
  if (count === null) return <span className="text-muted-foreground">—</span>;
  if (count === 0) return <span className="text-muted-foreground">Brak</span>;
  return <span className="text-destructive font-medium">{count}</span>;
}

interface Props {
  reports: Tables<"reports">[];
  page: number;
}

export default function ReportsList({ reports, page }: Props) {
  const [deletingReport, setDeletingReport] = useState<Tables<"reports"> | null>(null);

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <FileText className="text-muted-foreground size-8" />
        <p className="font-medium">Nie masz jeszcze żadnych wgranych raportów</p>
        <p className="text-muted-foreground max-w-md text-sm">
          Wgraj pierwszy plik z trasówkami powyżej — po przetworzeniu zobaczysz tu listę raportów i liczbę wykrytych
          odstępstw.
        </p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nazwa pliku</TableHead>
            <TableHead>Data wgrania</TableHead>
            <TableHead className="text-right">Liczba wierszy</TableHead>
            <TableHead className="text-right">Odstępstwa</TableHead>
            <TableHead className="text-right">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <FileText className="text-muted-foreground size-4" />
                  <span>{report.original_filename}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {formatUploadedAt(report.uploaded_at)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{report.row_count ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">
                <DeviationCount count={report.deviation_count} />
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  <Button asChild variant="ghost" size="icon" className="text-primary size-8">
                    <a href={`/reports/${report.id}`} title="Zobacz raport" aria-label="Zobacz raport">
                      <Search />
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="size-8 cursor-pointer"
                    title="Usuń raport"
                    aria-label="Usuń raport"
                    onClick={() => {
                      setDeletingReport(report);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog
        open={deletingReport !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingReport(null);
          }
        }}
      >
        <DialogContent>
          {deletingReport && (
            <>
              <DialogHeader>
                <DialogTitle>Usunąć raport?</DialogTitle>
                <DialogDescription>Tej operacji nie można cofnąć.</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="font-medium">Nazwa pliku</dt>
                <dd>{deletingReport.original_filename}</dd>
                <dt className="font-medium">Data wgrania</dt>
                <dd className="tabular-nums">{formatUploadedAt(deletingReport.uploaded_at)}</dd>
                <dt className="font-medium">Liczba wierszy</dt>
                <dd className="tabular-nums">{deletingReport.row_count ?? "—"}</dd>
              </dl>
              <DeleteWarning report={deletingReport} />
              <form method="POST" action={`/api/reports/${deletingReport.id}/delete`}>
                <input type="hidden" name="page" value={page} />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => {
                      setDeletingReport(null);
                    }}
                  >
                    Anuluj
                  </Button>
                  <Button type="submit" variant="destructive" className="cursor-pointer">
                    <Trash2 /> Tak, usuń raport
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

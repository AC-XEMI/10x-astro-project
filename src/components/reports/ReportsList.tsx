import { useState } from "react";
import { Search, Trash2 } from "lucide-react";
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

/** Formats as Y-m-d H:i (e.g. "2026-10-02 14:30"), independent of browser locale. */
function formatUploadedAt(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface Props {
  reports: Tables<"reports">[];
  page: number;
}

export default function ReportsList({ reports, page }: Props) {
  const [deletingReport, setDeletingReport] = useState<Tables<"reports"> | null>(null);

  if (reports.length === 0) {
    return <p className="text-sm text-slate-500">Nie masz jeszcze żadnych wgranych raportów.</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nazwa pliku</TableHead>
            <TableHead>Data wgrania</TableHead>
            <TableHead>Liczba wierszy</TableHead>
            <TableHead>Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id}>
              <TableCell>{report.original_filename}</TableCell>
              <TableCell>{formatUploadedAt(report.uploaded_at)}</TableCell>
              <TableCell>{report.row_count ?? "—"}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <a
                    href={`/reports/${report.id}`}
                    className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-indigo-600 hover:bg-indigo-50"
                    title="Zobacz raport"
                    aria-label="Zobacz raport"
                  >
                    <Search className="size-4" />
                  </a>
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
                    <Trash2 className="size-4" />
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
                <dd>{formatUploadedAt(deletingReport.uploaded_at)}</dd>
                <dt className="font-medium">Liczba wierszy</dt>
                <dd>{deletingReport.row_count ?? "—"}</dd>
              </dl>
              <form method="POST" action={`/api/reports/${deletingReport.id}/delete`}>
                <input type="hidden" name="page" value={page} />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDeletingReport(null);
                    }}
                  >
                    Anuluj
                  </Button>
                  <Button type="submit" variant="destructive">
                    Tak, usuń
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

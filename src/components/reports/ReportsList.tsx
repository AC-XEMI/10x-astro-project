import { useState } from "react";
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

interface Props {
  reports: Tables<"reports">[];
  page: number;
}

export default function ReportsList({ reports, page }: Props) {
  const [deletingReport, setDeletingReport] = useState<Tables<"reports"> | null>(null);

  if (reports.length === 0) {
    return <p className="text-sm text-blue-100/80">Nie masz jeszcze żadnych wgranych raportów.</p>;
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
              <TableCell>{new Date(report.uploaded_at).toLocaleString("pl-PL")}</TableCell>
              <TableCell>{report.row_count ?? "—"}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <a href={`/reports/${report.id}`}>Zobacz</a>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeletingReport(report);
                    }}
                  >
                    Usuń
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
                <dd>{new Date(deletingReport.uploaded_at).toLocaleString("pl-PL")}</dd>
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

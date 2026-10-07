import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { Check, CircleAlert, Download, FileText, RotateCw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reportErrorMessage } from "@/lib/report-errors";
import { cn } from "@/lib/utils";
import { checkRequiredColumns, REQUIRED_COLUMNS, type ColumnCheck } from "@/lib/services/report-columns";

// Mirrors the server-side checks in src/pages/api/reports/upload.ts and report-parser.ts —
// these only give instant feedback; the endpoint stays the authority.
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"];
const TEMPLATE_URL = "/wzor-raportu.xlsx";

/** Visible focus for elements that only receive programmatic focus (tabIndex={-1}). */
const FOCUS_TARGET_CLASS = "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export type UploadError =
  | { kind: "too_large"; fileName: string; size: number }
  | { kind: "bad_format"; fileName: string }
  | { kind: "missing_columns"; fileName: string; columns: ColumnCheck[] }
  // The endpoint redirected to /reports?error=<code>[&detail=…]; shown here instead of navigating.
  | { kind: "server"; code: string; detail?: string; fileName?: string }
  | { kind: "network"; fileName?: string };

export type UploadState =
  | { kind: "idle"; error?: UploadError }
  | { kind: "checking"; fileName: string }
  | { kind: "uploading"; fileName: string; loaded: number; total: number }
  | { kind: "processing"; fileName: string };

/** How to fix a missing required column when no near-miss header was found. */
const MISSING_COLUMN_HINTS: Record<(typeof REQUIRED_COLUMNS)[number], string> = {
  przedstawiciel: "Dodaj kolumnę z imieniem i nazwiskiem przedstawiciela.",
  data_wizyty: "Dodaj kolumnę z datą wizyty w formacie RRRR-MM-DD.",
  gps_wlaczony: "Dodaj kolumnę z informacją, czy GPS był włączony (TAK/NIE).",
  odwiedzony_klient: "Dodaj kolumnę z nazwą lub kodem klienta odwiedzonego podczas wizyty.",
};

/** Extra format note appended to the rename hint, where the parser is strict about values. */
const COLUMN_FORMAT_NOTES: Partial<Record<(typeof REQUIRED_COLUMNS)[number], string>> = {
  data_wizyty: "Daty w formacie RRRR-MM-DD.",
  gps_wlaczony: "Wartości TAK/NIE.",
};

function formatSize(bytes: number) {
  const fmt = (n: number) => n.toFixed(1).replace(".", ",");
  return bytes >= 1024 * 1024 ? `${fmt(bytes / (1024 * 1024))} MB` : `${fmt(bytes / 1024)} KB`;
}

function extensionOf(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase();
}

function validate(file: File): UploadError | null {
  if (!ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))) {
    return { kind: "bad_format", fileName: file.name };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { kind: "too_large", fileName: file.name, size: file.size };
  }
  return null;
}

/**
 * Reads only the header row, the same way report-parser.ts does (CSV as UTF-8 text, first
 * non-blank row). Returns null when the file can't be read here - the upload then goes ahead
 * and the server reports the problem. xlsx is loaded lazily so it stays out of the page bundle.
 */
async function readHeaders(file: File): Promise<string[] | null> {
  try {
    const XLSX = await import("xlsx");
    const options = { sheetRows: 20 };
    const workbook =
      extensionOf(file.name) === ".csv"
        ? XLSX.read(await file.text(), { ...options, type: "string" })
        : XLSX.read(await file.arrayBuffer(), { ...options, type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    if (!sheet) return null;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, blankrows: false });
    if (rows.length === 0) return null;
    return rows[0].map((cell) => (typeof cell === "string" ? cell : String(cell)));
  } catch {
    return null;
  }
}

function columnNote(column: ColumnCheck) {
  if (column.found) return "Znaleziono";
  if (column.similar) {
    const formatNote = COLUMN_FORMAT_NOTES[column.name];
    return `Brak. Jest podobna kolumna „${column.similar.header}” (kolumna ${column.similar.column}): zmień jej nagłówek na ${column.name}.${formatNote ? ` ${formatNote}` : ""}`;
  }
  return `Brak. ${MISSING_COLUMN_HINTS[column.name]}`;
}

function ErrorCard({
  title,
  titleRef,
  fileName,
  children,
  footer,
}: {
  title: string;
  titleRef: Ref<HTMLDivElement>;
  fileName?: string;
  children?: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Card className="border-destructive gap-4 rounded-lg p-5 shadow-none" role="alert">
      <div className="flex items-start gap-3">
        <div className="bg-destructive/10 text-destructive flex size-9 flex-none items-center justify-center rounded-full">
          <CircleAlert className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div ref={titleRef} tabIndex={-1} className={cn("font-semibold", FOCUS_TARGET_CLASS)}>
            {title}
          </div>
          {fileName && (
            <div className="text-muted-foreground flex min-w-0 items-center gap-1 text-sm">
              <FileText className="size-4 flex-none" />
              <span className="truncate">{fileName}</span>
            </div>
          )}
        </div>
      </div>
      {children}
      {footer}
    </Card>
  );
}

function FixList({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="font-medium">{heading}</div>
      <ul className="text-muted-foreground list-disc space-y-1 pl-[18px]">{children}</ul>
    </div>
  );
}

interface Props {
  /** Dev kitchen sink only: render an error state without picking a file. */
  initialError?: UploadError;
  /** Dev kitchen sink only: render a progress stage (checking/uploading/processing) without a file. */
  initialState?: UploadState;
}

export default function ReportUpload({ initialError, initialState }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  // The file of the last attempt, so a network failure can be retried without picking it again.
  const lastFileRef = useRef<File | null>(null);
  const [state, setState] = useState<UploadState>(initialState ?? { kind: "idle", error: initialError });
  const [dragging, setDragging] = useState(false);

  // Focus targets, so focus never falls to <body> when the card swaps its content.
  const statusRef = useRef<HTMLDivElement>(null);
  const errorTitleRef = useRef<HTMLDivElement>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  // State seen by the previous effect run; null until the first render has been committed.
  const previousStateRef = useRef<UploadState | null>(null);

  useEffect(() => {
    const previous = previousStateRef.current;
    previousStateRef.current = state;
    // Initial render (idle on page load, or initialError/initialState in the kitchen sink): don't steal focus.
    if (previous === null) return;
    if (state.kind !== "idle") {
      // Entering progress from idle, or a stage change removed the focused control (Anuluj).
      if (previous.kind === "idle" || (previous.kind !== state.kind && document.activeElement === document.body)) {
        statusRef.current?.focus();
      }
      return;
    }
    const previousError = previous.kind === "idle" ? previous.error : undefined;
    if (state.error) {
      if (state.error !== previousError) errorTitleRef.current?.focus();
    } else if (previous.kind !== "idle" || previousError) {
      // Error dismissed ("Zamknij") or upload cancelled: back to "Wgraj raport".
      uploadButtonRef.current?.focus();
    }
  }, [state]);

  function pickFile() {
    inputRef.current?.click();
  }

  function dismissError() {
    setState({ kind: "idle" });
  }

  function retryUpload() {
    if (lastFileRef.current) void startUpload(lastFileRef.current);
  }

  async function startUpload(file: File) {
    lastFileRef.current = file;
    const error = validate(file);
    if (error) {
      setState({ kind: "idle", error });
      return;
    }

    setState({ kind: "checking", fileName: file.name });
    const headers = await readHeaders(file);
    if (headers) {
      const columns = checkRequiredColumns(headers);
      if (columns.some((column) => !column.found)) {
        setState({ kind: "idle", error: { kind: "missing_columns", fileName: file.name, columns } });
        return;
      }
    }

    const body = new FormData();
    body.append("report_file", file);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/reports/upload");
    xhr.upload.onprogress = (event) => {
      setState({ kind: "uploading", fileName: file.name, loaded: event.loaded, total: event.total || file.size });
    };
    xhr.upload.onload = () => {
      setState({ kind: "processing", fileName: file.name });
    };
    // The endpoint answers with a redirect (report page on success, /reports?error=… on
    // failure); XHR follows it, so responseURL is where a plain form POST would have landed.
    // A failure redirect is shown in this card instead of reloading the page.
    xhr.onload = () => {
      const target = xhr.responseURL ? new URL(xhr.responseURL) : null;
      const code = target?.pathname === "/reports" ? target.searchParams.get("error") : null;
      if (target && code !== null) {
        xhrRef.current = null;
        setState({
          kind: "idle",
          error: { kind: "server", code, detail: target.searchParams.get("detail") ?? undefined, fileName: file.name },
        });
        return;
      }
      window.location.assign(xhr.responseURL || "/reports");
    };
    xhr.onerror = () => {
      xhrRef.current = null;
      setState({ kind: "idle", error: { kind: "network", fileName: file.name } });
    };
    xhr.onabort = () => {
      xhrRef.current = null;
      setState({ kind: "idle" });
    };

    setState({ kind: "uploading", fileName: file.name, loaded: 0, total: file.size });
    xhr.send(body);
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      name="report_file"
      accept={ACCEPTED_EXTENSIONS.join(",")}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void startUpload(file);
      }}
    />
  );

  const closeButton = (
    <Button type="button" variant="outline" onClick={dismissError}>
      Zamknij
    </Button>
  );

  const pickAnotherFooter = (label: string) => (
    <div className="flex items-center justify-end gap-2">
      {closeButton}
      <Button type="button" onClick={pickFile}>
        <Upload /> {label}
      </Button>
    </div>
  );

  if (state.kind !== "idle") {
    const percent =
      state.kind === "uploading" ? (state.total > 0 ? Math.round((state.loaded / state.total) * 100) : 0) : 100;
    const isUploading = state.kind === "uploading";
    const valueText =
      state.kind === "uploading"
        ? `Wysyłanie ${percent}%`
        : state.kind === "checking"
          ? "Sprawdzanie kolumn"
          : "Przetwarzanie";
    return (
      <Card className="flex-row items-center gap-6 rounded-lg p-6 shadow-none">
        <div className="bg-primary/10 text-primary flex size-11 flex-none items-center justify-center rounded-full">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="truncate font-medium">{state.fileName}</span>
            <span className="text-muted-foreground whitespace-nowrap tabular-nums">
              {isUploading
                ? `${formatSize(state.loaded)} z ${formatSize(state.total)} · ${percent}%`
                : state.kind === "checking"
                  ? "Sprawdzanie kolumn…"
                  : "Przetwarzanie…"}
            </span>
          </div>
          <div
            className="bg-muted h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-label="Postęp wgrywania"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={isUploading ? percent : undefined}
            aria-valuetext={valueText}
          >
            <div
              className={cn(
                "bg-primary h-full rounded-full transition-all",
                !isUploading && "animate-pulse motion-reduce:animate-none",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div
            ref={statusRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            className={cn("text-muted-foreground text-xs", FOCUS_TARGET_CLASS)}
          >
            {isUploading
              ? "Wgrywanie… Po zakończeniu sprawdzimy wiersze pod kątem odstępstw."
              : state.kind === "checking"
                ? "Sprawdzamy, czy plik ma wymagane kolumny."
                : "Sprawdzamy wiersze pod kątem odstępstw. To potrwa kilka sekund."}
          </div>
        </div>
        {isUploading && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              xhrRef.current?.abort();
            }}
          >
            <X /> Anuluj
          </Button>
        )}
      </Card>
    );
  }

  const { error } = state;

  if (error?.kind === "too_large") {
    return (
      <>
        <ErrorCard
          titleRef={errorTitleRef}
          title={`Plik jest za duży: ${formatSize(error.size)} (limit 5 MB)`}
          fileName={error.fileName}
          footer={pickAnotherFooter("Wybierz inny plik")}
        >
          <FixList heading="Jak zmniejszyć plik:">
            <li>Wgraj każdy miesiąc osobno, bo jeden raport powinien obejmować jeden okres.</li>
            <li>Usuń zbędne zakładki, wykresy i kolumny i zostaw tylko dane wizyt.</li>
            <li>Zapisz plik jako CSV UTF-8: zwykle jest kilka razy mniejszy niż XLSX.</li>
          </FixList>
        </ErrorCard>
        {fileInput}
      </>
    );
  }

  if (error?.kind === "bad_format") {
    const extension = extensionOf(error.fileName);
    return (
      <>
        <ErrorCard
          titleRef={errorTitleRef}
          title={extension ? `Nieobsługiwany format pliku: ${extension}` : "Nieobsługiwany format pliku"}
          fileName={error.fileName}
          footer={pickAnotherFooter("Wybierz inny plik")}
        >
          <FixList heading="Wgraj plik CSV lub XLSX:">
            <li>
              Excel: <span className="text-foreground">Plik → Zapisz jako → Skoroszyt programu Excel (.xlsx)</span> lub{" "}
              <span className="text-foreground">CSV UTF-8 (rozdzielany przecinkami)</span>.
            </li>
            <li>Raport z systemu CRM pobierz ponownie, wybierając eksport do CSV lub XLSX zamiast PDF.</li>
            <li>Pliki .xls (Excel 97–2003) otwórz i zapisz jako .xlsx.</li>
          </FixList>
        </ErrorCard>
        {fileInput}
      </>
    );
  }

  if (error?.kind === "server") {
    return (
      <>
        <ErrorCard
          titleRef={errorTitleRef}
          title={reportErrorMessage(error.code)}
          fileName={error.fileName}
          footer={pickAnotherFooter("Wybierz inny plik")}
        >
          {error.code === "invalid_file" && error.detail && <p className="text-sm text-pretty">{error.detail}</p>}
        </ErrorCard>
        {fileInput}
      </>
    );
  }

  if (error?.kind === "network") {
    return (
      <>
        <ErrorCard
          titleRef={errorTitleRef}
          title="Nie udało się wgrać pliku"
          fileName={error.fileName}
          footer={
            <div className="flex items-center justify-end gap-2">
              {closeButton}
              <Button type="button" onClick={retryUpload}>
                <RotateCw /> Spróbuj ponownie
              </Button>
            </div>
          }
        >
          <p className="text-muted-foreground text-sm">Sprawdź połączenie i spróbuj ponownie.</p>
        </ErrorCard>
        {fileInput}
      </>
    );
  }

  if (error?.kind === "missing_columns") {
    const missingCount = error.columns.filter((column) => !column.found).length;
    return (
      <>
        <ErrorCard
          titleRef={errorTitleRef}
          title={`Brakuje ${missingCount} z ${error.columns.length} wymaganych kolumn`}
          fileName={error.fileName}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button asChild variant="link" className="px-0">
                <a href={TEMPLATE_URL} download>
                  <Download /> Pobierz wzór pliku
                </a>
              </Button>
              <div className="flex items-center gap-2">
                {closeButton}
                <Button type="button" onClick={pickFile}>
                  <Upload /> Wgraj poprawiony plik
                </Button>
              </div>
            </div>
          }
        >
          <p className="text-muted-foreground text-sm text-pretty">
            Pierwszy wiersz arkusza musi zawierać nagłówki o dokładnie takich nazwach: małe litery, bez polskich znaków,
            z podkreślnikiem zamiast spacji.
          </p>
          <div className="divide-y rounded-md border">
            {error.columns.map((column) => (
              <div key={column.name} className="flex items-start gap-3 px-3 py-2 text-sm">
                <span className="mt-0.5 flex flex-none">
                  {column.found ? (
                    <Check className="text-muted-foreground size-4" aria-label="Znaleziono" />
                  ) : (
                    <X className="text-destructive size-4" aria-label="Brak" />
                  )}
                </span>
                <code
                  className={cn(
                    "w-[150px] flex-none font-mono",
                    column.found ? "text-muted-foreground" : "text-destructive font-medium",
                  )}
                >
                  {column.name}
                </code>
                <span className={cn("min-w-0", column.found ? "text-muted-foreground" : "text-foreground")}>
                  {columnNote(column)}
                </span>
              </div>
            ))}
          </div>
        </ErrorCard>
        {fileInput}
      </>
    );
  }

  return (
    <div
      className={cn(
        "bg-card border-muted-foreground flex flex-wrap items-center justify-between gap-6 rounded-lg border-[1.5px] border-dashed p-6 transition-colors",
        dragging && "border-primary bg-primary/10",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        // dragleave also fires when moving onto a child element - ignore those.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files.item(0);
        if (file) void startUpload(file);
      }}
    >
      <div className="flex items-center gap-4">
        <div className="bg-primary/10 text-primary flex size-11 flex-none items-center justify-center rounded-full">
          <Upload className="size-5" />
        </div>
        <div className="space-y-1">
          <div className="font-medium">Przeciągnij plik tutaj lub wybierz z dysku</div>
          <div className="text-muted-foreground text-sm">CSV lub XLSX · maks. 5 MB</div>
        </div>
      </div>
      <Button ref={uploadButtonRef} type="button" onClick={pickFile}>
        <Upload /> Wgraj raport
      </Button>
      {fileInput}
    </div>
  );
}

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Mirrors the server-side checks in src/pages/api/reports/upload.ts — these only give
// instant feedback; the endpoint stays the authority.
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"];

type UploadState =
  | { kind: "idle"; error?: string }
  | { kind: "uploading"; fileName: string; loaded: number; total: number }
  | { kind: "processing"; fileName: string };

function formatSize(bytes: number) {
  const fmt = (n: number) => n.toFixed(1).replace(".", ",");
  return bytes >= 1024 * 1024 ? `${fmt(bytes / (1024 * 1024))} MB` : `${fmt(bytes / 1024)} KB`;
}

function validate(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "Nieobsługiwany typ pliku. Wybierz plik CSV lub XLSX.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Plik przekracza limit 5 MB.";
  }
  return null;
}

export default function ReportUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);

  function startUpload(file: File) {
    const error = validate(file);
    if (error) {
      setState({ kind: "idle", error });
      return;
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
    xhr.onload = () => {
      window.location.assign(xhr.responseURL || "/reports");
    };
    xhr.onerror = () => {
      xhrRef.current = null;
      setState({ kind: "idle", error: "Nie udało się wgrać pliku. Sprawdź połączenie i spróbuj ponownie." });
    };
    xhr.onabort = () => {
      xhrRef.current = null;
      setState({ kind: "idle" });
    };

    setState({ kind: "uploading", fileName: file.name, loaded: 0, total: file.size });
    xhr.send(body);
  }

  if (state.kind !== "idle") {
    const percent =
      state.kind === "processing" ? 100 : state.total > 0 ? Math.round((state.loaded / state.total) * 100) : 0;
    return (
      <div className="bg-card flex items-center gap-6 rounded-lg border p-6">
        <div className="bg-primary/10 text-primary flex size-11 flex-none items-center justify-center rounded-full">
          <FileText className="size-5" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="truncate font-medium">{state.fileName}</span>
            <span className="text-muted-foreground whitespace-nowrap tabular-nums">
              {state.kind === "uploading"
                ? `${formatSize(state.loaded)} z ${formatSize(state.total)} · ${percent}%`
                : "Przetwarzanie…"}
            </span>
          </div>
          <div
            className="bg-muted h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-label="Postęp wgrywania"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="text-muted-foreground text-xs">
            {state.kind === "uploading"
              ? "Wgrywanie… Po zakończeniu sprawdzimy wiersze pod kątem odstępstw."
              : "Sprawdzamy wiersze pod kątem odstępstw. To potrwa kilka sekund."}
          </div>
        </div>
        {state.kind === "uploading" && (
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => {
              xhrRef.current?.abort();
            }}
          >
            <X /> Anuluj
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "bg-card flex flex-wrap items-center justify-between gap-6 rounded-lg border-[1.5px] border-dashed p-6 transition-colors",
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
          if (file) startUpload(file);
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
        <Button
          type="button"
          className="cursor-pointer"
          onClick={() => {
            inputRef.current?.click();
          }}
        >
          <Upload /> Wgraj raport
        </Button>
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
            if (file) startUpload(file);
          }}
        />
      </div>
      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}

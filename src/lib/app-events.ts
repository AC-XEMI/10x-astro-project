import type { ReportErrorCode } from "@/lib/report-errors";
import type { ReviewErrorCode } from "@/lib/review-errors";

/**
 * Structured log entries for server-side failures, kept by Cloudflare Workers Logs
 * (`observability.logs.enabled` in wrangler.jsonc) and queryable there by `event`.
 *
 * Every entry goes through buildAppEvent, which copies only whitelisted fields: no filename,
 * no raw Supabase `message`/`details` (Postgres can splice row values into them), no value from
 * an uploaded sheet. Add a new event name or field here, never at the call site.
 */

const EVENT_LEVELS = {
  "report.upload.rejected": "warn",
  "report.upload.failed": "error",
  "report.upload.rollback_failed": "error",
  "report.upload.count_failed": "warn",
  "report.delete.rejected": "warn",
  "report.delete.failed": "error",
  "deviation.review.rejected": "warn",
  "deviation.review.failed": "error",
} as const;

export type AppEventName = keyof typeof EVENT_LEVELS;
export type AppEventLevel = (typeof EVENT_LEVELS)[AppEventName];

export type AppEventStage =
  | "config"
  | "validate"
  | "parse"
  | "insert_report"
  | "insert_visits"
  | "insert_deviations"
  | "store_count"
  | "rollback"
  | "delete"
  | "review";

export type AppEventCode = ReportErrorCode | ReviewErrorCode;

export interface AppEventInput {
  event: AppEventName;
  code?: AppEventCode;
  stage?: AppEventStage;
  userId?: string;
  reportId?: string;
  fileExt?: string;
  fileSize?: number;
  rowCount?: number;
  /** Any Supabase/Postgres error; only its `code` is kept. */
  dbError?: { code?: string } | null;
  /** Parser message (row number + sheet column name) - kept only for `invalid_file`. */
  detail?: string;
}

export interface AppEvent {
  event: AppEventName;
  level: AppEventLevel;
  code?: AppEventCode;
  stage?: AppEventStage;
  user_id?: string;
  report_id?: string;
  file_ext?: string;
  file_size?: number;
  row_count?: number;
  db_code?: string;
  detail?: string;
}

const MAX_DETAIL_LENGTH = 300;

// Ids are kept only when UUID-shaped: a report id can come straight from a URL parameter, and
// arbitrary text typed there must not reach the logs.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildAppEvent(input: AppEventInput): AppEvent {
  const entry: AppEvent = { event: input.event, level: EVENT_LEVELS[input.event] };
  if (input.code !== undefined) entry.code = input.code;
  if (input.stage !== undefined) entry.stage = input.stage;
  if (input.userId !== undefined && UUID_RE.test(input.userId)) entry.user_id = input.userId;
  if (input.reportId !== undefined && UUID_RE.test(input.reportId)) entry.report_id = input.reportId;
  if (input.fileExt !== undefined) entry.file_ext = input.fileExt;
  if (input.fileSize !== undefined) entry.file_size = input.fileSize;
  if (input.rowCount !== undefined) entry.row_count = input.rowCount;
  if (typeof input.dbError?.code === "string") entry.db_code = input.dbError.code;
  if (input.code === "invalid_file" && input.detail) entry.detail = input.detail.slice(0, MAX_DETAIL_LENGTH);
  return entry;
}

/** The single argument must stay a plain object: Workers Logs indexes its fields, not text. */
export function logAppEvent(input: AppEventInput): void {
  const entry = buildAppEvent(input);
  // This is the sanctioned logging point for server-side failures.
  // eslint-disable-next-line no-console
  if (entry.level === "error") console.error(entry);
  // eslint-disable-next-line no-console
  else console.warn(entry);
}

/**
 * Lower-cased extension of an uploaded file (".xlsx"), never the name. Anything that does not look
 * like a short extension (e.g. "raport.Jan Kowalski") becomes "" so a name cannot slip through.
 */
export function fileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return "";
  const extension = filename.slice(dotIndex).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(extension) ? extension : "";
}

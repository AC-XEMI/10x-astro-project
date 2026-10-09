import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAppEvent, fileExtension, logAppEvent, type AppEventInput } from "@/lib/app-events";

const USER_ID = "0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e";
const REPORT_ID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

describe("buildAppEvent", () => {
  it("derives the level from the event name", () => {
    expect(buildAppEvent({ event: "report.upload.failed" }).level).toBe("error");
    expect(buildAppEvent({ event: "report.upload.rejected" }).level).toBe("warn");
    expect(buildAppEvent({ event: "report.upload.rollback_failed" }).level).toBe("error");
    expect(buildAppEvent({ event: "report.upload.count_failed" }).level).toBe("warn");
    expect(buildAppEvent({ event: "report.delete.failed" }).level).toBe("error");
    expect(buildAppEvent({ event: "report.delete.rejected" }).level).toBe("warn");
    expect(buildAppEvent({ event: "deviation.review.failed" }).level).toBe("error");
    expect(buildAppEvent({ event: "deviation.review.rejected" }).level).toBe("warn");
  });

  it("keeps the review code and stage of a deviation review event", () => {
    expect(
      buildAppEvent({ event: "deviation.review.rejected", code: "not_found", stage: "review", userId: USER_ID }),
    ).toEqual({
      event: "deviation.review.rejected",
      level: "warn",
      code: "not_found",
      stage: "review",
      user_id: USER_ID,
    });
  });

  it("keeps the review codes for a rejected body and a missing configuration", () => {
    expect(
      buildAppEvent({
        event: "deviation.review.rejected",
        code: "invalid_request",
        stage: "validate",
        userId: USER_ID,
      }),
    ).toMatchObject({ level: "warn", code: "invalid_request", stage: "validate" });
    expect(buildAppEvent({ event: "deviation.review.failed", code: "not_configured", stage: "config" })).toMatchObject({
      level: "error",
      code: "not_configured",
      stage: "config",
    });
  });

  it("maps every allowed field to its snake_case key", () => {
    expect(
      buildAppEvent({
        event: "report.upload.failed",
        code: "upload_failed",
        stage: "insert_visits",
        userId: USER_ID,
        reportId: REPORT_ID,
        fileExt: ".csv",
        fileSize: 1234,
        rowCount: 15,
      }),
    ).toEqual({
      event: "report.upload.failed",
      level: "error",
      code: "upload_failed",
      stage: "insert_visits",
      user_id: USER_ID,
      report_id: REPORT_ID,
      file_ext: ".csv",
      file_size: 1234,
      row_count: 15,
    });
  });

  it.each(["Jan Kowalski", "not-a-uuid", "../../etc", ""])("drops a report or user id that is not a UUID: %j", (id) => {
    const entry = buildAppEvent({ event: "report.delete.rejected", userId: id, reportId: id });
    expect(entry.user_id).toBeUndefined();
    expect(entry.report_id).toBeUndefined();
  });

  it("omits fields that were not given", () => {
    expect(buildAppEvent({ event: "report.delete.rejected", code: "report_not_found" })).toEqual({
      event: "report.delete.rejected",
      level: "warn",
      code: "report_not_found",
    });
  });

  it("keeps only the code of a database error, never its message, details or hint", () => {
    const dbError = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "x"',
      details: "Key (representative_name)=(Jan Kowalski) already exists.",
      hint: "check the row",
    };
    const entry = buildAppEvent({ event: "report.upload.failed", stage: "insert_visits", dbError });
    expect(entry.db_code).toBe("23505");
    expect(JSON.stringify(entry)).not.toContain("Jan Kowalski");
    expect(JSON.stringify(entry)).not.toContain("duplicate key");
  });

  it("drops keys outside the whitelist even when a caller passes them", () => {
    const input = { event: "report.upload.rejected", filename: "Jan Kowalski.xlsx", email: "jan@x.pl" };
    const entry = buildAppEvent(input as AppEventInput);
    expect(entry).toEqual({ event: "report.upload.rejected", level: "warn" });
  });

  it("keeps the parser detail only for invalid_file", () => {
    const detail = "Wiersz 3: brak wartości w kolumnie data_wizyty.";
    expect(buildAppEvent({ event: "report.upload.rejected", code: "invalid_file", detail }).detail).toBe(detail);
    expect(buildAppEvent({ event: "report.upload.rejected", code: "too_large", detail }).detail).toBeUndefined();
  });

  it("truncates a long parser detail", () => {
    const entry = buildAppEvent({ event: "report.upload.rejected", code: "invalid_file", detail: "x".repeat(1000) });
    expect(entry.detail).toHaveLength(300);
  });
});

describe("fileExtension", () => {
  it.each([
    ["Jan Kowalski raport.XLSX", ".xlsx"],
    ["trasowki-wrzesien-2026.csv", ".csv"],
    ["archive.tar.gz", ".gz"],
  ])("returns only the lower-cased extension of %j", (filename, expected) => {
    expect(fileExtension(filename)).toBe(expected);
  });

  it.each(["report", "raport.Jan Kowalski", "raport.", "a.verylongext"])(
    "returns an empty string for %j instead of anything that may carry a name",
    (filename) => {
      expect(fileExtension(filename)).toBe("");
    },
  );
});

describe("logAppEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes error events to console.error with the entry object as the only argument", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logAppEvent({ event: "report.delete.failed", code: "delete_failed", stage: "delete" });
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]).toEqual([
      { event: "report.delete.failed", level: "error", code: "delete_failed", stage: "delete" },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("writes warn events to console.warn", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logAppEvent({ event: "report.upload.rejected", code: "too_large" });
    expect(warn.mock.calls[0]).toEqual([{ event: "report.upload.rejected", level: "warn", code: "too_large" }]);
    expect(error).not.toHaveBeenCalled();
  });
});

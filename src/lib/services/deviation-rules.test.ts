import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Tables } from "@/types";
import { detectMissingGps, detectPhoneInsteadOfVisit, detectRouteDeviations } from "@/lib/services/deviation-rules";
import { haversineDistanceKm } from "@/lib/services/geo";
import { parseReportFile, type ExtractedVisit } from "@/lib/services/report-parser";

type Visit = Tables<"visits">;

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: "v",
    report_id: "r",
    created_at: "2026-09-01T00:00:00Z",
    representative_name: "Jan",
    visit_date: "2026-09-01",
    gps_enabled: true,
    activity_type: "wizyta",
    distance_km: null,
    time_on_site_minutes: 30,
    planned_route_raw: null,
    raw_data: null,
    visited_client: null,
    visited_latitude: null,
    visited_longitude: null,
    ...overrides,
  };
}

function loadFixtureRows(filename: string): ExtractedVisit[] {
  const bytes = readFileSync(new URL(`../../../test-data/${filename}`, import.meta.url));
  const result = parseReportFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), filename);
  if ("error" in result) throw new Error(result.error);
  return result.rows;
}

const indexesWhere = <T>(items: T[], predicate: (item: T) => boolean) =>
  items.flatMap((item, index) => (predicate(item) ? [index] : []));

function detectAll(filename: string) {
  const rows = loadFixtureRows(filename);
  const routeFlags = detectRouteDeviations(rows.map((row, index) => visit({ ...row, id: String(index) })));
  return {
    rows,
    missingGps: indexesWhere(rows, (row) => detectMissingGps(row) === "missing_gps"),
    routeIndexes: routeFlags.map((flag) => Number(flag.visit_id)),
    routeDetail: (index: number) => routeFlags.find((flag) => flag.visit_id === String(index))?.detail,
    phoneFlags: rows.map((row) => detectPhoneInsteadOfVisit(row)),
  };
}

// The fixture oracle formerly asserted by scripts/verify-report-detection.mjs (0-indexed, header excluded).
// Production code is only ever called inside it(): code run while Vitest collects tests counts as
// "static" for Stryker, and its mutants are then never activated (they all "survive").
describe.each(["sample-report.csv", "sample-report.xlsx"])("detection on %s", (filename) => {
  it("flags missing_gps on rows 1, 3 and 8 of the original nine", () => {
    const { missingGps } = detectAll(filename);
    expect(missingGps.filter((index) => index < 9)).toEqual([1, 3, 8]);
  });

  it("flags route_deviation exactly on rows 4, 6 and 8 (none from rows 9-14)", () => {
    const { routeIndexes } = detectAll(filename);
    expect([...routeIndexes].sort((a, b) => a - b)).toEqual([4, 6, 8]);
  });

  it("explains each route flag", () => {
    const { routeDetail } = detectAll(filename);
    expect(routeDetail(4)).toContain("poza zaplanowaną trasą");
    expect(routeDetail(6)).toContain("nadmiarowy dystans");
    expect(routeDetail(8)).toContain("nadmiarowy dystans");
  });

  it("flags row 8 with both missing_gps and route_deviation", () => {
    const { missingGps, routeIndexes } = detectAll(filename);
    expect(missingGps).toContain(8);
    expect(routeIndexes).toContain(8);
  });

  it("leaves rows 0, 2, 5 and 7 without any missing_gps or route deviation", () => {
    const { missingGps, routeIndexes } = detectAll(filename);
    const clean = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(
      (index) => !missingGps.includes(index) && !routeIndexes.includes(index),
    );
    expect(clean).toEqual([0, 2, 5, 7]);
  });

  it("flags phone_instead_of_visit via explicit 'telefon' on rows 3 and 9", () => {
    const { rows, phoneFlags } = detectAll(filename);
    expect(phoneFlags[3]?.detail).toContain("telefon");
    expect(phoneFlags[9]?.detail).toContain("telefon");
    expect(detectMissingGps(rows[3])).toBe("missing_gps");
    expect(detectMissingGps(rows[9])).toBeNull();
  });

  it("flags phone_instead_of_visit via the heuristic on rows 10, 11 and 12", () => {
    const { rows, phoneFlags } = detectAll(filename);
    for (const index of [10, 11, 12]) {
      expect(phoneFlags[index]?.detail).toContain("brak GPS");
      expect(detectMissingGps(rows[index])).toBe("missing_gps");
    }
  });

  it("does not flag phone_instead_of_visit on rows 13 (GPS on) and 14 (15 min on site)", () => {
    const { rows, phoneFlags } = detectAll(filename);
    expect(phoneFlags[13]).toBeNull();
    expect(detectMissingGps(rows[13])).toBeNull();
    expect(phoneFlags[14]).toBeNull();
    expect(detectMissingGps(rows[14])).toBe("missing_gps");
  });
});

describe("detectMissingGps", () => {
  it("flags a visit without GPS", () => {
    expect(detectMissingGps(visit({ gps_enabled: false }))).toBe("missing_gps");
  });

  it("does not flag a visit with GPS", () => {
    expect(detectMissingGps(visit({ gps_enabled: true }))).toBeNull();
  });
});

describe("detectPhoneInsteadOfVisit", () => {
  it.each(["telefon", " Telefon ", "TELEFON"])("flags explicit %j even with GPS on and time on site", (type) => {
    expect(
      detectPhoneInsteadOfVisit(visit({ activity_type: type, gps_enabled: true, time_on_site_minutes: 60 })),
    ).toEqual({ detail: "typ aktywności: telefon" });
  });

  it("never flags an explicit 'wizyta', even without GPS and time", () => {
    expect(
      detectPhoneInsteadOfVisit(visit({ activity_type: " Wizyta ", gps_enabled: false, time_on_site_minutes: 0 })),
    ).toBeNull();
  });

  it.each([
    [null, 0],
    [null, null],
    ["", -5],
    ["spotkanie", 0],
  ])("applies the heuristic for type %j and time %j when GPS is off", (type, time) => {
    expect(
      detectPhoneInsteadOfVisit(visit({ activity_type: type, gps_enabled: false, time_on_site_minutes: time })),
    ).toEqual({
      detail: `brak GPS i czas na miejscu ${time ?? 0} min (typ aktywności: brak danych lub nierozpoznany)`,
    });
  });

  it("does not apply the heuristic when one minute was spent on site", () => {
    expect(
      detectPhoneInsteadOfVisit(visit({ activity_type: null, gps_enabled: false, time_on_site_minutes: 1 })),
    ).toBeNull();
  });

  it("does not apply the heuristic when GPS is on", () => {
    expect(
      detectPhoneInsteadOfVisit(visit({ activity_type: null, gps_enabled: true, time_on_site_minutes: 0 })),
    ).toBeNull();
  });
});

describe("detectRouteDeviations", () => {
  const A = { visited_latitude: 52.2297, visited_longitude: 21.0122 };
  const B = { visited_latitude: 52.25, visited_longitude: 21.03 };
  const lineKm = () =>
    haversineDistanceKm(
      { lat: A.visited_latitude, lng: A.visited_longitude },
      { lat: B.visited_latitude, lng: B.visited_longitude },
    );

  it("never distance-checks the first visit of the day", () => {
    expect(detectRouteDeviations([visit({ id: "1", ...A, distance_km: 999 })])).toEqual([]);
  });

  it("does not flag a distance of exactly 1.5x the straight line", () => {
    const visits = [visit({ id: "1", ...A }), visit({ id: "2", ...B, distance_km: lineKm() * 1.5 })];
    expect(detectRouteDeviations(visits)).toEqual([]);
  });

  it("flags a distance just above 1.5x the straight line, with both numbers in the detail", () => {
    const reported = Number((lineKm() * 1.5 + 0.1).toFixed(2));
    const visits = [visit({ id: "1", ...A }), visit({ id: "2", ...B, distance_km: reported })];
    expect(detectRouteDeviations(visits)).toEqual([
      { visit_id: "2", detail: `nadmiarowy dystans: zgłoszono ${reported} km, linia prosta ${lineKm().toFixed(1)} km` },
    ]);
  });

  it.each([0, null, -3])("skips the distance check when distance_km is %j", (distance) => {
    const visits = [visit({ id: "1", ...A }), visit({ id: "2", ...B, distance_km: distance })];
    expect(detectRouteDeviations(visits)).toEqual([]);
  });

  it("keeps the last known point when a visit has no coordinates", () => {
    const visits = [
      visit({ id: "1", ...A }),
      visit({ id: "2", distance_km: 1 }),
      visit({ id: "3", ...B, distance_km: 50 }),
    ];
    expect(detectRouteDeviations(visits).map((flag) => flag.visit_id)).toEqual(["3"]);
  });

  it.each([
    ["latitude", { visited_latitude: 52.24, visited_longitude: null }],
    ["longitude", { visited_latitude: null, visited_longitude: 21.02 }],
  ])("does not use a visit with only its %s as the reference point", (_, partial) => {
    const visits = [
      visit({ id: "1", ...A }),
      visit({ id: "2", ...partial, distance_km: 1 }),
      visit({ id: "3", ...B, distance_km: 50 }),
    ];
    expect(detectRouteDeviations(visits).map((flag) => flag.visit_id)).toEqual(["3"]);
  });

  it("advances the reference point after every visit with coordinates, flagged or not", () => {
    const visits = [
      visit({ id: "1", ...A }),
      visit({ id: "2", ...B, distance_km: 50 }),
      visit({ id: "3", ...B, distance_km: 1 }),
    ];
    // Visit 3 is measured from B (0 km straight line) - its 1 km is excessive only relative to B.
    expect(detectRouteDeviations(visits).map((flag) => flag.visit_id)).toEqual(["2", "3"]);
  });

  it("starts a new sequence for another representative or another day", () => {
    const visits = [
      visit({ id: "1", ...A }),
      visit({ id: "2", ...B, distance_km: 50, representative_name: "Anna" }),
      visit({ id: "3", ...B, distance_km: 50, visit_date: "2026-09-02" }),
    ];
    expect(detectRouteDeviations(visits)).toEqual([]);
  });

  it("groups visits of one representative and day even when interleaved with others", () => {
    const visits = [
      visit({ id: "1", ...A }),
      visit({ id: "2", ...B, representative_name: "Anna" }),
      visit({ id: "3", ...B, distance_km: 50 }),
    ];
    expect(detectRouteDeviations(visits).map((flag) => flag.visit_id)).toEqual(["3"]);
  });

  it.each([null, "telefon", "spotkanie", ""])("excludes visits with activity type %j", (type) => {
    const visits = [
      visit({ id: "1", ...A, activity_type: type }),
      visit({ id: "2", ...B, distance_km: 50, activity_type: type, visited_client: "X", planned_route_raw: ["Y"] }),
    ];
    expect(detectRouteDeviations(visits)).toEqual([]);
  });

  it("accepts ' Wizyta ' as a confirmed visit", () => {
    const visits = [visit({ id: "1", activity_type: " Wizyta ", visited_client: "X", planned_route_raw: ["Y"] })];
    expect(detectRouteDeviations(visits)).toEqual([{ visit_id: "1", detail: "poza zaplanowaną trasą" }]);
  });

  it("matches the planned route case-insensitively and trimmed", () => {
    const visits = [visit({ id: "1", visited_client: " klient a ", planned_route_raw: [" Klient A ", "Klient B"] })];
    expect(detectRouteDeviations(visits)).toEqual([]);
  });

  it.each([
    ["no planned route", null],
    ["an empty planned route", []],
    ["a non-array planned route", "Klient A"],
    ["a planned route with non-strings", ["Klient A", 3]],
  ])("skips the plan check for %s", (_, planned) => {
    const visits = [visit({ id: "1", visited_client: "Klient Z", planned_route_raw: planned })];
    expect(detectRouteDeviations(visits)).toEqual([]);
  });

  it.each(["  ", null])("skips the plan check when the visited client is %j", (client) => {
    expect(detectRouteDeviations([visit({ id: "1", visited_client: client, planned_route_raw: ["A"] })])).toEqual([]);
  });

  it("joins both reasons with '; '", () => {
    const visits = [
      visit({ id: "1", ...A }),
      visit({ id: "2", ...B, distance_km: 50, visited_client: "Z", planned_route_raw: ["Y"] }),
    ];
    expect(detectRouteDeviations(visits)).toEqual([
      {
        visit_id: "2",
        detail: `poza zaplanowaną trasą; nadmiarowy dystans: zgłoszono 50 km, linia prosta ${lineKm().toFixed(1)} km`,
      },
    ]);
  });
});

import type { Database, Json, Tables } from "@/types";
import type { ExtractedVisit } from "@/lib/services/report-parser";
import { haversineDistanceKm } from "@/lib/services/geo";

export type DeviationRule = Database["public"]["Enums"]["deviation_rule"];

/**
 * FR-004: a visit is flagged as a deviation when GPS was not enabled during the visit.
 * Deliberately separate from report-parser.ts so future rules (route deviation,
 * phone-instead-of-visit — out of scope here) can be added without touching parsing.
 */
export function detectMissingGps(visit: ExtractedVisit): DeviationRule | null {
  return !visit.gps_enabled ? "missing_gps" : null;
}

export interface PhoneInsteadOfVisitResult {
  detail: string;
}

/**
 * FR-010: per-visit like detectMissingGps, but with a detail string explaining the
 * reason (like detectRouteDeviations), since there are two distinct detection paths.
 * Explicit path: activity_type is exactly "telefon" — flagged regardless of GPS/time.
 * Explicit "wizyta" short-circuits to not-flagged. Anything else (null, empty, typos)
 * falls through to the heuristic: no GPS and no meaningful time on site. detectRouteDeviations
 * treats null/unrecognized activity_type the same way (excluded, not a confirmed "wizyta") —
 * kept consistent across both rules after impl-review F1.
 */
export function detectPhoneInsteadOfVisit(visit: ExtractedVisit): PhoneInsteadOfVisitResult | null {
  const activityType = visit.activity_type?.trim().toLowerCase() ?? "";

  if (activityType === "telefon") {
    return { detail: "typ aktywności: telefon" };
  }

  if (activityType === "wizyta") {
    return null;
  }

  const hasNoMeaningfulTime = visit.time_on_site_minutes === null || visit.time_on_site_minutes <= 0;
  if (!visit.gps_enabled && hasNoMeaningfulTime) {
    return {
      detail: `brak GPS i czas na miejscu ${visit.time_on_site_minutes ?? 0} min (typ aktywności: brak danych lub nierozpoznany)`,
    };
  }

  return null;
}

export interface RouteDeviationFlag {
  visit_id: string;
  detail: string;
}

/** Narrows planned_route_raw (Json | null) to string[] at runtime, without an unchecked cast. */
function asPlannedRouteList(value: Json | null): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((item): item is string => typeof item === "string") ? value : null;
}

interface Point {
  lat: number;
  lng: number;
}

function visitedPoint(visit: Tables<"visits">): Point | null {
  if (visit.visited_latitude === null || visit.visited_longitude === null) return null;
  return { lat: visit.visited_latitude, lng: visit.visited_longitude };
}

/**
 * FR-009: unlike detectMissingGps (per-visit), this rule operates on the whole report's
 * visit set — it compares consecutive visits of the same representative on the same day,
 * so it needs the full sequence rather than a single row.
 */
export function detectRouteDeviations(visits: Tables<"visits">[]): RouteDeviationFlag[] {
  const flags: RouteDeviationFlag[] = [];

  // Group by (representative_name, visit_date), preserving first-occurrence order (Map
  // iterates keys in insertion order) — this function trusts the input array's row order
  // as the visit sequence and never sorts it. Only an explicit "wizyta" is grouped — null/blank
  // and any other value (including "telefon") are dropped, matching detectPhoneInsteadOfVisit's
  // treatment of null/unrecognized activity_type as "not a confirmed visit" (kept consistent
  // across both rules after impl-review F1).
  const groups = new Map<string, Tables<"visits">[]>();
  for (const visit of visits) {
    const activityType = visit.activity_type?.trim().toLowerCase() ?? null;
    if (activityType !== "wizyta") continue;

    const key = JSON.stringify([visit.representative_name, visit.visit_date]);
    const group = groups.get(key);
    if (group) {
      group.push(visit);
    } else {
      groups.set(key, [visit]);
    }
  }

  for (const group of groups.values()) {
    // First visit of the day has no fixed starting point, so it's never distance-checked.
    let previousPoint: Point | null = null;

    for (const visit of group) {
      const details: string[] = [];

      const visitedClient = visit.visited_client?.trim() ?? "";
      const plannedRoute = asPlannedRouteList(visit.planned_route_raw);
      if (visitedClient && plannedRoute && plannedRoute.length > 0) {
        const normalizedPlanned = plannedRoute.map((item) => item.trim().toLowerCase());
        if (!normalizedPlanned.includes(visitedClient.toLowerCase())) {
          details.push("poza zaplanowaną trasą");
        }
      }

      const currentPoint = visitedPoint(visit);
      if (previousPoint && currentPoint && visit.distance_km !== null && visit.distance_km > 0) {
        const lineKm = haversineDistanceKm(previousPoint, currentPoint);
        if (visit.distance_km > lineKm * 1.5) {
          details.push(`nadmiarowy dystans: zgłoszono ${visit.distance_km} km, linia prosta ${lineKm.toFixed(1)} km`);
        }
      }

      if (details.length > 0) {
        flags.push({ visit_id: visit.id, detail: details.join("; ") });
      }

      // Always advance the reference point when this visit has full coordinates, flagged
      // or not, so the next visit in the group compares against the right previous stop.
      if (currentPoint) {
        previousPoint = currentPoint;
      }
    }
  }

  return flags;
}

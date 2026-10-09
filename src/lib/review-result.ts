/** The fields of a deviation that `POST /api/deviations/review` changes and returns. */
type ReviewedFields = "id" | "status" | "reviewed_at";

interface ReviewableVisit {
  deviations: { id: string; status: unknown; reviewed_at: string | null }[];
}

/**
 * True when some requested id is missing from the endpoint's `updated` rows - RLS hid it or it
 * was deleted meanwhile, so the change did not happen for it. Depends only on the request and
 * the response, so a caller can check it outside a React state updater.
 */
export function isPartialReview(requestedIds: string[], updated: { id: string }[]): boolean {
  const returned = new Set(updated.map((row) => row.id));
  return requestedIds.some((id) => !returned.has(id));
}

/**
 * Merges the review endpoint's response into the visits held by DeviationsList.tsx: only rows
 * present in `updated` get their `status`/`reviewed_at` replaced, everything else is kept as is.
 * Pulled out of the component (generic over the visit shape) so it is unit-testable without a DOM.
 */
export function applyReviewResult<V extends ReviewableVisit>(
  visits: V[],
  updated: Pick<V["deviations"][number], ReviewedFields>[],
): V[] {
  type Deviation = V["deviations"][number];
  const byId = new Map(updated.map((row) => [row.id, row]));

  return visits.map((visit) => ({
    ...visit,
    deviations: visit.deviations.map((deviation: Deviation): Deviation => {
      const match = byId.get(deviation.id);
      return match ? { ...deviation, status: match.status, reviewed_at: match.reviewed_at } : deviation;
    }),
  }));
}

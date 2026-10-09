/**
 * Codes answered by POST /api/deviations/review as JSON `{ error }` - unlike report errors
 * (src/lib/report-errors.ts) they never travel as `?error=` and are not shown as text.
 */
export type ReviewErrorCode = "not_configured" | "unauthorized" | "invalid_request" | "not_found" | "update_failed";

export function reviewErrorResponse(code: ReviewErrorCode, status: number): Response {
  return Response.json({ error: code }, { status });
}

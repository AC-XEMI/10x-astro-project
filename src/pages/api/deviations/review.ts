import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { logAppEvent } from "@/lib/app-events";
import { reviewErrorResponse } from "@/lib/review-errors";

export const prerender = false;

// Same check as src/pages/api/reports/[id]/delete.ts: a malformed id is rejected before any query,
// so Postgres's uuid-cast error (22P02) never reaches the client or the logs as a database failure.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    logAppEvent({ event: "deviation.review.failed", code: "not_configured", stage: "config" });
    return reviewErrorResponse("not_configured", 503);
  }

  const user = context.locals.user;
  if (!user) {
    return reviewErrorResponse("unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    logAppEvent({ event: "deviation.review.rejected", code: "invalid_request", stage: "validate", userId: user.id });
    return reviewErrorResponse("invalid_request", 400);
  }

  const { ids, status } = (body ?? {}) as { ids?: unknown; status?: unknown };

  const idsValid =
    Array.isArray(ids) && ids.length > 0 && ids.every((id) => typeof id === "string" && UUID_RE.test(id));
  const statusValid = status === "reviewed" || status === "unreviewed";

  if (!idsValid || !statusValid) {
    logAppEvent({ event: "deviation.review.rejected", code: "invalid_request", stage: "validate", userId: user.id });
    return reviewErrorResponse("invalid_request", 400);
  }

  const reviewedAt = status === "reviewed" ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("deviations")
    .update({ status, reviewed_at: reviewedAt })
    .in("id", ids)
    .select();

  if (error) {
    logAppEvent({
      event: "deviation.review.failed",
      code: "update_failed",
      stage: "review",
      userId: user.id,
      dbError: error,
    });
    return reviewErrorResponse("update_failed", 500);
  }

  // RLS hides foreign (or deleted) deviations, so an update that touched nothing means none of the
  // ids belongs to this user. A partial update still answers 200 with only the rows that changed.
  if (data.length === 0) {
    logAppEvent({ event: "deviation.review.rejected", code: "not_found", stage: "review", userId: user.id });
    return reviewErrorResponse("not_found", 404);
  }

  return Response.json({ updated: data });
};

import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { ids, status } = (body ?? {}) as { ids?: unknown; status?: unknown };

  const idsValid = Array.isArray(ids) && ids.length > 0 && ids.every((id) => typeof id === "string");
  const statusValid = status === "reviewed" || status === "unreviewed";

  if (!idsValid || !statusValid) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const reviewedAt = status === "reviewed" ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("deviations")
    .update({ status, reviewed_at: reviewedAt })
    .in("id", ids)
    .select();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ updated: data });
};

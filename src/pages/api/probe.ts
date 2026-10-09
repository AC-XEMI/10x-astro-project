// TEMPORARY inventory check (testing-data-isolation-access 3.3): never merge.
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = () => Response.json({ ok: true });

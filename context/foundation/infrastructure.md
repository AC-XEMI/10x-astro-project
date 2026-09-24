---
project: kontrola-trasowek
researched_at: 2026-09-24
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript / JavaScript
  framework: Astro 7 (SSR) + React 19 islands
  runtime: Cloudflare Workers (workerd)
---

## Recommendation

**Deploy on Cloudflare Workers.**

Cloudflare scored 5/5 Pass across the agent-friendly criteria (CLI-first via `wrangler`, fully managed/serverless, agent-readable docs via `llms.txt`, a deterministic `wrangler deploy`/`wrangler rollback` API, and multiple GA MCP servers) and is already the project's configured deployment target — the `@astrojs/cloudflare` adapter is installed and `context/foundation/tech-stack.md` names it as the starter's default. At the project's scale (10k–100k requests/month, small user base, single-region Poland usage) the Workers free tier covers the entire MVP at **$0/month**, directly satisfying the cost-minimization priority from the developer interview. The anti-bias cross-check surfaced real but manageable risks (a known `nodejs_compat` SSR bug with a documented workaround, and a stale `cloudflare-pages` hint in `tech-stack.md` that must be corrected to `cloudflare-workers`) — the developer chose to proceed with Cloudflare and absorb these into the risk register below rather than pay a migration cost to switch platforms.

## Platform Comparison

Interview constraints applied as weights: no persistent-connection requirement (no hard filter triggered), cost minimization is the top priority, no existing platform familiarity, single-region (Poland) usage is sufficient, and external Supabase handles auth/DB so co-located managed services are not needed.

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| **Cloudflare** | Pass | Pass | Pass | Pass | Pass | 5 Pass |
| **Netlify** | Pass | Pass | Pass | Pass | Pass | 5 Pass |
| Vercel | Pass | Pass | Pass | Pass | Partial (MCP beta) | 4 Pass / 1 Partial |
| Render | Partial (rollback is Dashboard/API, not a native CLI verb) | Pass | Pass | Pass | Pass | 4 Pass / 1 Partial |
| Fly.io | Partial (rollback is a manual prior-image redeploy, not a single command) | Partial (VM/container-based, more operational surface than serverless) | Pass | Partial | Pass | 2 Pass / 3 Partial |
| Railway | Partial (true rollback to an arbitrary deployment is dashboard-only) | Partial (SSR auto-detect via Railpack is unreliable; Dockerfile recommended) | Pass | Partial | Pass | 2 Pass / 3 Partial |

**Notes per platform:**

- **Cloudflare** — `wrangler deploy`/`wrangler rollback [deployment-id]`/`wrangler tail` cover the full operational loop from a terminal. Free tier: 100,000 requests/day, unlimited static asset requests, no egress charges — comfortably $0/month at this project's scale. Docs are natively markdown-negotiable (`Accept: text/markdown`) and indexed at `developers.cloudflare.com/llms.txt`. Multiple official MCP servers exist (docs, Workers bindings, observability), GA on the 2026-07-28 MCP spec. Zero migration cost: the adapter is already installed.
- **Netlify** — `netlify deploy --prod`/`netlify deploy-list` (promote for rollback)/`netlify logs` are all CLI-capable. Docs ship as `llms.txt` plus a `.md` twin of every page. Has the strongest MCP story researched: an official hosted MCP server *and* a first-party Claude connector listed in Anthropic's directory. Pricing is mid-transition (legacy flat limits vs. a new credit-based model) — likely still $0/month at this scale but flagged as needing verification at signup time. Requires migrating from `@astrojs/cloudflare` to `@astrojs/netlify`.
- **Vercel** — Technically solid (GA adapter, GA CLI, GA markdown docs) but the Hobby free tier is explicitly restricted to **non-commercial use**; this project is an internal business tool for a regional manager, which plausibly requires the Pro plan ($20/month minimum) — the most expensive option researched, directly conflicting with the cost-minimization priority. MCP is beta, not GA.
- **Render** — Full CLI deploy/log/rollback-adjacent flow, GA markdown docs, GA official MCP server, confirmed Frankfurt (EU) region. Free tier spins down after 15 minutes idle with a 30–60s cold start, which conflicts with the PRD's "result within a few seconds" NFR — the always-on Starter tier ($7/month) is the realistic cost. Requires migrating to `@astrojs/node`.
- **Fly.io** — Genuine strength on persistent connections/WebSockets (not needed by this project). Free tier is effectively gone for new accounts; realistic cost with scale-to-zero is $0–10/month but requires the app to self-exit on idle. Requires containerizing via Dockerfile and `@astrojs/node` — the largest migration effort of the six.
- **Railway** — No CLI-native rollback to an arbitrary deployment (dashboard-only), and SSR auto-detection via Railpack is unreliable enough that Railway's own guide recommends an explicit Dockerfile. No real free tier since 2023; realistic cost is $5–15+/month with uncapped usage-based billing on top — the interview's cost-sensitivity weighting penalizes this most heavily among the container platforms.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Won on a clean 5/5 Pass score, a true $0/month cost at this project's traffic level, and — decisively for a 6-week solo timeline — zero migration effort since the adapter is already wired up and the starter's own CLAUDE.md documents Cloudflare local dev conventions (`.dev.vars`, `astro:env/server`). Single-region edge presence is not required by the interview answers, but Cloudflare's global network doesn't cost anything extra either.

#### 2. Netlify

Scored equally on the criteria matrix and has the strongest researched MCP/agent-integration story of any candidate (official hosted MCP server + first-party Claude connector). Held back from the top spot only by requiring an adapter migration and by a pricing model that's mid-transition as of the research date — a real but secondary gap versus Cloudflare's already-configured, fully-free path.

#### 3. Render

Chosen as the third slot over Vercel specifically because of the interview's cost-minimization priority: Render's $7/month always-on Starter tier is unambiguous, while Vercel's free Hobby tier carries a non-commercial-use restriction that this project (an internal business tool) would likely violate, pushing it to a $20/month Pro plan — the most expensive option researched. Render requires an adapter migration to `@astrojs/node` and loses Cloudflare's edge/global reach, which the interview confirmed is not needed for this single-region use case.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. `context/foundation/tech-stack.md` still records `deployment_target: cloudflare-pages`, but Cloudflare now recommends Workers for new SSR projects and `@astrojs/cloudflare` has dropped Pages SSR support — this hint is stale and must be corrected before deploy, or tooling that reads it will scaffold the wrong `wrangler` configuration.
2. A known bug ([withastro/astro#8520](https://github.com/withastro/astro/issues/8520)) where `nodejs_compat` combined with Astro SSR can trigger workerd's "process v2" emulation, causing SSR routes to silently return `[object Object]` with HTTP 200 — a silent failure mode that a status-code-only health check would not catch.
3. The project's existing `astro:env/server` pattern (used for `SUPABASE_URL`/`SUPABASE_KEY`) interacts with Workers' `Astro.locals.runtime.env` binding model — `process.env` is not available the same way it is on Node-based platforms, so future code that assumes standard Node env access could fail silently at the edge.
4. The free tier's 10ms CPU-time-per-invocation cap (30s on the $5/month paid plan) is a real constraint for FR-009's route/distance-deviation logic — if that rule ever grows beyond simple threshold math into real route calculation or geocoding, the CPU ceiling becomes a hard constraint that a Node-based platform would not impose.
5. `wrangler dev`/workerd emulates the Workers runtime but has historically diverged from production edge behavior on some Node-compatibility edge cases — a solo developer working after-hours with a fixed 6-week budget is exposed to "works locally, breaks in production" debugging cycles that eat into limited available time.

### Pre-Mortem — How This Could Fail

The team deployed Kontrola Trasówek on Cloudflare Workers for the MVP. Six months later, the decision turned out to be a slow-burning disaster. The solo developer had copied the wrangler config from the starter template without noticing `tech-stack.md` still referenced "cloudflare-pages" — a stale hint from bootstrapping — and lost the first deploy attempt debugging why the Pages-style command failed silently. Once live, the route-deviation rule (FR-009) grew from a simple distance threshold into something needing real geocoding lookups, and CPU-time limits on the Workers free tier started truncating requests under moderate load — but only for reports with many stops, an edge case invisible in testing with small sample files. A routine dependency bump then pulled in a package that touched the filesystem at module init — fine locally under Node, but failing under workerd's sandbox in production with a cryptic error, costing a full evening to trace back to a compatibility-flag mismatch. Nobody had budgeted post-MVP time to audit which Node-compatibility edge cases the growing codebase had started depending on, and by the time it mattered, migrating off Workers felt riskier than living with the workarounds.

### Unknown Unknowns

- Workers has no traditional persistent filesystem or long-running process model — any future dependency (an image library, PDF export for FR-008) that assumes Node's `fs` module or spawns child processes needs explicit compatibility verification before it's added, not after it breaks in production.
- The free tier's "unlimited requests" framing hides a per-invocation CPU-time metric, not a wall-clock one — a request spent mostly waiting on Supabase I/O barely touches the CPU budget, making cost projections based on request count alone easy to get wrong.
- `wrangler tail` automatically switches into a sampling mode under higher traffic — "watch the logs live" stops being a complete picture once the app has any real load, which could hide the exact request that triggered a bug mid-debugging session.
- Because `@astrojs/cloudflare` dropped Pages support and Cloudflare is actively folding Pages into Workers, any tutorial, Stack Overflow answer, or AI-generated advice trained on pre-shift docs — including this project's own `tech-stack.md` hint — will actively mislead.
- Durable Objects only reached GA in July 2026 — if the project ever needs lightweight stateful coordination (e.g., a background job queue for large report files, beyond the "few seconds" NFR), the "managed and serverless" story on Cloudflare gets meaningfully more complex than the pure request/response model this MVP currently needs.

**Decision**: proceed with Cloudflare Workers. Risks recorded below.

## Operational Story

- **Preview deploys**: `wrangler versions upload` creates a preview version with a unique URL without shifting production traffic; `wrangler deploy` (or `wrangler versions deploy`) promotes a version to 100% traffic. No branch-based preview URLs are auto-generated the way Pages did — CI would need to call `wrangler versions upload` explicitly per PR if preview links become a workflow requirement later (out of scope for MVP).
- **Secrets**: `SUPABASE_URL`/`SUPABASE_KEY` are declared `optional: true` in the `astro:env` schema (per CLAUDE.md). Local dev secrets live in `.dev.vars` (gitignored). Production secrets are set via `wrangler secret put <NAME>` and stored encrypted in Cloudflare's platform, readable only by the account/token that deployed them — never committed to the repo or `wrangler.jsonc`.
- **Rollback**: `wrangler rollback [deployment-id]` reverts to a prior deployment in one command; `wrangler deployments list` shows the history to pick a target. No database migrations exist yet (Supabase Auth's built-in `auth.users` table only), so rollback carries no data-migration caveat today — this changes once the first custom table/migration ships.
- **Approval**: Routine deploys (`wrangler deploy`) and rollbacks may run unattended by an agent under CI's existing `auto-deploy-on-merge` flow. Human-only: creating/rotating the Cloudflare API token itself, changing billing tier, and any DNS/domain routing change — consistent with the project's minimal-permissions posture.
- **Logs**: `wrangler tail` streams live logs (`--status error` to filter, `--format json` for structured output); note it auto-samples under high traffic, so a targeted `--status error` filter is more reliable than an unfiltered tail during a live incident.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| `tech-stack.md` still names `cloudflare-pages`, causing future tooling or agents to scaffold Pages-style config instead of Workers | Devil's advocate | M | M | Update `context/foundation/tech-stack.md`'s `deployment_target` hint to `cloudflare-workers` before the first deploy |
| `nodejs_compat` + Astro SSR can silently return `[object Object]` with HTTP 200 instead of erroring | Devil's advocate | L | H | Add `disable_nodejs_process_v2` alongside `nodejs_compat` in `wrangler.jsonc`; add a smoke-test assertion on response body content, not just status code (extend `scripts/smoke.mjs`) |
| Future code assumes standard Node `process.env` access instead of Workers' `Astro.locals.runtime.env` binding model | Pre-mortem | M | M | Document the `astro:env`/runtime-bindings pattern in CLAUDE.md as new server-only env vars are added |
| CPU-time cap (10ms free / 30s paid) constrains future route-deviation logic (FR-009) if it grows beyond threshold math | Devil's advocate | L | M | Keep distance/route calculations as simple threshold math in MVP scope; if geocoding or route-optimization is added post-MVP, re-evaluate CPU budget or move that specific computation off-Worker |
| `wrangler dev` (workerd emulation) diverges from production behavior for some Node-compat edge cases | Devil's advocate | L | M | Treat any new dependency touching filesystem/child-process APIs as a compatibility risk; verify with a real `wrangler deploy` to a preview version before merging, not just local `wrangler dev` |
| `wrangler tail` auto-samples under real traffic, hiding the exact failing request during high load | Unknown unknowns | L | L | Use `wrangler tail --status error` for targeted debugging instead of an unfiltered tail once the app has meaningful traffic |
| Pages→Workers consolidation makes older tutorials, Stack Overflow answers, and AI-trained knowledge actively misleading | Unknown unknowns | M | L | When following any Cloudflare/Astro deployment guidance, cross-check the date and confirm it targets Workers (not Pages) before applying |
| Durable Objects (only GA since July 2026) would be needed if background/async report processing is ever required beyond the "few seconds" NFR | Unknown unknowns | L | M | Out of MVP scope; revisit only if FR scope expands to large-file async processing |

## Getting Started

1. Confirm the adapter is installed and current: `npx astro info` should show `@astrojs/cloudflare` — it's already added per the starter scaffold.
2. Correct the stale hint: update `deployment_target: cloudflare-pages` to `deployment_target: cloudflare-workers` in `context/foundation/tech-stack.md`.
3. Authenticate wrangler: `npx wrangler login` (or set a scoped `CLOUDFLARE_API_TOKEN` for CI — Workers-only permission, no DNS/billing).
4. Add `disable_nodejs_process_v2` next to the existing `nodejs_compat` compatibility flag in `wrangler.jsonc` to avoid the known SSR silent-failure bug.
5. Set production secrets: `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`, then deploy with `npx wrangler deploy`.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (the existing `.github/workflows/ci.yml` auto-deploy-on-merge flow is assumed as-is)
- Production-scale architecture (multi-region, HA, DR)

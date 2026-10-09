import type { TestProject } from "vitest/node";
import type { AccountRole, TestAccount } from "./helpers/context";
import { anonClient } from "./helpers/db";
import { BASE_URL, getLocalSupabaseEnv, type LocalSupabaseEnv } from "./helpers/env";
import { HttpClient, signInViaApp } from "./helpers/http";

// Satisfies password_requirements = "letters_digits" in supabase/config.toml.
const PASSWORD = "Int-Test-Passw0rd!";

// One signUp per account for the whole run: sign-ins and sign-ups share a limit of 30 per 5 minutes
// per IP (supabase/config.toml), and the smoke test in the same CI job already spends some of it.
async function createAccount(env: LocalSupabaseEnv, role: AccountRole, runId: string): Promise<TestAccount> {
  const email = `${role}-${runId}@example.com`;
  const client = anonClient(env);
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD });
  if (error?.status === 429) {
    throw new Error(
      "Local Supabase auth rate limit hit (sign_in_sign_ups = 30 per 5 minutes per IP, supabase/config.toml). " +
        "One run spends about 10 - wait a few minutes or restart Supabase before re-running.",
      { cause: error },
    );
  }
  if (error) throw new Error(`signUp failed for ${email}: ${error.message}`);

  let session = data.session;
  if (!session) {
    // Fallback in case local email confirmation is required after all.
    const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signIn.error) throw new Error(`signIn failed for ${email}: ${signIn.error.message}`);
    session = signIn.data.session;
  }
  return { email, password: PASSWORD, userId: session.user.id, accessToken: session.access_token };
}

async function assertAppReachable(): Promise<void> {
  try {
    await fetch(BASE_URL, { redirect: "manual" });
  } catch (err) {
    throw new Error(`App is not reachable at BASE_URL=${BASE_URL} - start it (npm run dev / npm run preview) first.`, {
      cause: err,
    });
  }
}

export default async function setup(project: TestProject): Promise<void> {
  const env = getLocalSupabaseEnv();
  await assertAppReachable();

  const runId = Date.now().toString(36);
  const accounts: Record<AccountRole, TestAccount> = {
    a: await createAccount(env, "a", runId),
    b: await createAccount(env, "b", runId),
    c: await createAccount(env, "c", runId),
  };

  // A signed up in the local Supabase only, so the app accepts it only when it talks to the same
  // database. Fail loudly instead of letting every denial test pass against the wrong backend.
  const signIn = await signInViaApp(new HttpClient(BASE_URL), accounts.a);
  if (signIn.status !== 302 || signIn.location !== "/reports") {
    throw new Error(
      `The app at BASE_URL=${BASE_URL} is not connected to the local Supabase (${env.apiUrl}): ` +
        `signing in a freshly created account returned ${signIn.status} ${signIn.location ?? "(no Location)"}. ` +
        "Point SUPABASE_URL/SUPABASE_KEY in .env/.dev.vars at `npx supabase status -o env` and restart the app.",
    );
  }

  project.provide("baseUrl", BASE_URL);
  project.provide("supabase", env);
  project.provide("accounts", accounts);
}

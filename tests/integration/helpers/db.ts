import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";
import type { LocalSupabaseEnv } from "./env";
import type { TestAccount } from "./context";

export type DbClient = SupabaseClient<Database>;

// No storage to persist to and no long-lived session to refresh in a test run.
const authOptions = { persistSession: false, autoRefreshToken: false };

export function anonClient(env: LocalSupabaseEnv): DbClient {
  return createClient<Database>(env.apiUrl, env.anonKey, { auth: authOptions });
}

export function clientAs(env: LocalSupabaseEnv, user: TestAccount): DbClient {
  return createClient<Database>(env.apiUrl, env.anonKey, {
    auth: authOptions,
    global: { headers: { Authorization: `Bearer ${user.accessToken}` } },
  });
}

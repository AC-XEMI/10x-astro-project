import { inject } from "vitest";
import type { LocalSupabaseEnv } from "./env";

export type AccountRole = "a" | "b" | "c";

export interface TestAccount {
  email: string;
  password: string;
  userId: string;
  // From signUp in globalSetup, so tests get a database client without spending another sign-in.
  accessToken: string;
}

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string;
    supabase: LocalSupabaseEnv;
    // A and B for isolation; C only for the sign-out test (signOut() without scope is global).
    accounts: Record<AccountRole, TestAccount>;
  }
}

export function account(role: AccountRole): TestAccount {
  return inject("accounts")[role];
}

export function baseUrl(): string {
  return inject("baseUrl");
}

export function supabaseEnv(): LocalSupabaseEnv {
  return inject("supabase");
}

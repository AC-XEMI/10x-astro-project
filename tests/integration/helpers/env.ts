import { execSync } from "node:child_process";

export interface LocalSupabaseEnv {
  apiUrl: string;
  anonKey: string;
}

export const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";

// Read from the local CLI, never from .env/.dev.vars: those point at the cloud project in this repo.
// The service-role key is used only in globalSetup (to create pre-confirmed accounts) and is never
// provided to the tests, which must act as anon/authenticated users.
export function getLocalSupabaseEnv(): LocalSupabaseEnv & { serviceRoleKey: string } {
  let output: string;
  try {
    output = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    throw new Error(
      `Could not read local Supabase status - is \`npx supabase start\` running?\n${String(
        (err as { stderr?: unknown }).stderr ?? err,
      )}`,
      { cause: err },
    );
  }

  const apiUrl = /^API_URL="?([^"\r\n]*)"?/m.exec(output)?.[1];
  const anonKey = /^ANON_KEY="?([^"\r\n]*)"?/m.exec(output)?.[1];
  const serviceRoleKey = /^SERVICE_ROLE_KEY="?([^"\r\n]*)"?/m.exec(output)?.[1];
  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      `Could not parse API_URL/ANON_KEY/SERVICE_ROLE_KEY from \`npx supabase status -o env\`:\n${output}`,
    );
  }
  return { apiUrl, anonKey, serviceRoleKey };
}

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicEnv } from "./env";

export function createBrowserSupabase() {
  const env = supabasePublicEnv();
  if (!env) {
    throw new Error("SUPABASE_ENV_MISSING");
  }
  return createBrowserClient(env.url, env.anonKey);
}

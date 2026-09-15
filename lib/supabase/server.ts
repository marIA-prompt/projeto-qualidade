import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicEnv } from "./env";

export async function createClient() {
  const env = supabasePublicEnv();
  if (!env) {
    throw new Error("SUPABASE_ENV_MISSING");
  }
  const cookieStore = await cookies();
  return createServerClient(
    env.url,
    env.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* set from Server Component — proxy refreshes the session */
          }
        },
      },
    },
  );
}

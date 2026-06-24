import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// Privileged Supabase client for server-side use only. Bypasses RLS.
// Never import this from a "use client" component.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin credentials: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Evita que el fetch cache del App Router sirva datos viejos (p. ej. un
      // producto que se quitó del portal seguía apareciendo).
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

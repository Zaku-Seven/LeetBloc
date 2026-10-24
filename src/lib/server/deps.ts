import { createClient } from "@supabase/supabase-js";
import { supabaseVerifier, type Verifier } from "./auth";
import type { Database } from "./database.types";
import { env } from "./env";
import { gemmaGenerator } from "./gemma-generator";
import { leetCodeClient } from "./leetcode";
import type { Deps } from "./service";
import { SupabaseStore } from "./store-supabase";

export interface ServerDeps extends Deps {
  verifier: Verifier;
}

let deps: ServerDeps | undefined;

export function getDeps(): ServerDeps {
  if (!deps) {
    const e = env();
    const client = createClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    deps = {
      store: new SupabaseStore(client),
      leetcode: leetCodeClient(),
      trayIdSecret: e.TRAY_ID_SECRET,
      verifier: supabaseVerifier(client),
      // Without a key, the starter problems still work and new links answer 501.
      ...(e.GEMINI_API_KEY ? { generator: gemmaGenerator() } : {}),
    };
  }
  return deps;
}

// Tests swap in a memory store and fake clients.
export function setDepsForTesting(next: ServerDeps | undefined) {
  deps = next;
}

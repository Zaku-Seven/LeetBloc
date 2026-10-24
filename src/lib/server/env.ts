import { z } from "zod";

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Signs tray block ids. Any long random string; changing it changes every tray id.
  TRAY_ID_SECRET: z.string().min(32, "TRAY_ID_SECRET must be at least 32 characters"),
  // Optional: generation for new problems is off without it.
  GEMINI_API_KEY: z
    .string()
    .optional()
    .transform((k) => (k && k !== "your-api-key-here" ? k : undefined)),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

// Read on first use, so a missing variable fails the request that needs it
// with a clear message instead of failing the build.
export function env(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Missing or invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")} (${i.message})`).join(", ")}`);
    }
    cached = parsed.data;
  }
  return cached;
}

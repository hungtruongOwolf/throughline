import { z } from "zod";

/** Spec 5.6: nothing else is stored in journey memory. */
export const MEMORY_KEYS = [
  "preferred_language",
  "mobility",
  "preferred_time_of_day",
  "preferred_entrance",
  "companion_present",
  "transport_need",
] as const;
export const MemoryKey = z.enum(MEMORY_KEYS);
export type MemoryKey = z.infer<typeof MemoryKey>;

/** Allowed values per key. Memory holds short administrative tokens, never free text. */
const MEMORY_VALUES: Record<MemoryKey, z.ZodType<string>> = {
  preferred_language: z.enum(["en", "es"]),
  mobility: z.enum(["walking", "wheelchair"]),
  preferred_time_of_day: z.enum(["morning", "afternoon"]),
  preferred_entrance: z.enum(["main_entrance", "garage_skybridge", "cancer_center_lobby"]),
  companion_present: z.enum(["true", "false"]),
  transport_need: z.enum(["none", "ride_needed", "wheelchair_van"]),
};

export const Memory = z
  .record(z.string(), z.string())
  .superRefine((value, ctx) => {
    for (const [key, raw] of Object.entries(value)) {
      const parsedKey = MemoryKey.safeParse(key);
      if (!parsedKey.success) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `memory key not allowlisted: ${key}`,
        });
        continue;
      }
      if (!MEMORY_VALUES[parsedKey.data].safeParse(raw).success) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `memory value not allowed for ${key}`,
        });
      }
    }
  })
  .transform((value) => value as Partial<Record<MemoryKey, string>>);
export type Memory = z.infer<typeof Memory>;

export const MemoryUpdate = z
  .object({ key: MemoryKey, value: z.string() })
  .superRefine((u, ctx) => {
    if (!MEMORY_VALUES[u.key].safeParse(u.value).success) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `memory value not allowed for ${u.key}`,
      });
    }
  });
export type MemoryUpdate = z.infer<typeof MemoryUpdate>;

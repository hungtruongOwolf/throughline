import type { Capability } from "@throughline/shared";

export type TierMode = "auto" | "cloud_only" | "private_only";
export type Tier = "cloud" | "private";

/** Capabilities whose payload carries free text or documents by construction (spec 4.4). */
const PRIVATE_CAPABILITIES = new Set<Capability>([
  "referral.extract",
  "referral.clarify",
  "reply.handle",
  "summary.draft",
  "prior_auth.draft",
]);

/** Identifier patterns: DOB, phone, MRN, member id, street address, email. */
const IDENTIFIERS: RegExp[] = [
  /\b(19|20)\d\d-\d\d-\d\d\b/, // ISO date of birth
  /\b\d{1,2}\/\d{1,2}\/(19|20)?\d\d\b/, // US date
  /\+?1?[ -.]?\(?\d{3}\)?[ -.]?\d{3}[ -.]?\d{4}\b/, // phone
  /\+1[ -.]?\d{3}[ -.]?\d{4}\b/, // the synthetic +1 555 01xx format
  /\bMRN[:# ]*\w+/i,
  /\b(member|subscriber)\s*(id|#)[:# ]*\w+/i,
  /\b\d{2,5}\s+\w+\s+(st|street|ave|avenue|rd|road|blvd|lane|ln|dr|drive)\b/i,
  /\b[\w.+-]+@[\w-]+\.\w+/,
  /\bdata:image\//, // document or card images
];

/**
 * routeModelCall (spec 4.4): identifiers or free text → private tier; anonymous operational
 * payloads → cloud tier. TIER_MODE forces either. All data is synthetic: this demonstrates the
 * control, it is not a compliance claim.
 */
export function routeModelCall(probe: string, capability: Capability, mode: TierMode): Tier {
  if (mode === "cloud_only") return "cloud";
  if (mode === "private_only") return "private";
  if (PRIVATE_CAPABILITIES.has(capability)) return "private";
  return IDENTIFIERS.some((p) => p.test(probe)) ? "private" : "cloud";
}

/**
 * Calls the private tier and falls back to cloud when it is cold or down (spec 10.5: Modal
 * endpoint cold → cloud after a timeout). The result says whether the fallback was used.
 */
export async function withTierFallback<T>(
  tier: Tier,
  call: (tier: Tier) => Promise<T>,
  timeoutMs: number,
): Promise<{ value: T; tier: Tier; used_fallback: boolean }> {
  if (tier === "cloud") return { value: await call("cloud"), tier, used_fallback: false };
  try {
    const value = await Promise.race([
      call("private"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("private tier timeout")), timeoutMs),
      ),
    ]);
    return { value, tier: "private", used_fallback: false };
  } catch {
    return { value: await call("cloud"), tier: "cloud", used_fallback: true };
  }
}

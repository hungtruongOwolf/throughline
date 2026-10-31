import type { Sign } from "./schema";

/** Lowercase, strip accents, arrows, and punctuation; collapse spaces. */
export function normalizeSignText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = row[0] as number;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = row[j] as number;
      row[j] = Math.min(up + 1, (row[j - 1] as number) + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return row[b.length] as number;
}

/** Tokens that tell otherwise identical signs apart: anything with a digit, or a single letter. */
function identifierTokens(normalized: string): string {
  return normalized
    .split(" ")
    .filter((t) => /\d/.test(t) || t.length === 1)
    .sort()
    .join(" ");
}

/**
 * Similarity in [0, 1]. Identifier tokens ("2", "a", "2b", "level 3") must match exactly,
 * because OCR-level fuzziness must never turn Clinic 2A into Clinic 2B. The rest is a
 * Levenshtein ratio on the normalized text.
 */
export function signSimilarity(a: string, b: string): number {
  const na = normalizeSignText(a);
  const nb = normalizeSignText(b);
  if (identifierTokens(na) !== identifierTokens(nb)) return 0;
  const longest = Math.max(na.length, nb.length);
  if (longest === 0) return 0;
  return 1 - levenshtein(na, nb) / longest;
}

export const SIGN_MATCH_THRESHOLD = 0.85;

export function signText(sign: Sign): string {
  return sign.lines.join(" ");
}

export interface LocalizeResult {
  node_id: string | "unknown";
  confidence: number;
  sign_id?: string;
}

/** Maps model-extracted sign text to a registry node (spec 3.4). Misses return "unknown". */
export function localize(extracted: string, signs: readonly Sign[]): LocalizeResult {
  let best: LocalizeResult = { node_id: "unknown", confidence: 0 };
  for (const sign of signs) {
    // A single-line match scores slightly below a full-sign match, so "Elevator A" picks the
    // L1 sign that says exactly that over the L2 sign whose first line is "Elevator A".
    const full = signSimilarity(extracted, signText(sign));
    const partial = Math.max(...sign.lines.map((l) => signSimilarity(extracted, l))) * 0.95;
    const score = Math.max(full, partial);
    if (score > best.confidence)
      best = { node_id: sign.node_id, confidence: score, sign_id: sign.sign_id };
  }
  return best.confidence >= SIGN_MATCH_THRESHOLD
    ? best
    : { node_id: "unknown", confidence: best.confidence };
}

/**
 * Clinical-content classifier, deterministic layer (spec 6.2): keyword and pattern lists in
 * English and Spanish. D3-6 completes the red-team fixture and adds the Spark yes/no check for
 * borderline text.
 */
export type ClinicalCategory = "symptom" | "medication" | "result" | "diagnosis";

const PATTERNS: Record<ClinicalCategory, RegExp[]> = {
  symptom: [
    /\b(pain|hurts?|dizzy|nause\w*|vomit\w*|fever|bleed\w*|short(ness)? of breath|rash|swollen|chest)\b/i,
    /\b(duele|dolor|mareo|mareada?|náusea|vómito|fiebre|sangr\w*|falta de aire|pecho|hinchad[oa])\b/i,
  ],
  medication: [
    /\b(ibuprofen|tylenol|acetaminophen|aspirin|dose|dosage|mg|pills?|medications?|medicines?)\b/i,
    /\b(pastillas?|dosis|medicamentos?|medicinas?)\b/i,
  ],
  result: [
    /\b((white|red) (blood )?(cell )?count|platelets?|hemoglobin|counts? (too )?(low|high)|chemo)\b/i,
    /\b(results? (mean|normal|bad)|is (this|it) normal|my (labs?|counts?|levels?))\b/i,
    /\b(es normal|mis resultados|mis análisis)\b/i,
  ],
  diagnosis: [
    /\b(do i have|is it cancer|diagnos\w*|stage \d|tumor)\b/i,
    /\b(tengo cáncer|diagnóstico|tumor)\b/i,
  ],
};

export function classifyClinical(text: string): ClinicalCategory | undefined {
  for (const [category, patterns] of Object.entries(PATTERNS) as [ClinicalCategory, RegExp[]][]) {
    if (patterns.some((p) => p.test(text))) return category;
  }
  return undefined;
}

/**
 * Clinical-content classifier, deterministic layer (spec 6.2): keyword and pattern lists in
 * English and Spanish. Text the lists miss still meets Spark: the messenger's reply model can
 * answer `clinical`, which also routes to a nurse (agents/messenger).
 */
export type ClinicalCategory = "symptom" | "medication" | "result" | "diagnosis";

const PATTERNS: Record<ClinicalCategory, RegExp[]> = {
  symptom: [
    /\b(pain|hurts?|dizzy|nause\w*|vomit\w*|threw up|fever|temperature of|bleed\w*|short(ness)? of breath|trouble breathing|rash|swollen|chest)\b/i,
    /\b(cough\w*|headaches?|bruis\w*|sores?|diarrh?ea|tired|weak|hair (fall|loss)|side effects?|safe to (drive|eat|drink|work))\b/i,
    /\b(duele|dolor|mareo|mareada?|náusea|vómito|vomit\w*|fiebre|sangr\w*|falta de aire|respirar|pecho|hinch\w*|tos|cansad[oa]|diarrea|pelo|efectos secundarios|aguja)\b/i,
  ],
  medication: [
    /\b(ibuprofen|tylenol|acetaminophen|aspirin|dose|dosage|mg|pills?|medications?|medicines?|insulin|blood thinners?)\b/i,
    /\b(pastillas?|dosis|medicamentos?|medicinas?|insulina)\b/i,
  ],
  result: [
    /\b((white|red) (blood )?(cell )?count|platelets?|hemoglobin|counts? (too )?(low|high)|chemo)\b/i,
    /\b(results? (mean|normal|bad)|is (this|it|a \w+) normal|my (labs?|counts?|levels?|results)|(potassium|sodium|sugar|glucose) levels?|(scan|ct|tests?) (show|found))\b/i,
    /\b(es normal|mis resultados|mis análisis|salió mal)\b/i,
  ],
  diagnosis: [
    /\b(do i have|cancer(?! cent)|diagnos\w*|stage|tumor)\b/i,
    // \b does not see accented letters as word characters, so the Spanish list goes without it.
    /(tengo cáncer|cáncer|diagnóstico|tumor|etapa)/i,
  ],
};

export function classifyClinical(text: string): ClinicalCategory | undefined {
  for (const [category, patterns] of Object.entries(PATTERNS) as [ClinicalCategory, RegExp[]][]) {
    if (patterns.some((p) => p.test(text))) return category;
  }
  return undefined;
}

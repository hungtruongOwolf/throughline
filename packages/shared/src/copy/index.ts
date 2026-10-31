import type { Language } from "../common";
import { en, type CopyKey } from "./en";
import { es } from "./es";

export { en, es };
export type { CopyKey };
export { PATIENT_SURFACE_PREFIXES } from "./en";

const TABLES: Record<Language, Record<CopyKey, string>> = { en, es };

/** Looks up a copy string and fills `{name}` placeholders. */
export function t(
  lang: Language,
  key: CopyKey,
  vars: Record<string, string | number> = {},
): string {
  return TABLES[lang][key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars[name] ?? `{${name}}`),
  );
}

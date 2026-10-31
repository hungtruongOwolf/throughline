/**
 * Spec 11.1: the app refuses to boot with SYNTHETIC_ONLY=false outside tests.
 * Call at the top of every entry point.
 */
export function assertSyntheticOnly(env: Record<string, string | undefined>): void {
  const isTest = env.NODE_ENV === "test" || env.VITEST === "true";
  if (env.SYNTHETIC_ONLY === "false" && !isTest) {
    throw new Error(
      "Throughline runs on synthetic data only. Refusing to start with SYNTHETIC_ONLY=false.",
    );
  }
}

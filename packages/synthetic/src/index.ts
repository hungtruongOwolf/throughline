export * from "./rng";
export * from "./people";
export * from "./clinical";
export * from "./slots";

import { generatePatients, generateProviders } from "./people";
import { generateSlots } from "./slots";

/** Everything `pnpm seed` writes, from one seed. */
export function generateWorld(seed: number) {
  return {
    seed,
    patients: generatePatients(seed),
    providers: generateProviders(),
    slots: generateSlots(seed),
  };
}
export * from "./day";

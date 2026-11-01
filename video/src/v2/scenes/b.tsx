import type { Group } from "../types";
import { Drop, Maria1, Maria2, Title } from "./b-dark";
import { Gate1, Handoff1, Handoff2, Handoff3, Idea } from "./b-paper";

/** Builder B: Maria's setup in the dark, the drop and product reveal, then the before-the-visit handoffs on paper. */
export const scenes: Group = {
  "MARIA-1": { C: Maria1, dark: true },
  "MARIA-2": { C: Maria2, dark: true },
  DROP: { C: Drop, dark: true },
  TITLE: { C: Title, dark: true },
  IDEA: { C: Idea, dark: false },
  "HANDOFF-1": { C: Handoff1, dark: false },
  "HANDOFF-2": { C: Handoff2, dark: false },
  "HANDOFF-3": { C: Handoff3, dark: false },
  "GATE-1": { C: Gate1, dark: false },
};

import type { Campus, CampusNode } from "@throughline/hospital";
import campusJson from "@throughline/hospital/campus.json";

/**
 * The campus file, imported directly so client bundles skip the hospital package's renderers.
 * The runtime and the engine validate it; here it is read-only display data.
 */
export const campus = campusJson as unknown as Campus;

const NODES = new Map(campus.nodes.map((n) => [n.id, n]));

export function node(id: string): CampusNode | undefined {
  return NODES.get(id);
}

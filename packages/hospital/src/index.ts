import campusJson from "../campus.json";
import { Campus } from "./schema";

/** The campus, validated once at import. The renderer and the engine read the same file. */
export const campus: Campus = Campus.parse(campusJson);

export * from "./schema";
export * from "./graph";
export * from "./localizer";
export * from "./signage";
export * from "./ticket";
export * from "./zones";

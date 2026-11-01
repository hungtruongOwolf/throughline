import type { ComponentType } from "react";

/** Every scene gets its length, the length of its voice line, and where it sits in the film. */
export type SceneProps = { dur: number; vo: number; start: number; text: string };
export type Scene = { C: ComponentType<SceneProps>; dark?: boolean };
export type Group = Record<string, Scene>;

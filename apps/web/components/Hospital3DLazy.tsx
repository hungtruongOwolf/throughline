"use client";

import dynamic from "next/dynamic";

/** The WebGL model loads in the browser only; a calm placeholder holds its space meanwhile. */
export const Hospital3D = dynamic(() => import("./Hospital3D"), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-[6px] bg-rule/30" aria-hidden />,
});

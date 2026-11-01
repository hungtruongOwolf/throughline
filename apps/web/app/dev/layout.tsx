import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// Decided per request, so the end-to-end run can turn the pages on with DEV_PAGES=1.
export const dynamic = "force-dynamic";

/** Developer pages (engine probe, component sheet) are not part of the deployed product. */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.DEV_PAGES !== "1") notFound();
  return children;
}

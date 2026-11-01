import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/** Developer pages (engine probe, component sheet) are not part of the deployed product. */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}

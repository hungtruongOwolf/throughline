"use client";

import type { ReactNode } from "react";
import { StreamProvider, UserProvider } from "../lib/session";
import { ToastProvider } from "./ui";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <StreamProvider>
        <ToastProvider>{children}</ToastProvider>
      </StreamProvider>
    </UserProvider>
  );
}

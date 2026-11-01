"use client";

import type { ReactNode } from "react";
import { HospitalProvider, StreamProvider, UserProvider } from "../lib/session";
import { ToastProvider } from "./ui";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <HospitalProvider>
      <UserProvider>
        <StreamProvider>
          <ToastProvider>{children}</ToastProvider>
        </StreamProvider>
      </UserProvider>
    </HospitalProvider>
  );
}

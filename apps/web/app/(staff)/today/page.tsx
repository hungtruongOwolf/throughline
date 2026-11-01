"use client";

import { CommandCenter } from "../../ops/command-center";
import { markStep } from "../../../components/shell";
import { useUser } from "../../../lib/session";

/** The visit-day command center (section 4.6), signed in as whoever is at the desk. */
export default function TodayPage() {
  const { user } = useUser();
  return (
    <CommandCenter by={user?.name ?? "Operations lead"} onApproved={() => markStep("floor")} />
  );
}

import { redirect } from "next/navigation";

/** The command center lives in the staff workspace now. */
export default function OpsPage() {
  redirect("/today");
}

import { redirect } from "next/navigation";

/** The old Journey Control page; Maria's journey is now one story. */
export default function JourneyPage() {
  redirect("/story");
}

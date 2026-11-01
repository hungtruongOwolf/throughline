import { redirect } from "next/navigation";

/** Old Journey Control links open the patient's record. */
export default async function JourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/patients/${id}`);
}

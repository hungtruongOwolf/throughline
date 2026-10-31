import { PatientPortal } from "./patient-portal";

export const metadata = { title: "Your care plan, Halden Medical Center" };

export default async function PatientPage({ params }: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await params;
  return <PatientPortal journeyId={journeyId} />;
}

import { PatientPhone } from "./patient-phone";

export const metadata = { title: "Your visit · Halden Medical Center" };

export default async function PatientPage({ params }: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await params;
  return <PatientPhone journeyId={journeyId} />;
}

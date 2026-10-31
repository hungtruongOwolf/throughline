import { JourneyControl } from "./journey-control";

export const metadata = { title: "Journey Control · Throughline" };

export default async function JourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JourneyControl journeyId={id} />;
}

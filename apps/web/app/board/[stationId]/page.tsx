import { StationBoard } from "./station-board";

export const metadata = { title: "Station board · Halden Medical Center" };

export default async function BoardPage({ params }: { params: Promise<{ stationId: string }> }) {
  const { stationId } = await params;
  return <StationBoard stationId={stationId} />;
}

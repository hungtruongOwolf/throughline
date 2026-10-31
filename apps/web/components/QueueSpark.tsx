/** A 30-minute queue sparkline. Decorative: the number beside it carries the meaning. */
export function QueueSpark({
  counts,
  width = 220,
  height = 48,
  className = "stroke-current",
}: {
  counts: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (counts.length < 2) return <svg aria-hidden width={width} height={height} />;
  const max = Math.max(1, ...counts);
  const step = width / (counts.length - 1);
  const points = counts
    .map((c, i) => `${(i * step).toFixed(1)},${(height - 4 - (c / max) * (height - 8)).toFixed(1)}`)
    .join(" ");
  return (
    <svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" strokeWidth={3} className={className} />
    </svg>
  );
}

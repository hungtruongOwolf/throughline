/** Predicted wait over the day for one station: baseline (dashed) and with the what-if. */
export function WaitCurve({
  baseline,
  scenario,
  nowFraction,
  width = 520,
  height = 90,
}: {
  baseline: number[];
  scenario: number[];
  nowFraction: number;
  width?: number;
  height?: number;
}) {
  const max = Math.max(5, ...baseline, ...scenario);
  const line = (values: number[]) =>
    values
      .map(
        (v, i) =>
          `${((i / Math.max(1, values.length - 1)) * width).toFixed(1)},${(height - 4 - (v / max) * (height - 8)).toFixed(1)}`,
      )
      .join(" ");
  return (
    <svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <line
        x1={nowFraction * width}
        x2={nowFraction * width}
        y1={0}
        y2={height}
        className="stroke-ink-soft"
        strokeWidth={1}
      />
      <polyline
        points={line(baseline)}
        fill="none"
        strokeWidth={2}
        strokeDasharray="5 4"
        className="stroke-ink-soft"
      />
      <polyline points={line(scenario)} fill="none" strokeWidth={3} className="stroke-line" />
    </svg>
  );
}

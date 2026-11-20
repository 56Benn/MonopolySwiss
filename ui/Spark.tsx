export function Spark({
  values,
  color = "#7fcdb1",
}: {
  values: number[];
  color?: string;
}) {
  const data = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0],
    low = Math.min(...data),
    span = Math.max(...data) - low;
  return (
    <svg className="spark" viewBox="0 0 120 30" aria-label="Wertverlauf" role="img">
      <polyline
        points={data
          .map(
            (value, index) =>
              `${(index * 118) / (data.length - 1) + 1},${span ? 27 - ((value - low) / span) * 24 : 15}`,
          )
          .join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
    </svg>
  );
}

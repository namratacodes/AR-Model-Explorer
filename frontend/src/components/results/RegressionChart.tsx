import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Section } from "./Section";

const fmt = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 0 });
const fmt2 = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function RegressionChart({
  points,
  residualMean,
  residualStd,
}: {
  points: { actual: number; predicted: number }[];
  residualMean: number | null | undefined;
  residualStd: number | null | undefined;
}) {
  const values = points.flatMap((p) => [p.actual, p.predicted]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.05 || 1;
  const low = min - pad;
  const high = max + pad;

  return (
    <Section
      title="Actual vs predicted"
      description="Each dot is one test row. The closer a dot is to the dashed line, the better the prediction."
    >
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 24, bottom: 24, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="actual"
              name="Actual"
              domain={[low, high]}
              tickFormatter={(v: number) => fmt(v)}
              label={{ value: "Actual", position: "insideBottom", offset: -12 }}
            />
            <YAxis
              type="number"
              dataKey="predicted"
              name="Predicted"
              domain={[low, high]}
              tickFormatter={(v: number) => fmt(v)}
              label={{ value: "Predicted", angle: -90, position: "insideLeft", offset: -4 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(value) => (typeof value === "number" ? fmt2(value) : String(value))}
            />
            <ReferenceLine
              segment={[
                { x: low, y: low },
                { x: high, y: high },
              ]}
              stroke="#94a3b8"
              strokeDasharray="4 4"
            />
            <Scatter data={points} fill="#4f46e5" fillOpacity={0.6} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {typeof residualMean === "number" && typeof residualStd === "number" && (
        <p className="mt-3 text-sm text-slate-600">
          Average error (actual minus predicted): <b>{fmt2(residualMean)}</b>, typical spread{" "}
          <b>±{fmt2(residualStd)}</b>. An average near 0 means it doesn't lean too high or too low.
        </p>
      )}
    </Section>
  );
}
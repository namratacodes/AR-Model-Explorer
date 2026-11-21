import {
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Section } from "./Section";

export interface CurveSeries {
  label: string;
  score: number;
  x: number[];
  y: number[];
}

const COLORS = [
  "#4f46e5", "#059669", "#d97706", "#dc2626", "#0891b2",
  "#7c3aed", "#db2777", "#65a30d", "#475569", "#ea580c",
];

export function CurveChart({
  title,
  description,
  xLabel,
  yLabel,
  scoreLabel,
  series,
  diagonal = false,
  truncated = false,
}: {
  title: string;
  description: string;
  xLabel: string;
  yLabel: string;
  scoreLabel: string;
  series: CurveSeries[];
  diagonal?: boolean;
  truncated?: boolean;
}) {
  return (
    <Section title={title} description={description}>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 24, bottom: 24, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              domain={[0, 1]}
              label={{ value: xLabel, position: "insideBottom", offset: -12 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              domain={[0, 1]}
              label={{ value: yLabel, angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(value) => (typeof value === "number" ? value.toFixed(3) : String(value))}
            />
            <Legend verticalAlign="top" />
            {diagonal && (
              <ReferenceLine
                segment={[
                  { x: 0, y: 0 },
                  { x: 1, y: 1 },
                ]}
                stroke="#94a3b8"
                strokeDasharray="4 4"
              />
            )}
            {series.map((item, index) => (
              <Scatter
                key={item.label}
                name={`${item.label} (${scoreLabel} ${item.score.toFixed(3)})`}
                data={item.x.map((x, i) => ({ x, y: item.y[i] }))}
                line={{ stroke: COLORS[index % COLORS.length], strokeWidth: 2 }}
                lineType="joint"
                shape={() => <g />}
                fill={COLORS[index % COLORS.length]}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {truncated && (
        <p className="mt-3 text-xs text-slate-500">Only the most common classes are drawn.</p>
      )}
    </Section>
  );
}
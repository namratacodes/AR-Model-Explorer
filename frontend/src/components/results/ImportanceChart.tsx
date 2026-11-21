import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ImportanceItem } from "../../resultTypes";
import { Section } from "./Section";

const DESCRIPTIONS: Record<string, string> = {
  shap: "How strongly each column pushes the model's predictions on average (SHAP). A longer bar means the model leans on that column more.",
  permutation:
    "How much the score drops when a column's values are shuffled. A longer bar means the model depends on that column more.",
};

export function ImportanceChart({ method, items }: { method: string; items: ImportanceItem[] }) {
  const data = items.slice(0, 12).map((item) => ({
    feature: item.feature,
    value: item.importance,
    label: `${item.relative_percent.toFixed(1)}%`,
  }));

  return (
    <Section
      title="Which columns matter most"
      description={DESCRIPTIONS[method] ?? "Importance of each column."}
    >
      <div style={{ height: Math.max(200, data.length * 34 + 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 56, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" />
            <YAxis type="category" dataKey="feature" width={130} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => (typeof value === "number" ? value.toFixed(4) : String(value))} />
            <Bar dataKey="value" fill="#4f46e5" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="label" position="right" style={{ fontSize: 12, fill: "#475569" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        The percentage is each column's share of the total importance. Columns that look like IDs or
        are constant were left out of training automatically.
      </p>
    </Section>
  );
}
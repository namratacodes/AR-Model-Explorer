import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Section } from "../components/results/Section";
import { Alert, Spinner } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { TASK_LABELS, formatScore } from "../lib/metrics";
import type { ScoreFormat } from "../lib/metrics";
import type { CompareResult } from "../shareTypes";

function settingsText(settings: Record<string, unknown>): string {
  const entries = Object.entries(settings);
  if (entries.length === 0) return "Default settings";
  return entries.map(([key, value]) => `${key}: ${value === null ? "unlimited" : String(value)}`).join(" · ");
}

export function ComparePage() {
  const { projectId = "" } = useParams();
  const [params] = useSearchParams();
  const idsKey = params.get("runs") ?? "";

  const [data, setData] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .compareRuns(projectId, idsKey.split(",").filter(Boolean))
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, idsKey]);

  const backLink = (
    <Link to={`/projects/${projectId}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
      ← Back to the project
    </Link>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-indigo-600">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Alert>{error ?? "Nothing to compare."}</Alert>
        {backLink}
      </div>
    );
  }

  const activeMetric = data.metrics.find((m) => m.key === chartMetric) ?? data.metrics[0];

  const chartData = activeMetric
    ? data.runs.map((run, index) => {
        const value = run.scores[activeMetric.key];
        return {
          name: `${index + 1}. ${run.model_label}`,
          value: typeof value === "number" ? value : 0,
          display:
            typeof value === "number" ? formatScore(value, activeMetric.format as ScoreFormat) : "–",
          best: data.best[activeMetric.key] === run.run_id,
        };
      })
    : [];

  return (
    <div className="space-y-6">
      {backLink}

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Compare runs</h1>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
            {TASK_LABELS[data.task] ?? data.task}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          ★ marks the best run for each score. A ↓ means a lower number is better.
        </p>
      </div>

      {!data.same_dataset && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          These runs used different datasets, so their scores are not directly comparable.
        </p>
      )}

      <Section title="Scores side by side">
        <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Run</th>
                {data.metrics.map((metric) => (
                  <th key={metric.key} className="whitespace-nowrap px-4 py-3 font-medium">
                    {metric.label}
                    {metric.lower_is_better && " ↓"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.runs.map((run, index) => (
                <tr key={run.run_id} className="align-top">
                  <td className="min-w-64 px-4 py-3">
                    <p className="font-medium">
                      {index + 1}. {run.model_label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{settingsText(run.hyperparameters)}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatDateTime(run.created_at)}
                      {run.duration_s !== null && ` · ${run.duration_s.toFixed(1)}s`}
                    </p>
                    <Link
                      to={`/projects/${projectId}/runs/${run.run_id}`}
                      className="mt-1 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      View results
                    </Link>
                  </td>
                  {data.metrics.map((metric) => {
                    const value = run.scores[metric.key];
                    const isBest = data.best[metric.key] === run.run_id;
                    return (
                      <td
                        key={metric.key}
                        className={`whitespace-nowrap px-4 py-3 ${isBest ? "bg-emerald-50 font-semibold" : ""}`}
                      >
                        {typeof value === "number"
                          ? formatScore(value, metric.format as ScoreFormat)
                          : "–"}
                        {isBest && (
                          <span title="Best in this column" className="ml-1.5 text-amber-500">
                            ★
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {activeMetric && (
        <Section title="Chart">
          <div className="max-w-xs">
            <label htmlFor="chart-metric" className="mb-1.5 block text-sm font-medium text-slate-700">
              Score to chart
            </label>
            <select
              id="chart-metric"
              value={activeMetric.key}
              onChange={(e) => setChartMetric(e.target.value)}
              className="block w-full rounded-lg border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
            >
              {data.metrics.map((metric) => (
                <option key={metric.key} value={metric.key}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 24, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                <YAxis />
                <Tooltip
                  formatter={(value) => (typeof value === "number" ? value.toFixed(4) : String(value))}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {chartData.map((item) => (
                    <Cell key={item.name} fill={item.best ? "#059669" : "#4f46e5"} />
                  ))}
                  <LabelList dataKey="display" position="top" style={{ fontSize: 12, fill: "#475569" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            The green bar is the best run for this score.{" "}
            {activeMetric.lower_is_better ? "Lower is better here." : "Higher is better here."}
          </p>
        </Section>
      )}
    </div>
  );
}
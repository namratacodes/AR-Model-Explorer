import { Card } from "../ui";
import { formatBytes, formatDateTime, formatNumber } from "../../lib/format";
import type { Dataset } from "../../types";

export function DatasetOverview({ dataset }: { dataset: Dataset }) {
  const profile = dataset.profile;
  const stats: [string, string][] = [
    ["Rows", formatNumber(profile.n_rows)],
    ["Columns", formatNumber(profile.n_cols)],
    ["Numeric features", String(profile.numeric_features.length)],
    ["Categorical features", String(profile.categorical_features.length)],
    ["Missing values", formatNumber(profile.missing_total)],
    ["Duplicate rows", formatNumber(profile.duplicate_rows)],
  ];

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Dataset overview</h2>
        <p className="text-sm text-slate-500">
          {dataset.original_filename} · {formatBytes(dataset.file_size_bytes)} · uploaded{" "}
          {formatDateTime(dataset.created_at)}
        </p>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 px-4 py-3">
            <dt className="text-xs font-medium text-slate-500">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 max-h-96 overflow-auto rounded-xl ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Column</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Missing</th>
              <th className="px-4 py-2.5 font-medium">Unique</th>
              <th className="px-4 py-2.5 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {profile.columns.map((column) => (
              <tr key={column.name}>
                <td className="whitespace-nowrap px-4 py-2.5 font-medium">{column.name}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {column.kind}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                  {column.missing === 0 ? "–" : `${formatNumber(column.missing)} (${column.missing_pct}%)`}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{formatNumber(column.unique)}</td>
                <td className="px-4 py-2.5 text-xs text-amber-700">{column.warnings.join(" ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
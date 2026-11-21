import { useState } from "react";
import { Alert, Button, Card } from "../ui";
import { api, errorMessage } from "../../lib/api";
import { formatNumber } from "../../lib/format";
import type { Dataset } from "../../types";

export function TargetCard({
  dataset,
  onSaved,
}: {
  dataset: Dataset;
  onSaved: (dataset: Dataset) => void;
}) {
  const [selected, setSelected] = useState(dataset.target_column ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const changed = selected !== (dataset.target_column ?? "");
  const info = dataset.target_info;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.setTarget(dataset.id, selected === "" ? null : selected);
      onSaved(updated);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">Target column</h2>
      <p className="mt-1 text-sm text-slate-600">
        The column you want the model to predict. Leave it empty for clustering or PCA.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="target-select" className="mb-1.5 block text-sm font-medium text-slate-700">
            Predict this column
          </label>
          <select
            id="target-select"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setSaved(false);
            }}
            className="block w-full rounded-lg border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
          >
            <option value="">None (unsupervised)</option>
            {dataset.profile.columns.map((column) => (
              <option key={column.name} value={column.name}>
                {column.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => void save()} loading={saving} disabled={!changed}>
          Save target
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {error && <Alert>{error}</Alert>}
        {saved && <Alert tone="success">Target saved.</Alert>}
      </div>

      {info ? (
        <div className="mt-5 rounded-xl bg-slate-50 p-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
              Suggested: {info.suggested_task}
            </span>
            <span className="text-slate-600">{formatNumber(info.n_unique)} distinct values</span>
            {info.missing > 0 && (
              <span className="text-slate-600">{formatNumber(info.missing)} rows missing a target</span>
            )}
          </div>

          {info.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-700">
              {info.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          {info.class_distribution && (
            <div className="mt-4 space-y-2.5">
              {info.class_distribution.slice(0, 10).map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between gap-4 text-xs text-slate-600">
                    <span className="truncate font-medium">{item.label}</span>
                    <span className="shrink-0">
                      {formatNumber(item.count)} · {item.percent}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
              {info.class_distribution.length > 10 && (
                <p className="text-xs text-slate-500">
                  + {info.class_distribution.length - 10} more classes
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-500">
          {dataset.target_column ? "" : "No target selected."}
        </p>
      )}
    </Card>
  );
}
import { useState } from "react";
import { StatusBadge } from "../StatusBadge";
import { Alert, Button, Card, Spinner } from "../ui";
import { formatDateTime, formatNumber } from "../../lib/format";
import { HEADLINE, SCORE_INFO, TASK_LABELS, formatScore } from "../../lib/metrics";
import type { ModelInfo, TrainingRun } from "../../types";

function RunDetails({ run }: { run: TrainingRun }) {
  const scores = run.metrics?.scores ?? {};
  const scoreEntries = Object.entries(SCORE_INFO).filter(([key]) => typeof scores[key] === "number");
  const summary = run.summary;

  const dataFacts: [string, string][] = [];
  if (summary) {
    const add = (label: string, value: number | undefined) => {
      if (value !== undefined) dataFacts.push([label, formatNumber(value)]);
    };
    add("Rows used", summary.n_rows_used);
    add("Training rows", summary.n_train);
    add("Test rows", summary.n_test);
    add("Duplicate rows removed", summary.dropped_duplicates);
    add("Rows without a target removed", summary.dropped_missing_target);
    add("Features after encoding", summary.n_features_after_encoding);
  }

  return (
    <div className="mt-4 space-y-5 rounded-xl bg-slate-50 p-5">
      {scoreEntries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Scores</h3>
          <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {scoreEntries.map(([key, info]) => (
              <div key={key} className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-slate-200">
                <dt className="text-xs text-slate-500">{info.label}</dt>
                <dd className="mt-0.5 font-semibold">{formatScore(scores[key] as number, info.format)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {dataFacts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Data used</h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
            {dataFacts.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {summary?.excluded_target && (
            <p className="mt-2 text-sm text-slate-600">
              Target left out of the features: {summary.excluded_target}
            </p>
          )}
          {summary?.dropped_columns && summary.dropped_columns.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-amber-700">
              {summary.dropped_columns.map((item) => (
                <li key={item.column}>
                  Column "{item.column}" was not used: {item.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold">Settings</h3>
        <p className="mt-2 text-sm text-slate-600">
          {Object.entries(run.hyperparameters).length === 0
            ? "Default settings"
            : Object.entries(run.hyperparameters)
                .map(([key, value]) => `${key}: ${value === null ? "unlimited" : String(value)}`)
                .join(" · ")}
          {" · "}seed {run.random_state}
          {summary?.n_test !== undefined && ` · test share ${Math.round(run.test_size * 100)}%`}
        </p>
      </div>
    </div>
  );
}

function RunRow({
  run,
  label,
  open,
  onToggle,
}: {
  run: TrainingRun;
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  const headline = HEADLINE[run.task_type];
  const headlineValue = run.metrics?.scores?.[headline?.key ?? ""];
  const active = run.status === "queued" || run.status === "running";

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{label}</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {TASK_LABELS[run.task_type] ?? run.task_type}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {formatDateTime(run.created_at)}
            {run.duration_s !== null && ` · ${run.duration_s.toFixed(1)}s`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {typeof headlineValue === "number" && headline && (
            <span className="text-sm">
              <span className="text-slate-500">{headline.label} </span>
              <span className="font-semibold">{formatScore(headlineValue, headline.format)}</span>
            </span>
          )}
          {active && <Spinner className="h-4 w-4 text-sky-600" />}
          <StatusBadge status={run.status} />
          {run.status === "completed" && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              {open ? "Hide details" : "Details"}
            </button>
          )}
        </div>
      </div>

      {run.status === "failed" && run.error_message && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{run.error_message}</p>
      )}

      {open && run.status === "completed" && <RunDetails run={run} />}
    </li>
  );
}

export function RunsCard({
  runs,
  models,
  loading,
  error,
  onRetry,
}: {
  runs: TrainingRun[];
  models: ModelInfo[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void | Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const labels = new Map((models ?? []).map((m) => [m.key, m.label] as const));
  const active = runs.some((run) => run.status === "queued" || run.status === "running");

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Run history</h2>
        {active && <p className="text-xs text-sky-700">Updating automatically…</p>}
      </div>

      {loading && runs.length === 0 && (
        <div className="flex justify-center py-8 text-indigo-600">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      {error && (
        <div className="mt-4 space-y-3">
          <Alert>{error}</Alert>
          <Button variant="secondary" onClick={() => void onRetry()}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
          <p className="font-medium">No training runs yet</p>
          <p className="mt-1 text-sm text-slate-500">Train your first model above.</p>
        </div>
      )}

      {runs.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100">
          {runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              label={labels.get(run.model_type) ?? run.model_type}
              open={openId === run.id}
              onToggle={() => setOpenId(openId === run.id ? null : run.id)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
import { useState } from "react";
import type { FormEvent } from "react";
import { Alert, Button, Card, Spinner, TextField } from "../ui";
import { api, errorMessage } from "../../lib/api";
import { TASK_LABELS } from "../../lib/metrics";
import type { Dataset, ModelInfo } from "../../types";

const TASK_ORDER = ["classification", "regression", "clustering", "dimensionality_reduction"];

const SELECT_CLASS =
  "block w-full rounded-lg border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600";

// Turns what the user typed into the settings object the backend expects.
// Empty fields are left out, so the backend's default applies.
function buildHyperparameters(model: ModelInfo, values: Record<string, string>) {
  const result: Record<string, unknown> = {};
  for (const [name, spec] of Object.entries(model.params)) {
    const raw = values[name];
    if (raw === undefined || raw === "") continue;

    if (spec.type === "choice") {
      result[name] = raw;
      continue;
    }

    const number = Number(raw);
    if (!Number.isFinite(number)) throw new Error(`"${name}" must be a number.`);
    if (spec.type === "int" && !Number.isInteger(number)) {
      throw new Error(`"${name}" must be a whole number.`);
    }
    if ((spec.min !== null && number < spec.min) || (spec.max !== null && number > spec.max)) {
      throw new Error(`"${name}" must be between ${spec.min} and ${spec.max}.`);
    }
    result[name] = number;
  }
  return result;
}

export function TrainingCard({
  projectId,
  dataset,
  models,
  modelsError,
  onStarted,
}: {
  projectId: string;
  dataset: Dataset;
  models: ModelInfo[] | null;
  modelsError: string | null;
  onStarted: () => void | Promise<void>;
}) {
  // Start on the kind of model that fits the chosen target.
  const defaultTask = dataset.target_column
    ? dataset.target_info?.suggested_task === "regression"
      ? "regression"
      : "classification"
    : "clustering";

  const [task, setTask] = useState(defaultTask);
  const [modelKey, setModelKey] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [testSizePct, setTestSizePct] = useState("20");
  const [seed, setSeed] = useState("42");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = models ?? [];
  const tasks = TASK_ORDER.filter((t) => available.some((m) => m.task === t));
  const groupModels = available.filter((m) => m.task === task);
  const model = groupModels.find((m) => m.key === modelKey) ?? groupModels[0];

  const supervised = task === "classification" || task === "regression";
  const missingTarget = supervised && !dataset.target_column;
  const suggested = dataset.target_info?.suggested_task;
  const mismatch = supervised && !!dataset.target_column && !!suggested && suggested !== task;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!model) return;

    let hyperparameters: Record<string, unknown>;
    let testSize = 0.2;
    let randomState: number;
    try {
      hyperparameters = buildHyperparameters(model, values);
      if (supervised) {
        const pct = Number(testSizePct);
        if (!Number.isFinite(pct) || pct < 10 || pct > 50) {
          throw new Error("Test set size must be between 10 and 50 percent.");
        }
        testSize = pct / 100;
      }
      randomState = Number(seed);
      if (!Number.isInteger(randomState) || randomState < 0) {
        throw new Error("Random seed must be a whole number, 0 or higher.");
      }
    } catch (err) {
      setError(errorMessage(err));
      return;
    }

    setSubmitting(true);
    try {
      await api.startTraining(projectId, {
        dataset_id: dataset.id,
        model_type: model.key,
        hyperparameters,
        test_size: testSize,
        random_state: randomState,
      });
      await onStarted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">Train a model</h2>
      <p className="mt-1 text-sm text-slate-600">
        Training runs in the background. You can start several models and compare them below.
      </p>

      {modelsError && (
        <div className="mt-4">
          <Alert>{modelsError}</Alert>
        </div>
      )}

      {!models && !modelsError && (
        <div className="flex justify-center py-8 text-indigo-600">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      {models && (
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-5">
          <div
            className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1"
            role="group"
            aria-label="Kind of model"
          >
            {tasks.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={t === task}
                onClick={() => {
                  setTask(t);
                  setModelKey("");
                  setValues({});
                  setError(null);
                }}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  t === task ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {TASK_LABELS[t] ?? t}
              </button>
            ))}
          </div>

          {missingTarget && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This kind of model needs a target column. Choose one in the target card above, or pick
              Clustering or PCA.
            </p>
          )}
          {mismatch && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your target looks like a {suggested} problem. You can still train this, but the run
              may fail or give poor results.
            </p>
          )}
          {!supervised && dataset.target_column && (
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No target is needed here. The selected target ({dataset.target_column}) is left out
              of the features.
            </p>
          )}

          {!model ? (
            <p className="text-sm text-slate-500">No models are available for this kind of task.</p>
          ) : (
            <>
              <div className="max-w-md">
                <label htmlFor="model-select" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Algorithm
                </label>
                <select
                  id="model-select"
                  value={model.key}
                  onChange={(e) => {
                    setModelKey(e.target.value);
                    setValues({});
                  }}
                  className={SELECT_CLASS}
                >
                  {groupModels.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {Object.keys(model.params).length === 0 ? (
                <p className="text-sm text-slate-500">This model has no settings to adjust.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {Object.entries(model.params).map(([name, spec]) => {
                    const label = name.replace(/_/g, " ");
                    const hint = [
                      spec.description,
                      spec.min !== null && spec.max !== null ? `Range ${spec.min} to ${spec.max}.` : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    if (spec.type === "choice") {
                      return (
                        <div key={name}>
                          <label
                            htmlFor={`param-${name}`}
                            className="mb-1.5 block text-sm font-medium capitalize text-slate-700"
                          >
                            {label}
                          </label>
                          <select
                            id={`param-${name}`}
                            value={values[name] ?? String(spec.default)}
                            onChange={(e) => setValues({ ...values, [name]: e.target.value })}
                            className={SELECT_CLASS}
                          >
                            {(spec.choices ?? []).map((choice) => (
                              <option key={choice} value={choice}>
                                {choice}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
                        </div>
                      );
                    }

                    return (
                      <TextField
                        key={name}
                        id={`param-${name}`}
                        label={label.charAt(0).toUpperCase() + label.slice(1)}
                        type="number"
                        step={spec.type === "int" ? 1 : "any"}
                        min={spec.min ?? undefined}
                        max={spec.max ?? undefined}
                        placeholder={spec.default === null ? "unlimited" : String(spec.default)}
                        hint={hint}
                        value={values[name] ?? ""}
                        onChange={(e) => setValues({ ...values, [name]: e.target.value })}
                      />
                    );
                  })}
                </div>
              )}

              <details className="rounded-xl bg-slate-50 px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">
                  Advanced settings
                </summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {supervised && (
                    <TextField
                      label="Test set size (%)"
                      type="number"
                      min={10}
                      max={50}
                      step={5}
                      hint="The share of rows held back to measure the model fairly."
                      value={testSizePct}
                      onChange={(e) => setTestSizePct(e.target.value)}
                    />
                  )}
                  <TextField
                    label="Random seed"
                    type="number"
                    min={0}
                    step={1}
                    hint="Keeping the same seed makes results repeatable."
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                  />
                </div>
              </details>
            </>
          )}

          {error && <Alert>{error}</Alert>}

          <Button type="submit" loading={submitting} disabled={!model || missingTarget}>
            Train model
          </Button>
        </form>
      )}
    </Card>
  );
}
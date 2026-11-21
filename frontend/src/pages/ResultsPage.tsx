import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfusionMatrix } from "../components/results/ConfusionMatrix";
import { CurveChart } from "../components/results/CurveChart";
import { ImportanceChart } from "../components/results/ImportanceChart";
import { LocalExplanations } from "../components/results/LocalExplanations";
import { MetricCards } from "../components/results/MetricCards";
import { RegressionChart } from "../components/results/RegressionChart";
import { Section } from "../components/results/Section";
import { ClusterSection, PcaSection } from "../components/results/UnsupervisedSections";
import { Alert, Spinner } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { TASK_LABELS } from "../lib/metrics";
import type { VisualizationData } from "../resultTypes";

export function ResultsPage() {
  const { projectId = "", runId = "" } = useParams();

  const [data, setData] = useState<VisualizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPermutation, setShowPermutation] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getVisualizations(projectId, runId)
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
  }, [projectId, runId]);

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
        <Alert>{error ?? "Results not found."}</Alert>
        <Link to={`/projects/${projectId}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          ← Back to the project
        </Link>
      </div>
    );
  }

  const { run } = data;
  const task = run.task;
  const metrics = data.metrics ?? {};
  const scores = metrics.scores ?? {};
  const explanations = data.explanations;
  const supervised = task === "classification" || task === "regression";

  const mainImportance = explanations?.global_importance ?? null;
  const permutation = explanations?.permutation_importance ?? null;
  const canToggle = mainImportance?.method === "shap" && permutation !== null;
  const shownImportance = canToggle && showPermutation ? permutation : mainImportance;

  const settings = Object.entries(run.hyperparameters)
    .map(([key, value]) => `${key}: ${value === null ? "unlimited" : String(value)}`)
    .join(" · ");

  return (
    <div className="space-y-6">
      <Link to={`/projects/${data.project.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
        ← {data.project.name}
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{run.model_label} results</h1>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
            {TASK_LABELS[task] ?? task}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Trained {formatDateTime(run.created_at)}
          {run.duration_s !== null && ` in ${run.duration_s.toFixed(1)}s`}
          {settings && ` · ${settings}`}
        </p>
      </div>

      <MetricCards task={task} scores={scores} />

      {task === "classification" && metrics.confusion_matrix && (
        <ConfusionMatrix labels={metrics.confusion_matrix.labels} matrix={metrics.confusion_matrix.matrix} />
      )}

      {task === "regression" && metrics.predictions_sample && metrics.predictions_sample.length > 0 && (
        <RegressionChart
          points={metrics.predictions_sample}
          residualMean={metrics.residuals?.mean}
          residualStd={metrics.residuals?.std}
        />
      )}

      {supervised && shownImportance && (
        <div className="space-y-3">
          {canToggle && (
            <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Importance method">
              {[
                { value: false, label: "SHAP" },
                { value: true, label: "Permutation" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={showPermutation === option.value}
                  onClick={() => setShowPermutation(option.value)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                    showPermutation === option.value
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <ImportanceChart method={shownImportance.method} items={shownImportance.items} />
        </div>
      )}

      {task === "classification" && metrics.roc_curve && (
        <CurveChart
          title="ROC curve"
          description="How well the model separates the classes at every possible cut-off. The higher the curve above the dashed diagonal (pure guessing), the better. AUC is the area under the curve."
          xLabel="False positive rate"
          yLabel="True positive rate"
          scoreLabel="AUC"
          diagonal
          truncated={metrics.roc_curve.truncated}
          series={metrics.roc_curve.curves.map((c) => ({ label: c.label, score: c.auc, x: c.fpr, y: c.tpr }))}
        />
      )}

      {task === "classification" && metrics.pr_curve && (
        <CurveChart
          title="Precision-Recall curve"
          description="The trade-off between being right when you predict a class (precision) and finding all real cases (recall). Especially useful when classes are unbalanced."
          xLabel="Recall"
          yLabel="Precision"
          scoreLabel="AP"
          truncated={metrics.pr_curve.truncated}
          series={metrics.pr_curve.curves.map((c) => ({
            label: c.label,
            score: c.average_precision,
            x: c.recall,
            y: c.precision,
          }))}
        />
      )}

      {supervised && explanations?.local_explanations && (
        <LocalExplanations local={explanations.local_explanations} />
      )}

      {supervised && explanations && !explanations.availability.local && (
        <Section title="Why this prediction?">
          <p className="text-sm text-slate-600">
            Per-prediction explanations are not available for this run.{" "}
            {explanations.availability.shap.reason ?? ""}
          </p>
        </Section>
      )}

      {supervised && !explanations && (
        <Section title="Explanations">
          <p className="text-sm text-slate-600">
            No explanations were stored for this run. Train it again to get feature importance and
            per-prediction explanations.
          </p>
        </Section>
      )}

      {task === "clustering" && <ClusterSection metrics={metrics} />}
      {task === "dimensionality_reduction" && <PcaSection metrics={metrics} />}

      {explanations && explanations.notes.length > 0 && (
        <details className="rounded-xl bg-white px-5 py-4 text-sm text-slate-600 ring-1 ring-slate-200">
          <summary className="cursor-pointer font-medium text-slate-700">How to read the explanations</summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            {explanations.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
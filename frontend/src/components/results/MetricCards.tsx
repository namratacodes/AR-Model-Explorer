import { SCORE_INFO, formatScore } from "../../lib/metrics";
import { Section } from "./Section";

const CARD_KEYS: Record<string, string[]> = {
  classification: ["accuracy", "precision", "recall", "f1", "roc_auc", "balanced_accuracy"],
  regression: ["r2", "rmse", "mae", "mse"],
  clustering: ["silhouette", "n_clusters", "davies_bouldin", "noise_fraction"],
  dimensionality_reduction: ["total_explained_variance", "n_components"],
};

const DESCRIPTIONS: Record<string, string> = {
  accuracy: "Out of 100 unseen rows, how many it got right.",
  precision: "When it predicts a class, how often it is correct.",
  recall: "Of the real cases of a class, how many it found.",
  f1: "One number balancing precision and recall.",
  roc_auc: "How well it ranks the right answers higher (1.0 is perfect, 0.5 is guessing).",
  balanced_accuracy: "Accuracy that treats every class as equally important.",
  r2: "Share of the ups and downs it explains (1.0 is perfect, 0 is no better than the average).",
  rmse: "Typical size of its mistakes, in the units of what you predict.",
  mae: "Average size of its mistakes, in the same units.",
  mse: "Average squared mistake (punishes big errors).",
  silhouette: "How clearly separated the clusters are (closer to 1 is better).",
  n_clusters: "Groups found in the data.",
  davies_bouldin: "How much clusters overlap (lower is better).",
  noise_fraction: "Share of rows that fit no cluster.",
  total_explained_variance: "How much of the data's variation the kept axes capture.",
  n_components: "Number of summary axes kept.",
};

function overfitMessage(task: string, scores: Record<string, number | null>): string | null {
  if (task === "classification") {
    const train = scores.train_accuracy;
    const test = scores.accuracy;
    if (typeof train === "number" && typeof test === "number" && train - test > 0.1) {
      return `The model scores ${(train * 100).toFixed(0)}% on the data it learned from but only ${(test * 100).toFixed(0)}% on unseen test data. That gap usually means overfitting: it memorized instead of learning. Try a simpler model (lower depth, smaller C) or more data.`;
    }
  }
  if (task === "regression") {
    const train = scores.train_r2;
    const test = scores.r2;
    if (typeof train === "number" && typeof test === "number" && train - test > 0.15) {
      return `The model explains ${(train * 100).toFixed(0)}% of the variation in its training data but only ${(test * 100).toFixed(0)}% on unseen test data. That gap usually means overfitting. Try a simpler model or more data.`;
    }
  }
  return null;
}

export function MetricCards({
  task,
  scores,
}: {
  task: string;
  scores: Record<string, number | null>;
}) {
  const keys = (CARD_KEYS[task] ?? []).filter((key) => typeof scores[key] === "number");
  const warning = overfitMessage(task, scores);

  return (
    <Section title="Performance" description="How well the model did on rows it had never seen.">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {keys.map((key) => {
          const info = SCORE_INFO[key];
          return (
            <div key={key} className="rounded-xl bg-slate-50 px-4 py-4">
              <dt className="text-sm font-medium text-slate-500">{info.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight">
                {formatScore(scores[key] as number, info.format)}
              </dd>
              <dd className="mt-1 text-xs text-slate-500">{DESCRIPTIONS[key]}</dd>
            </div>
          );
        })}
      </dl>
      {warning && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{warning}</p>
      )}
    </Section>
  );
}
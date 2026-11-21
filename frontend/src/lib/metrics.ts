export type ScoreFormat = "percent" | "number" | "integer";

export const TASK_LABELS: Record<string, string> = {
  classification: "Classification",
  regression: "Regression",
  clustering: "Clustering",
  dimensionality_reduction: "PCA",
};

// The one number shown next to each run in the history list.
export const HEADLINE: Record<string, { key: string; label: string; format: ScoreFormat }> = {
  classification: { key: "accuracy", label: "Accuracy", format: "percent" },
  regression: { key: "r2", label: "R²", format: "number" },
  clustering: { key: "silhouette", label: "Silhouette", format: "number" },
  dimensionality_reduction: {
    key: "total_explained_variance",
    label: "Explained variance",
    format: "percent",
  },
};

// Every score we know how to display, in display order.
export const SCORE_INFO: Record<string, { label: string; format: ScoreFormat }> = {
  accuracy: { label: "Accuracy", format: "percent" },
  balanced_accuracy: { label: "Balanced accuracy", format: "percent" },
  precision: { label: "Precision", format: "percent" },
  recall: { label: "Recall", format: "percent" },
  f1: { label: "F1 score", format: "percent" },
  roc_auc: { label: "ROC-AUC", format: "number" },
  train_accuracy: { label: "Train accuracy", format: "percent" },
  r2: { label: "R²", format: "number" },
  train_r2: { label: "Train R²", format: "number" },
  rmse: { label: "RMSE", format: "number" },
  mae: { label: "MAE", format: "number" },
  mse: { label: "MSE", format: "number" },
  silhouette: { label: "Silhouette", format: "number" },
  davies_bouldin: { label: "Davies-Bouldin", format: "number" },
  n_clusters: { label: "Clusters", format: "integer" },
  noise_fraction: { label: "Noise", format: "percent" },
  inertia: { label: "Inertia", format: "number" },
  n_components: { label: "Components", format: "integer" },
  total_explained_variance: { label: "Explained variance", format: "percent" },
};

export function formatScore(value: number, format: ScoreFormat): string {
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  if (format === "integer") return String(Math.round(value));
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return value.toFixed(3);
}
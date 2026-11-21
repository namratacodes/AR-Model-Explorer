import type { RunSummary } from "./types";

export interface RocCurveItem {
  label: string;
  auc: number;
  fpr: number[];
  tpr: number[];
}

export interface PrCurveItem {
  label: string;
  average_precision: number;
  recall: number[];
  precision: number[];
}

export interface ProjectionPoint {
  x: number;
  y: number;
  z: number;
  cluster?: number;
}

export interface ClusterProfile {
  cluster: number;
  label: string;
  size: number;
  percent: number;
  numeric_means: Record<string, number | null>;
}

export interface PcaComponent {
  component: number;
  explained_variance_ratio: number;
  cumulative: number;
  top_features: { feature: string; loading: number }[];
}

export interface RunMetrics {
  scores?: Record<string, number | null>;
  confusion_matrix?: { labels: string[]; matrix: number[][] } | null;
  roc_curve?: { curves: RocCurveItem[]; truncated: boolean } | null;
  pr_curve?: { curves: PrCurveItem[]; truncated: boolean } | null;
  predictions_sample?: { actual: number; predicted: number }[];
  residuals?: { mean: number | null; std: number | null };
  cluster_distribution?: { cluster: number; label: string; size: number; percent: number }[];
  cluster_profiles?: ClusterProfile[];
  components?: PcaComponent[];
  projection?: {
    explained_variance_ratio: number[];
    n_points_total: number;
    points: ProjectionPoint[];
  };
}

export interface ImportanceItem {
  feature: string;
  importance: number;
  relative_percent: number;
  std?: number;
}

export interface ImportanceBlock {
  method: string;
  items: ImportanceItem[];
}

export interface LocalContribution {
  feature: string;
  value: string | number | boolean | null;
  contribution: number;
  direction: string;
}

export interface LocalExample {
  test_row: number;
  prediction: string | number;
  actual: string | number;
  predicted_probability: number | null;
  correct?: boolean;
  contributions: LocalContribution[];
  other_features_contribution: number;
}

export interface LocalExplanationBlock {
  method: string;
  value_scale: string;
  n_rows_explained: number;
  examples: LocalExample[];
}

export interface Explanations {
  task: string;
  global_importance: ImportanceBlock | null;
  permutation_importance: ImportanceBlock | null;
  local_explanations: LocalExplanationBlock | null;
  availability: {
    global: boolean;
    local: boolean;
    shap: { available: boolean; reason: string | null };
  };
  notes: string[];
}

export interface VisualizationData {
  project: { id: string; name: string };
  run: {
    id: string;
    model_type: string;
    model_label: string;
    task: string;
    hyperparameters: Record<string, unknown>;
    created_at: string;
    duration_s: number | null;
  };
  headline_metric: string | null;
  summary: RunSummary | null;
  metrics: RunMetrics | null;
  explanations: Explanations | null;
}
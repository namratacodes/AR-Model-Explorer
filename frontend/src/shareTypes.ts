export interface CompareMetric {
  key: string;
  label: string;
  format: string; // "percent" | "number" | "integer"
  lower_is_better: boolean;
}

export interface CompareRun {
  run_id: string;
  model_type: string;
  model_label: string;
  hyperparameters: Record<string, unknown>;
  dataset_id: string;
  created_at: string;
  duration_s: number | null;
  scores: Record<string, number | null>;
}

export interface CompareResult {
  task: string;
  same_dataset: boolean;
  metrics: CompareMetric[];
  runs: CompareRun[];
  best: Record<string, string>; // metric key -> run id of the best run
}

export interface QrInfo {
  project_id: string;
  qr_text: string;
  svg: string;
  created_at: string;
  expires_at: string | null;
}
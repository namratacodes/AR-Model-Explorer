export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectList {
  items: Project[];
  total: number;
}

export interface ColumnProfile {
  name: string;
  kind: string;
  dtype: string;
  missing: number;
  missing_pct: number;
  unique: number;
  warnings: string[];
}

export interface DatasetProfile {
  n_rows: number;
  n_cols: number;
  duplicate_rows: number;
  missing_total: number;
  numeric_features: string[];
  categorical_features: string[];
  columns: ColumnProfile[];
}

export interface ClassShare {
  label: string;
  count: number;
  percent: number;
}

export interface TargetInfo {
  column: string;
  suggested_task: string;
  n_unique: number;
  missing: number;
  class_distribution: ClassShare[] | null;
  warnings: string[];
}

export interface Dataset {
  id: string;
  project_id: string;
  original_filename: string;
  file_size_bytes: number;
  n_rows: number;
  n_cols: number;
  target_column: string | null;
  profile: DatasetProfile;
  target_info: TargetInfo | null;
  created_at: string;
}

export interface DatasetPreview {
  columns: string[];
  rows: Record<string, string | number | boolean | null>[];
  total_rows: number;
}

export interface ModelUsage {
  model_type: string;
  label: string;
  count: number;
}

export interface RecentRun {
  run_id: string;
  project_id: string;
  project_name: string;
  model_type: string;
  model_label: string;
  task: string;
  status: string;
  created_at: string;
}

export interface DashboardSummary {
  total_projects: number;
  total_runs: number;
  completed_runs: number;
  models_used: ModelUsage[];
  recent_runs: RecentRun[];
}

// ---- models and training

export interface ParamSpec {
  type: string; // "int" | "float" | "choice"
  default: unknown;
  min: number | null;
  max: number | null;
  choices: string[] | null;
  nullable: boolean;
  description: string;
}

export interface ModelInfo {
  key: string;
  label: string;
  task: string;
  params: Record<string, ParamSpec>;
}

export interface TrainRequest {
  dataset_id: string;
  model_type: string;
  hyperparameters: Record<string, unknown>;
  test_size: number;
  random_state: number;
}

export interface RunSummary {
  task?: string;
  n_rows_used?: number;
  n_train?: number;
  n_test?: number;
  dropped_missing_target?: number;
  dropped_duplicates?: number;
  dropped_columns?: { column: string; reason: string }[];
  features_used?: string[];
  n_features_after_encoding?: number;
  excluded_target?: string | null;
  note?: string;
}

export interface TrainingRun {
  id: string;
  project_id: string;
  dataset_id: string;
  model_type: string;
  task_type: string;
  hyperparameters: Record<string, unknown>;
  test_size: number;
  random_state: number;
  status: string;
  metrics: { scores?: Record<string, number | null> } | null;
  summary: RunSummary | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_s: number | null;
}
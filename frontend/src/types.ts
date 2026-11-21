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
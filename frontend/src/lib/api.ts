import type { VisualizationData } from "../resultTypes";
import type { CompareResult, QrInfo } from "../shareTypes";
import type {
  DashboardSummary,
  Dataset,
  DatasetPreview,
  ModelInfo,
  Project,
  ProjectList,
  TokenResponse,
  TrainingRun,
  TrainRequest,
  User,
} from "../types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8000";
const TOKEN_KEY = "arme_token";

export const AUTH_EXPIRED_EVENT = "auth:expired";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  form?: URLSearchParams;
  formData?: FormData; // file uploads
  auth?: boolean; // false = don't send the login token (login/register)
};

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    const detail = data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      // FastAPI validation errors: [{ loc: ["body", "password"], msg: "..." }]
      return detail
        .map((d: { loc?: unknown[]; msg?: string }) => {
          const field = Array.isArray(d.loc) ? d.loc.filter((p) => p !== "body").join(".") : "";
          return field ? `${field}: ${d.msg ?? "invalid"}` : (d.msg ?? "Invalid input");
        })
        .join("; ");
    }
  } catch {
    // the response was not JSON
  }
  return `Request failed (${response.status})`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStorage.get();
  const sendAuth = options.auth !== false;
  if (sendAuth && token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (options.formData) {
    body = options.formData; // the browser sets the multipart Content-Type itself
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { method: options.method ?? "GET", headers, body });
  } catch {
    throw new ApiError("Cannot reach the server. Check that the backend is running.", 0);
  }

  if (!response.ok) {
    if (response.status === 401 && sendAuth && token) {
      // The token expired or was rejected: forget it and tell the app.
      tokenStorage.clear();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    throw new ApiError(await readError(response), response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  // ---- auth
  register: (email: string, password: string) =>
    request<User>("/api/auth/register", { method: "POST", body: { email, password }, auth: false }),

  // The backend's login expects a form, with the email in the "username" field.
  login: (email: string, password: string) =>
    request<TokenResponse>("/api/auth/login", {
      method: "POST",
      form: new URLSearchParams({ username: email, password }),
      auth: false,
    }),

  me: () => request<User>("/api/auth/me"),

  // ---- projects
  listProjects: (limit = 20, offset = 0) =>
    request<ProjectList>(`/api/projects?limit=${limit}&offset=${offset}`),

  getProject: (id: string) => request<Project>(`/api/projects/${id}`),

  createProject: (name: string, description: string) =>
    request<Project>("/api/projects", {
      method: "POST",
      body: { name, description: description || null },
    }),

  updateProject: (id: string, data: { name?: string; description?: string | null }) =>
    request<Project>(`/api/projects/${id}`, { method: "PATCH", body: data }),

  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),

  // ---- datasets
  listDatasets: (projectId: string) => request<Dataset[]>(`/api/projects/${projectId}/datasets`),

  uploadDataset: (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<Dataset>(`/api/projects/${projectId}/dataset`, { method: "POST", formData });
  },

  getPreview: (datasetId: string, rows = 10) =>
    request<DatasetPreview>(`/api/datasets/${datasetId}/preview?rows=${rows}`),

  setTarget: (datasetId: string, targetColumn: string | null) =>
    request<Dataset>(`/api/datasets/${datasetId}/target`, {
      method: "PUT",
      body: { target_column: targetColumn },
    }),

  // ---- models and training
  listModels: () => request<ModelInfo[]>("/api/models"),

  startTraining: (projectId: string, data: TrainRequest) =>
    request<TrainingRun>(`/api/projects/${projectId}/train`, { method: "POST", body: data }),

  listRuns: (projectId: string, limit = 50) =>
    request<TrainingRun[]>(`/api/projects/${projectId}/runs?limit=${limit}`),

  getRun: (runId: string) => request<TrainingRun>(`/api/training/${runId}`),

  // ---- results and comparison
  getVisualizations: (projectId: string, runId: string) =>
    request<VisualizationData>(
      `/api/projects/${projectId}/visualizations?run_id=${encodeURIComponent(runId)}`,
    ),

  compareRuns: (projectId: string, runIds: string[]) => {
    const query = runIds.map((id) => `run_ids=${encodeURIComponent(id)}`).join("&");
    return request<CompareResult>(`/api/projects/${projectId}/compare?${query}`);
  },

  // ---- QR code
  getQr: (projectId: string) => request<QrInfo>(`/api/projects/${projectId}/qr`),

  regenerateQr: (projectId: string) =>
    request<QrInfo>(`/api/projects/${projectId}/qr/regenerate`, { method: "POST" }),

  // ---- dashboard
  dashboardSummary: () => request<DashboardSummary>("/api/dashboard/summary"),
};
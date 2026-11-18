import type { Project, ProjectList, TokenResponse, User } from "../types";

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

  listProjects: (limit = 20, offset = 0) =>
    request<ProjectList>(`/api/projects?limit=${limit}&offset=${offset}`),

  createProject: (name: string, description: string) =>
    request<Project>("/api/projects", {
      method: "POST",
      body: { name, description: description || null },
    }),
};
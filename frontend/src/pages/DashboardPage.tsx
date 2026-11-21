import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { CreateProjectForm } from "../components/CreateProjectForm";
import { StatusBadge } from "../components/StatusBadge";
import { Alert, Button, Card, Spinner } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/format";
import type { DashboardSummary, ProjectList } from "../types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuth();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [projects, setProjects] = useState<ProjectList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([api.dashboardSummary(), api.listProjects(5)]);
      setSummary(s);
      setProjects(p);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxUsage = Math.max(1, ...(summary?.models_used.map((m) => m.count) ?? []));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Signed in as {user?.email}</p>
      </div>

      {loading && !summary && (
        <div className="flex justify-center py-16 text-indigo-600">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {error && (
        <div className="space-y-3">
          <Alert>{error}</Alert>
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Projects" value={String(summary.total_projects)} />
            <Stat label="Training runs" value={String(summary.total_runs)} />
            <Stat label="Completed runs" value={String(summary.completed_runs)} />
            <Stat label="Different models used" value={String(summary.models_used.length)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold tracking-tight">Recent projects</h2>
                  <Link to="/projects" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                    View all
                  </Link>
                </div>

                {projects && projects.total === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
                    <p className="font-medium">No projects yet</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Create your first project with the form on the right.
                    </p>
                  </div>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100">
                    {projects?.items.map((project) => (
                      <li key={project.id}>
                        <Link
                          to={`/projects/${project.id}`}
                          className="flex items-center justify-between gap-4 py-4 hover:opacity-80"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{project.name}</p>
                            {project.description && (
                              <p className="truncate text-sm text-slate-500">{project.description}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <StatusBadge status={project.status} />
                            <span className="hidden text-xs text-slate-400 sm:inline">
                              {formatDate(project.created_at)}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <h2 className="text-lg font-semibold tracking-tight">Recent training runs</h2>
                {summary.recent_runs.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No training runs yet.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100">
                    {summary.recent_runs.map((run) => (
                      <li key={run.run_id} className="flex items-center justify-between gap-4 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{run.model_label}</p>
                          <Link
                            to={`/projects/${run.project_id}`}
                            className="truncate text-sm text-indigo-600 hover:text-indigo-500"
                          >
                            {run.project_name}
                          </Link>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <StatusBadge status={run.status} />
                          <span className="hidden text-xs text-slate-400 sm:inline">
                            {formatDateTime(run.created_at)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <CreateProjectForm onCreated={load} />

              <Card>
                <h2 className="text-lg font-semibold tracking-tight">Models used</h2>
                {summary.models_used.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">Nothing trained yet.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {summary.models_used.map((usage) => (
                      <li key={usage.model_type}>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{usage.label}</span>
                          <span className="text-slate-500">{usage.count}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-indigo-500"
                            style={{ width: `${(usage.count / maxUsage) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
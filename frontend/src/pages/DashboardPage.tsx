import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/auth-context";
import { Alert, Button, Card, Spinner, TextField } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import type { ProjectList } from "../types";

const STATUS_INFO: Record<string, { label: string; style: string }> = {
  created: { label: "New", style: "bg-slate-100 text-slate-700" },
  dataset_uploaded: { label: "Dataset ready", style: "bg-amber-50 text-amber-700" },
  trained: { label: "Trained", style: "bg-emerald-50 text-emerald-700" },
};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_INFO[status] ?? { label: status, style: "bg-slate-100 text-slate-700" };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${info.style}`}>{info.label}</span>
  );
}

export function DashboardPage() {
  const { user } = useAuth();

  const [data, setData] = useState<ProjectList | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setData(await api.listProjects(5));
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCreated(null);
    try {
      const project = await api.createProject(name.trim(), description.trim());
      setCreated(`Project "${project.name}" created.`);
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Signed in as {user?.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-slate-500">Total projects</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{data ? data.total : "–"}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight">Recent projects</h2>

          <div className="mt-4">
            {loading && !data && (
              <div className="flex justify-center py-10 text-indigo-600">
                <Spinner className="h-6 w-6" />
              </div>
            )}

            {loadError && (
              <div className="space-y-3">
                <Alert>{loadError}</Alert>
                <Button variant="secondary" onClick={() => void load()}>
                  Try again
                </Button>
              </div>
            )}

            {data && data.total === 0 && !loadError && (
              <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
                <p className="font-medium">No projects yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  Create your first project with the form on the right.
                </p>
              </div>
            )}

            {data && data.items.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {data.items.map((project) => (
                  <li key={project.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{project.name}</p>
                      {project.description && (
                        <p className="truncate text-sm text-slate-500">{project.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={project.status} />
                      <span className="hidden text-xs text-slate-400 sm:inline">
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold tracking-tight">New project</h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            {createError && <Alert>{createError}</Alert>}
            {created && <Alert tone="success">{created}</Alert>}
            <TextField
              label="Name"
              required
              maxLength={120}
              placeholder="Breast Cancer Prediction"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              label="Description (optional)"
              maxLength={1000}
              placeholder="Random Forest demo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button type="submit" loading={creating} disabled={!name.trim()} className="w-full">
              Create project
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
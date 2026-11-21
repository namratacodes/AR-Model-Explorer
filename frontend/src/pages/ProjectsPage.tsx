import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CreateProjectForm } from "../components/CreateProjectForm";
import { StatusBadge } from "../components/StatusBadge";
import { Alert, Button, Card, Spinner } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import type { ProjectList } from "../types";

const PAGE_SIZE = 10;

export function ProjectsPage() {
  const [data, setData] = useState<ProjectList | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.listProjects(PAGE_SIZE, offset));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-slate-600">Each project holds a dataset, models and a QR code.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {loading && !data && (
            <div className="flex justify-center py-10 text-indigo-600">
              <Spinner className="h-6 w-6" />
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

          {data && data.total === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
              <p className="font-medium">No projects yet</p>
              <p className="mt-1 text-sm text-slate-500">Create one with the form on the right.</p>
            </div>
          )}

          {data && data.items.length > 0 && (
            <>
              <ul className="divide-y divide-slate-100">
                {data.items.map((project) => (
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

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-500">
                  {from}–{to} of {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={offset + PAGE_SIZE >= total}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        <CreateProjectForm
          onCreated={() => {
            if (offset === 0) void load();
            else setOffset(0);
          }}
        />
      </div>
    </div>
  );
}
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DataPreview } from "../components/project/DataPreview";
import { DatasetOverview } from "../components/project/DatasetOverview";
import { TargetCard } from "../components/project/TargetCard";
import { UploadCard } from "../components/project/UploadCard";
import { StatusBadge } from "../components/StatusBadge";
import { Alert, Button, Spinner, TextField } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { formatDateTime } from "../lib/format";
import type { Dataset, Project } from "../types";

export function ProjectPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [loadedProject, loadedDatasets] = await Promise.all([
        api.getProject(projectId),
        api.listDatasets(projectId),
      ]);
      setProject(loadedProject);
      setDatasets(loadedDatasets);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The newest dataset is shown unless the user picks another one.
  const selected = datasets.find((d) => d.id === selectedId) ?? datasets[0] ?? null;

  async function handleUploaded(dataset: Dataset) {
    setSelectedId(dataset.id);
    await load(); // refreshes the dataset list and the project's status
  }

  function handleTargetSaved(updated: Dataset) {
    setDatasets((previous) => previous.map((d) => (d.id === updated.id ? updated : d)));
  }

  async function saveName() {
    const name = draftName.trim();
    if (!project || !name) return;
    setSaving(true);
    setActionError(null);
    try {
      setProject(await api.updateProject(project.id, { name }));
      setEditing(false);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!project) return;
    const confirmed = window.confirm(
      `Delete "${project.name}"? Its datasets, models and QR codes will be removed. This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.deleteProject(project.id);
      navigate("/projects", { replace: true });
    } catch (err) {
      setActionError(errorMessage(err));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-indigo-600">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Alert>{error ?? "Project not found."}</Alert>
        <Link to="/projects" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          ← Back to projects
        </Link>
      </div>
    );
  }

  const upload = (
    <UploadCard projectId={project.id} hasDataset={datasets.length > 0} onUploaded={handleUploaded} />
  );

  return (
    <div className="space-y-6">
      <Link to="/projects" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
        ← Projects
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex max-w-md items-end gap-2">
              <div className="flex-1">
                <TextField
                  label="Project name"
                  maxLength={120}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
              </div>
              <Button onClick={() => void saveName()} loading={saving} disabled={!draftName.trim()}>
                Save
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
          )}
          {project.description && !editing && (
            <p className="mt-1 text-sm text-slate-600">{project.description}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">Created {formatDateTime(project.created_at)}</p>
        </div>

        {!editing && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setDraftName(project.name);
                setEditing(true);
              }}
            >
              Rename
            </Button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-red-600 ring-1 ring-inset ring-red-200 transition hover:bg-red-50 disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        )}
      </div>

      {actionError && <Alert>{actionError}</Alert>}

      {datasets.length === 0 && upload}

      {selected && (
        <>
          {datasets.length > 1 && (
            <div className="max-w-md">
              <label htmlFor="dataset-select" className="mb-1.5 block text-sm font-medium text-slate-700">
                Dataset version
              </label>
              <select
                id="dataset-select"
                value={selected.id}
                onChange={(e) => setSelectedId(e.target.value)}
                className="block w-full rounded-lg border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
              >
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.original_filename} · {formatDateTime(dataset.created_at)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <DatasetOverview key={`overview-${selected.id}`} dataset={selected} />
          <DataPreview key={`preview-${selected.id}`} datasetId={selected.id} />
          <TargetCard key={`target-${selected.id}`} dataset={selected} onSaved={handleTargetSaved} />
        </>
      )}

      {datasets.length > 0 && upload}
    </div>
  );
}
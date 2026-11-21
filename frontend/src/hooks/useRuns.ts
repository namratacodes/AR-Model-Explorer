import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import type { TrainingRun } from "../types";

const POLL_MS = 2000;

export function useRuns(projectId: string) {
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRuns(await api.listRuns(projectId));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const hasActive = runs.some((run) => run.status === "queued" || run.status === "running");

  useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      void reload();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [hasActive, reload]);

  return { runs, loading, error, reload };
}
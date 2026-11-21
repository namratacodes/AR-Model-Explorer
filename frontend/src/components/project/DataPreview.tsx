import { useEffect, useState } from "react";
import { Alert, Card, Spinner } from "../ui";
import { api, errorMessage } from "../../lib/api";
import { formatNumber } from "../../lib/format";
import type { DatasetPreview } from "../../types";

export function DataPreview({ datasetId }: { datasetId: string }) {
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getPreview(datasetId, 10)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Data preview</h2>
        {preview && (
          <p className="text-sm text-slate-500">
            First {preview.rows.length} of {formatNumber(preview.total_rows)} rows
          </p>
        )}
      </div>

      <div className="mt-4">
        {loading && (
          <div className="flex justify-center py-8 text-indigo-600">
            <Spinner className="h-6 w-6" />
          </div>
        )}
        {error && <Alert>{error}</Alert>}
        {preview && (
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
                <tr>
                  {preview.columns.map((column) => (
                    <th key={column} className="whitespace-nowrap px-3 py-2 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.map((row, index) => (
                  <tr key={index}>
                    {preview.columns.map((column) => {
                      const cell = row[column];
                      return (
                        <td key={column} className="whitespace-nowrap px-3 py-2 text-slate-700">
                          {cell === null || cell === undefined ? (
                            <span className="text-slate-300">null</span>
                          ) : (
                            String(cell)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
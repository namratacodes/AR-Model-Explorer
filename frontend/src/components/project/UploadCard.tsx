import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Alert, Button, Card } from "../ui";
import { api, errorMessage } from "../../lib/api";
import type { Dataset } from "../../types";

const MAX_UPLOAD_MB = 20; // same limit as the backend

export function UploadCard({
  projectId,
  hasDataset,
  onUploaded,
}: {
  projectId: string;
  hasDataset: boolean;
  onUploaded: (dataset: Dataset) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a .csv file.");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`This file is larger than ${MAX_UPLOAD_MB} MB.`);
      return;
    }
    setUploading(true);
    try {
      const dataset = await api.uploadDataset(projectId, file);
      await onUploaded(dataset);
    } catch (err) {
      setError(errorMessage(err)); // e.g. "The file is empty." straight from the server
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allows choosing the same file again
    if (file) void upload(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">
        {hasDataset ? "Upload a new dataset" : "Upload your dataset"}
      </h2>
      <div className="mt-4 space-y-4">
        {error && <Alert>{error}</Alert>}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragging ? "border-indigo-400 bg-indigo-50" : "border-slate-300"
          }`}
        >
          <p className="text-sm text-slate-600">
            Drag a CSV file here, or choose one. Column names go in the first row. Up to{" "}
            {MAX_UPLOAD_MB} MB.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleChange}
          />
          <Button loading={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? "Uploading..." : "Choose CSV file"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
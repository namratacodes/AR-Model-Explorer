import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Spinner } from "../ui";
import { api, errorMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import type { QrInfo } from "../../shareTypes";

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}

function downloadSvg(svg: string, fileName: string) {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function QrCard({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [qr, setQr] = useState<QrInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setQr(await api.getQr(projectId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function regenerate() {
    const confirmed = window.confirm(
      "Create a new QR code? The current one, including any printed or shared copies, will stop working immediately.",
    );
    if (!confirmed) return;
    setRegenerating(true);
    setError(null);
    try {
      setQr(await api.regenerateQr(projectId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRegenerating(false);
    }
  }

  async function copyLink() {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(qr.qr_text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy automatically.");
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="shrink-0">
          {loading && !qr && (
            <div className="flex h-52 w-52 items-center justify-center text-indigo-600">
              <Spinner className="h-7 w-7" />
            </div>
          )}
          {qr && (
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`}
              alt={`QR code for ${projectName}`}
              className="h-52 w-52 rounded-xl bg-white p-3 ring-1 ring-slate-200"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Open in AR</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
            <li>Open the AR Model Explorer app on your Android phone.</li>
            <li>Tap “Scan Project QR”.</li>
            <li>Point the camera at this code and place the dashboard on a flat surface.</li>
          </ol>

          <p className="mt-4 text-sm text-slate-600">
            The code opens your most recently trained model. Anyone who scans it can view this
            project’s results read-only. They never get your CSV file or your account. The “why
            this prediction?” examples do show the values of a few test rows.
          </p>

          {error && (
            <div className="mt-4">
              <Alert>{error}</Alert>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              disabled={!qr}
              onClick={() => qr && downloadSvg(qr.svg, `${slug(projectName)}-qr.svg`)}
            >
              Download QR (SVG)
            </Button>
            <Button variant="secondary" disabled={!qr} onClick={() => void copyLink()}>
              {copied ? "Copied ✓" : "Copy link text"}
            </Button>
            <Button variant="secondary" loading={regenerating} disabled={!qr} onClick={() => void regenerate()}>
              Create a new QR code
            </Button>
          </div>

          {qr && (
            <p className="mt-3 text-xs text-slate-400">
              Created {formatDateTime(qr.created_at)} ·{" "}
              {qr.expires_at ? `expires ${formatDateTime(qr.expires_at)}` : "does not expire"}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
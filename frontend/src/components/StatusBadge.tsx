const STATUS_INFO: Record<string, { label: string; style: string }> = {
  // project statuses
  created: { label: "New", style: "bg-slate-100 text-slate-700" },
  dataset_uploaded: { label: "Dataset ready", style: "bg-amber-50 text-amber-700" },
  trained: { label: "Trained", style: "bg-emerald-50 text-emerald-700" },
  // training run statuses
  queued: { label: "Queued", style: "bg-slate-100 text-slate-700" },
  running: { label: "Running", style: "bg-sky-50 text-sky-700" },
  completed: { label: "Completed", style: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", style: "bg-red-50 text-red-700" },
};

export function StatusBadge({ status }: { status: string }) {
  const info = STATUS_INFO[status] ?? { label: status, style: "bg-slate-100 text-slate-700" };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${info.style}`}>{info.label}</span>
  );
}
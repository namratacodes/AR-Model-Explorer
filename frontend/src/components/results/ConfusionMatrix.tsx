import { Fragment } from "react";
import { Section } from "./Section";

const MAX_CLASSES = 12;

export function ConfusionMatrix({ labels, matrix }: { labels: string[]; matrix: number[][] }) {
  const rowTotals = matrix.map((row) => row.reduce((sum, value) => sum + value, 0));

  const keep =
    labels.length > MAX_CLASSES
      ? rowTotals
          .map((total, index) => ({ total, index }))
          .sort((a, b) => b.total - a.total)
          .slice(0, MAX_CLASSES)
          .map((item) => item.index)
          .sort((a, b) => a - b)
      : labels.map((_, index) => index);

  const max = Math.max(1, ...keep.flatMap((i) => keep.map((j) => matrix[i][j])));

  return (
    <Section
      title="Confusion matrix"
      description="Each row is what a case really was; each column is what the model predicted. The diagonal (blue) is correct predictions. Red cells are mistakes."
    >
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-1"
          style={{ gridTemplateColumns: `auto repeat(${keep.length}, minmax(64px, 1fr))` }}
        >
          <div className="pr-3 text-[10px] uppercase leading-tight tracking-wide text-slate-400">
            actual ↓<br />
            predicted →
          </div>
          {keep.map((j) => (
            <div key={`head-${j}`} className="px-1 pb-1 text-center text-xs font-medium text-slate-600">
              {labels[j]}
            </div>
          ))}

          {keep.map((i) => (
            <Fragment key={`row-${i}`}>
              <div className="flex items-center pr-3 text-xs font-medium text-slate-600">{labels[i]}</div>
              {keep.map((j) => {
                const count = matrix[i][j];
                const percent = rowTotals[i] ? (count / rowTotals[i]) * 100 : 0;
                const correct = i === j;
                const alpha = count === 0 ? 0 : 0.12 + (count / max) * 0.78;
                const background = correct
                  ? `rgba(79, 70, 229, ${alpha})`
                  : `rgba(225, 29, 72, ${alpha})`;
                const dark = alpha > 0.55;
                return (
                  <div
                    key={`cell-${i}-${j}`}
                    title={`Actual ${labels[i]}, predicted ${labels[j]}: ${count} (${percent.toFixed(1)}% of actual ${labels[i]})`}
                    className={`flex flex-col items-center justify-center rounded-lg py-3 ${
                      correct ? "ring-2 ring-indigo-200" : ""
                    }`}
                    style={{ background }}
                  >
                    <span className={`text-base font-semibold ${dark ? "text-white" : "text-slate-800"}`}>
                      {count}
                    </span>
                    <span className={`text-[11px] ${dark ? "text-white/80" : "text-slate-500"}`}>
                      {percent.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        The small percentage is the share of that row's real cases. Hover a cell for details.
        {labels.length > MAX_CLASSES &&
          ` Showing the ${MAX_CLASSES} most common of ${labels.length} classes.`}
      </p>
    </Section>
  );
}
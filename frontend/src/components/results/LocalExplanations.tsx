import { useState } from "react";
import type { LocalExplanationBlock } from "../../resultTypes";
import { Section } from "./Section";

const SCALE_HELP: Record<string, string> = {
  probability:
    "Bar sizes are in probability: +0.10 means this column raised the predicted probability by 10 percentage points.",
  "log-odds":
    "Bar sizes are in log-odds, a stretched scale used by logistic-style models. Longer bars mean a stronger push; the sign shows the direction.",
  "target units": "Bar sizes are in the same units as the value being predicted.",
};

function formatValue(value: string | number | boolean | null): string {
  if (value === null) return "missing";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

function formatPrediction(value: string | number): string {
  return typeof value === "number"
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : String(value);
}

export function LocalExplanations({ local }: { local: LocalExplanationBlock }) {
  const [index, setIndex] = useState(0);
  const example = local.examples[index] ?? local.examples[0];
  if (!example) return null;

  const peak = Math.max(1e-9, ...example.contributions.map((c) => Math.abs(c.contribution)));

  return (
    <Section
      title="Why this prediction?"
      description="Pick an example from the test data and see which columns pushed the model's answer up or down."
    >
      <div className="flex flex-wrap gap-2">
        {local.examples.map((item, i) => (
          <button
            key={item.test_row}
            type="button"
            onClick={() => setIndex(i)}
            aria-pressed={i === index}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium ring-1 ring-inset transition ${
              i === index
                ? "bg-indigo-600 text-white ring-indigo-600"
                : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
            }`}
          >
            Example {i + 1}
            {item.correct !== undefined && (item.correct ? " ✓" : " ✗")}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-xl bg-slate-50 px-5 py-4 text-sm">
        <p>
          The model predicted <b>{formatPrediction(example.prediction)}</b>
          {example.predicted_probability !== null &&
            ` with ${(example.predicted_probability * 100).toFixed(0)}% confidence`}
          . The real answer was <b>{formatPrediction(example.actual)}</b>
          {example.correct !== undefined && (example.correct ? " (correct ✓)." : " (a mistake ✗).")}
        </p>
      </div>

      <ul className="mt-5 space-y-3">
        {example.contributions.map((item) => {
          const positive = item.contribution >= 0;
          const width = (Math.abs(item.contribution) / peak) * 50;
          return (
            <li key={item.feature} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.feature}</p>
                <p className="truncate text-xs text-slate-500">value: {formatValue(item.value)}</p>
              </div>
              <div className="relative h-5">
                <div className="absolute left-1/2 top-0 h-full w-px bg-slate-300" />
                <div
                  className={`absolute top-0 h-full rounded ${
                    positive ? "left-1/2 bg-indigo-500" : "right-1/2 bg-amber-500"
                  }`}
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className="w-32 text-right text-xs">
                <span className="font-semibold">
                  {positive ? "+" : "−"}
                  {Math.abs(item.contribution).toFixed(3)}
                </span>{" "}
                <span className="text-slate-500">{positive ? "raises" : "lowers"}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-slate-500">
        All other columns together: {example.other_features_contribution >= 0 ? "+" : "−"}
        {Math.abs(example.other_features_contribution).toFixed(3)}. Bars to the right (blue, +) push
        toward the predicted answer; bars to the left (amber, −) push away from it.{" "}
        {SCALE_HELP[local.value_scale] ?? ""}
      </p>
    </Section>
  );
}
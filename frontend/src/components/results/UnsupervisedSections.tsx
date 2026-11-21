import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "../../lib/format";
import type { ProjectionPoint, RunMetrics } from "../../resultTypes";
import { Section } from "./Section";

const COLORS = [
  "#4f46e5", "#059669", "#d97706", "#dc2626", "#0891b2",
  "#7c3aed", "#db2777", "#65a30d", "#475569", "#ea580c",
];
const NOISE_COLOR = "#94a3b8";

function clusterColor(cluster: number) {
  return cluster === -1 ? NOISE_COLOR : COLORS[cluster % COLORS.length];
}

function ProjectionChart({ points, ratios }: { points: ProjectionPoint[]; ratios: number[] }) {
  const hasClusters = points.some((p) => p.cluster !== undefined);
  const groups = new Map<number, ProjectionPoint[]>();
  for (const point of points) {
    const key = point.cluster ?? 0;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }
  const axisLabel = (index: number) =>
    ratios[index] !== undefined
      ? `PC${index + 1} (${(ratios[index] * 100).toFixed(0)}% of variation)`
      : `PC${index + 1}`;

  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 24, bottom: 24, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name="PC1"
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{ value: axisLabel(0), position: "insideBottom", offset: -12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="PC2"
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{ value: axisLabel(1), angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            formatter={(value) => (typeof value === "number" ? value.toFixed(2) : String(value))}
          />
          <Legend verticalAlign="top" />
          {[...groups.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([cluster, items]) => (
              <Scatter
                key={cluster}
                name={hasClusters ? (cluster === -1 ? "Noise" : `Cluster ${cluster}`) : "Rows"}
                data={items}
                fill={hasClusters ? clusterColor(cluster) : COLORS[0]}
                fillOpacity={0.7}
                isAnimationActive={false}
              />
            ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ClusterSection({ metrics }: { metrics: RunMetrics }) {
  const distribution = metrics.cluster_distribution ?? [];
  const profiles = metrics.cluster_profiles ?? [];
  const projection = metrics.projection;
  const featureNames = Object.keys(profiles[0]?.numeric_means ?? {}).slice(0, 8);

  return (
    <>
      <Section
        title="Clusters found"
        description="The model sorted your rows into groups without being told the answer. Here is how big each group is."
      >
        <div className="space-y-3">
          {distribution.map((item) => (
            <div key={item.cluster}>
              <div className="flex justify-between gap-4 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: clusterColor(item.cluster) }}
                  />
                  {item.label}
                </span>
                <span className="text-slate-600">
                  {formatNumber(item.size)} rows · {item.percent}%
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${item.percent}%`, background: clusterColor(item.cluster) }}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {projection && (
        <Section
          title="Cluster map"
          description="Each dot is one row, squeezed from many columns down to two (PCA) so it fits on screen. Dots of the same colour belong to the same cluster. The AR view shows this same map in 3D."
        >
          <ProjectionChart points={projection.points} ratios={projection.explained_variance_ratio} />
          <p className="mt-3 text-xs text-slate-500">
            Showing {formatNumber(projection.points.length)} of {formatNumber(projection.n_points_total)}{" "}
            rows.
          </p>
        </Section>
      )}

      {profiles.length > 0 && featureNames.length > 0 && (
        <Section
          title="What each cluster looks like"
          description="The average value of each numeric column inside the cluster. Look for the columns where the groups differ most."
        >
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Cluster</th>
                  <th className="px-4 py-2.5 font-medium">Rows</th>
                  {featureNames.map((name) => (
                    <th key={name} className="whitespace-nowrap px-4 py-2.5 font-medium">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((profile) => (
                  <tr key={profile.cluster}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium">{profile.label}</td>
                    <td className="px-4 py-2.5 text-slate-600">{formatNumber(profile.size)}</td>
                    {featureNames.map((name) => {
                      const value = profile.numeric_means[name];
                      return (
                        <td key={name} className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                          {typeof value === "number"
                            ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                            : "–"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
}

export function PcaSection({ metrics }: { metrics: RunMetrics }) {
  const components = metrics.components ?? [];
  const projection = metrics.projection;

  return (
    <>
      <Section
        title="Components"
        description="PCA finds new 'summary axes' that keep as much of the data's variation as possible. Each component is a blend of your original columns."
      >
        <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Component</th>
                <th className="px-4 py-2.5 font-medium">Variation kept</th>
                <th className="px-4 py-2.5 font-medium">Total so far</th>
                <th className="px-4 py-2.5 font-medium">Strongest columns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {components.map((component) => (
                <tr key={component.component}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium">PC{component.component}</td>
                  <td className="px-4 py-2.5">{(component.explained_variance_ratio * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2.5">{(component.cumulative * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {component.top_features.map((f) => (
                        <span
                          key={f.feature}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                        >
                          {f.feature} {f.loading >= 0 ? "+" : "−"}
                          {Math.abs(f.loading).toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {projection && (
        <Section
          title="Data map"
          description="Every dot is one row, placed using the first two components."
        >
          <ProjectionChart points={projection.points} ratios={projection.explained_variance_ratio} />
        </Section>
      )}
    </>
  );
}
"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface RadarAxis {
  axis: string;
  claimed: number;
  evidenced: number;
  required: number;
}

/**
 * The claims-vs-evidence-vs-requirement radar — the product's signature chart.
 * Three series over the same axes expose both the over-claim surface and the
 * genuine learning gap in one view.
 */
export function SkillRadar({ axes, height = 300 }: { axes: RadarAxis[]; height?: number }) {
  if (!axes.length) {
    return (
      <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">
        No skill data yet — connect evidence or complete the interview.
      </div>
    );
  }
  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden [&_.recharts-surface]:overflow-hidden [&_svg]:max-w-full">
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={axes} outerRadius="58%" margin={{ top: 10, right: 15, bottom: 10, left: 15 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={({ payload, x, y, ...rest }) => {
              const text = String(payload?.value ?? "");
              const formatted = text.length > 14 ? text.slice(0, 12) + "…" : text;
              return (
                <text {...rest} x={x} y={y} fill="var(--muted-foreground)" fontSize={10} textAnchor="middle">
                  {formatted}
                </text>
              );
            }}
          />
          <PolarRadiusAxis domain={[0, 5]} tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} stroke="var(--border)" />
          <Radar name="Claimed" dataKey="claimed" stroke="oklch(0.78 0.13 80)" fill="oklch(0.78 0.13 80)" fillOpacity={0.12} strokeWidth={2} />
          <Radar name="Evidenced" dataKey="evidenced" stroke="oklch(0.72 0.14 162)" fill="oklch(0.72 0.14 162)" fillOpacity={0.25} strokeWidth={2} />
          <Radar name="Required" dataKey="required" stroke="oklch(0.62 0.19 25)" fill="oklch(0.62 0.19 25)" fillOpacity={0.05} strokeWidth={1.5} strokeDasharray="5 3" />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--foreground)",
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

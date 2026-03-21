"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface SnapshotEntry {
  createdAt: string;
  totalValueUsd: number;
  pnlUsd: number;
  pnlPct: number;
}

interface PnlChartProps {
  snapshots: SnapshotEntry[];
}

export function PnlChart({ snapshots }: PnlChartProps) {
  if (snapshots.length < 2) {
    return (
      <div className="glass p-8 text-center text-[var(--text-muted)]">
        <p>Not enough data for chart yet. Check back after a few agent cycles.</p>
      </div>
    );
  }

  const data = snapshots.map((s) => ({
    time: new Date(s.createdAt).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    value: Number(s.totalValueUsd),
    pnl: Number(s.pnlPct),
  }));

  const isProfitable = data[data.length - 1].pnl >= 0;
  const gradientColor = isProfitable ? "#66BB6A" : "#EF5350";
  const lineColor = isProfitable ? "#66BB6A" : "#EF5350";
  const startValue = data[0].value;

  return (
    <div className="glass p-6 relative overflow-hidden">
      <h3 className="text-lg font-semibold mb-4 relative z-10">Portfolio Value</h3>
      {/* Caustic overlay — low opacity, on container only */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: "radial-gradient(ellipse at 50% 30%, var(--caustic-blue), transparent 70%)",
          mixBlendMode: "screen",
        }}
      />
      <div className="h-48 sm:h-64 relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradientColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={gradientColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fill: "#5A5E73", fontSize: 11 }}
              axisLine={{ stroke: "#2A2E45" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#5A5E73", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={["dataMin - 0.5", "dataMax + 0.5"]}
              tickFormatter={(v: number) => `$${v.toFixed(1)}`}
            />
            <ReferenceLine
              y={startValue}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 4"
              label={{
                value: `$${startValue.toFixed(2)}`,
                fill: "#5A5E73",
                fontSize: 10,
                position: "right",
              }}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(6, 10, 31, 0.95)",
                border: "1px solid var(--liquid-border)",
                borderRadius: "12px",
                color: "#F0F0F5",
                fontSize: 13,
                backdropFilter: "blur(12px)",
              }}
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Value"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              fill="url(#pnlGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

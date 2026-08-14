"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardMetrics } from "@/lib/dashboard";

const SERIES = "var(--chart-series-1)";
const tickStyle = { fill: "var(--muted-foreground)", fontSize: 12 };
const gridStroke = "var(--border)";

const tooltipProps = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--popover-foreground)",
  },
  cursor: { fill: "var(--muted)", opacity: 0.4 },
} as const;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

export function DashboardCharts({ metrics }: { metrics: DashboardMetrics }) {
  // Cumulative applications over time.
  let running = 0;
  const cumulative = metrics.overTime.map((d) => ({ date: d.date, total: (running += d.count) }));
  const topCompanies = metrics.topCompanies.slice(0, 8);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="By status">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={metrics.byStatus} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} stroke={gridStroke} />
            <XAxis type="number" allowDecimals={false} tick={tickStyle} stroke={gridStroke} />
            <YAxis type="category" dataKey="status" width={84} tick={tickStyle} stroke={gridStroke} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="count" fill={SERIES} radius={[0, 4, 4, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Applications over time (cumulative)">
        {cumulative.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={cumulative} margin={{ left: 8, right: 16, top: 8 }}>
              <defs>
                <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={SERIES} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={gridStroke} />
              <XAxis dataKey="date" tick={tickStyle} stroke={gridStroke} minTickGap={24} />
              <YAxis allowDecimals={false} tick={tickStyle} stroke={gridStroke} width={32} />
              <Tooltip {...tooltipProps} />
              <Area
                type="monotone"
                dataKey="total"
                stroke={SERIES}
                strokeWidth={2}
                fill="url(#fillTotal)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Top companies">
        {topCompanies.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topCompanies} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke={gridStroke} />
              <XAxis type="number" allowDecimals={false} tick={tickStyle} stroke={gridStroke} />
              <YAxis type="category" dataKey="company" width={120} tick={tickStyle} stroke={gridStroke} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="count" fill={SERIES} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
      No data yet.
    </div>
  );
}

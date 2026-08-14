import { RESPONDED_STATUSES, type AppStatus } from "./enums";
import { STATUS_ORDER } from "./kanban";

// Pure dashboard metrics — unit-tested in tests/dashboard.test.ts.
// Response rate = (applications past APPLIED) / (applications that reached APPLIED).

const IN_PROGRESS: AppStatus[] = ["APPLIED", "OA", "INTERVIEW"];

export interface MetricsInput {
  status: string;
  company: string;
  appliedDate: string | Date | null;
}

export interface DashboardMetrics {
  total: number;
  applied: number;
  inProgress: number;
  offers: number;
  responded: number;
  responseRate: number; // 0..1
  byStatus: { status: string; count: number }[];
  overTime: { date: string; count: number }[];
  topCompanies: { company: string; count: number }[];
}

function ymd(v: string | Date | null): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function computeDashboardMetrics(apps: MetricsInput[]): DashboardMetrics {
  const total = apps.length;
  const applied = apps.filter((a) => a.status !== "SAVED").length;
  const inProgress = apps.filter((a) => IN_PROGRESS.includes(a.status as AppStatus)).length;
  const offers = apps.filter((a) => a.status === "OFFER").length;
  const responded = apps.filter((a) => RESPONDED_STATUSES.includes(a.status as AppStatus)).length;
  const responseRate = applied > 0 ? responded / applied : 0;

  const statusCounts = new Map<string, number>();
  const companyCounts = new Map<string, number>();
  const dateCounts = new Map<string, number>();
  for (const a of apps) {
    statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
    companyCounts.set(a.company, (companyCounts.get(a.company) ?? 0) + 1);
    const d = ymd(a.appliedDate);
    if (d) dateCounts.set(d, (dateCounts.get(d) ?? 0) + 1);
  }

  const byStatus = STATUS_ORDER.map((status) => ({ status, count: statusCounts.get(status) ?? 0 }));

  const overTime = [...dateCounts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const topCompanies = [...companyCounts.entries()]
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => b.count - a.count || a.company.localeCompare(b.company));

  return { total, applied, inProgress, offers, responded, responseRate, byStatus, overTime, topCompanies };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Clock,
  FolderKanban,
  ListChecks,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  RoleBadge,
  StatusBadge,
  TaskStatusBadge,
  TASK_STATUS_STYLES,
  type TaskStatusKey,
  UserInitialsAvatar,
} from "@/components/role-status-badge";
import { RunningTimerCard } from "@/components/running-timer-card";
import { usePageTitle } from "@/hooks/use-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type UserRole } from "@/lib/roles";

type UserLite = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

type ProjectLite = {
  _id: string;
  projectId: string;
  name: string;
  status: "active" | "inactive";
  updatedAt?: string;
  reportingTo?: UserLite[];
  assignees?: UserLite[];
};

type TaskLite = {
  _id: string;
  title: string;
  status: TaskStatusKey;
  updatedAt?: string;
  project: { _id: string; name: string; projectId: string } | null;
  assignees?: UserLite[];
};

type LogLite = {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  note?: string;
  project: { _id: string; name: string; projectId: string } | null;
  task: { _id: string; title: string; taskId?: string | null } | null;
};

type TopLogger = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  total: number;
};

type UserRow = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "inactive";
  createdAt?: string;
};

type HoursByDay = { day: string; label: string; hours: number };

type DashboardData = {
  role: UserRole;
  counts: Record<string, number>;
  statusBreakdown: Record<string, number>;
  roleBreakdown?: Record<string, number>;
  recentProjects: ProjectLite[];
  recentTasks: TaskLite[];
  recentUsers?: UserRow[];
  recentLogs?: LogLite[];
  topLoggers?: TopLogger[];
  hoursByDay?: HoursByDay[];
};

type Session = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

const POLL_MS = 30_000;

type Tone = "primary" | "sky" | "violet" | "emerald" | "amber";

const TONE_STYLES: Record<
  Tone,
  { iconBg: string; ring: string; bar: string; text: string }
> = {
  primary: {
    iconBg: "bg-primary/10 text-primary",
    ring: "hover:border-primary/40",
    bar: "bg-primary",
    text: "text-primary",
  },
  sky: {
    iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    ring: "hover:border-sky-500/40",
    bar: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-400",
  },
  violet: {
    iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    ring: "hover:border-violet-500/40",
    bar: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-400",
  },
  emerald: {
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    ring: "hover:border-emerald-500/40",
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    ring: "hover:border-amber-500/40",
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
};

function formatHours(h?: number) {
  const v = h ?? 0;
  if (Number.isInteger(v)) return `${v}h`;
  return `${v.toFixed(2).replace(/\.?0+$/, "")}h`;
}

export default function DashboardHome() {
  usePageTitle("Dashboard");
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const d = await res.json();
        if (res.ok) setSession(d.user);
      } catch {}
    })();
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const d = await res.json();
      if (res.ok) {
        setData(d);
        setLastUpdated(new Date());
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const firstName = session?.name?.split(" ")[0] ?? "there";
  const role = data?.role ?? session?.role;
  const isUser = role === "user";
  const canManage = role === "admin" || role === "project_manager";

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isUser
              ? "Here's what's assigned to you and your time this week."
              : "Real-time pulse across your workspace."}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString()}`
            : "Loading…"}
        </div>
      </section>

      <RunningTimerCard />

      <section
        className={cn(
          "grid gap-4 sm:grid-cols-2",
          canManage ? "lg:grid-cols-4" : "lg:grid-cols-3"
        )}
      >
        <StatCard
          tone="primary"
          icon={FolderKanban}
          label={isUser ? "My projects" : "Projects"}
          value={data?.counts.projects}
          sub={
            canManage
              ? `${data?.counts.projectsActive ?? 0} active`
              : "Assigned to you"
          }
          href="/dashboard/projects"
          loading={loading}
        />
        <StatCard
          tone="sky"
          icon={ListChecks}
          label={isUser ? "My tasks" : "Tasks"}
          value={data?.counts.tasks}
          sub={
            isUser
              ? `${data?.counts.tasksOpen ?? 0} open · ${data?.counts.tasksDone ?? 0} done`
              : "All tasks"
          }
          href="/dashboard/tasks"
          loading={loading}
        />
        {canManage && (
          <StatCard
            tone="violet"
            icon={Users}
            label="Users"
            value={data?.counts.users}
            sub={`${data?.counts.usersActive ?? 0} active`}
            href="/dashboard/users"
            loading={loading}
          />
        )}
        <HoursStatCard
          tone="emerald"
          weekHours={data?.counts.hoursWeek}
          totalHours={data?.counts.hoursTotal}
          loading={loading}
          isUser={isUser}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-6 lg:grid-flow-row-dense [&>div]:h-full">
        <div className="lg:col-span-4 lg:row-span-2">
          <Panel
            title={isUser ? "My tasks" : "Recent tasks"}
            href="/dashboard/tasks"
            empty="No tasks yet"
            loading={loading}
            items={data?.recentTasks ?? []}
            render={(t) => (
              <Link
                key={t._id}
                href={
                  t.project
                    ? `/dashboard/projects/${t.project._id}?task=${t._id}`
                    : "#"
                }
                className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
              >
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {t.title}
                  </span>
                  {t.project && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.project.name}
                    </span>
                  )}
                </span>
                <TaskStatusBadge status={t.status} />
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {relTime(t.updatedAt)}
                </span>
              </Link>
            )}
          />
        </div>

        <div className="lg:col-span-2">
          <Panel
            title={isUser ? "My projects" : "Recent projects"}
            href="/dashboard/projects"
            empty="No projects yet"
            loading={loading}
            items={data?.recentProjects ?? []}
            render={(p) => (
              <Link
                key={p._id}
                href={`/dashboard/projects/${p._id}`}
                className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
              >
                <span className="rounded-md border bg-muted/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {p.projectId}
                </span>
                <span className="flex-1 truncate text-sm font-medium">
                  {p.name}
                </span>
                <StatusBadge status={p.status} />
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {relTime(p.updatedAt)}
                </span>
              </Link>
            )}
          />
        </div>

        <div className="lg:col-span-2">
          <StatusDonutChart
            breakdown={data?.statusBreakdown}
            loading={loading}
          />
        </div>

        <div className="lg:col-span-3">
          <HoursTrendChart
            data={data?.hoursByDay ?? []}
            loading={loading}
            isUser={isUser}
          />
        </div>

        <div className="lg:col-span-3">
          <StatusDistributionCard
            breakdown={data?.statusBreakdown}
            loading={loading}
          />
        </div>

        {canManage ? (
          <>
            <div className="lg:col-span-2">
              <TopLoggersCard
                loggers={data?.topLoggers ?? []}
                loading={loading}
              />
            </div>
            <div className="lg:col-span-4">
              <TeamCard
                roleBreakdown={data?.roleBreakdown}
                recentUsers={data?.recentUsers ?? []}
                loading={loading}
              />
            </div>
          </>
        ) : (
          <div className="lg:col-span-6">
            <RecentLogsCard
              logs={data?.recentLogs ?? []}
              loading={loading}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function HoursTrendChart({
  data,
  loading,
  isUser,
}: {
  data: HoursByDay[];
  loading: boolean;
  isUser: boolean;
}) {
  const totalWeek = data.reduce((s, d) => s + d.hours, 0);
  const peak = Math.max(0, ...data.map((d) => d.hours));
  return (
    <div className="flex h-full flex-col rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-base font-semibold">
            {isUser ? "My hours" : "Hours logged"}
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">Last 7 days</span>
      </div>
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : totalWeek === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-1 text-center">
          <Clock className="size-5 text-muted-foreground/60" />
          <p className="text-sm font-medium">No hours yet</p>
          <p className="text-xs text-muted-foreground">
            Logged time will show up as a daily trend.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums">
              {formatHours(totalWeek)}
            </span>
            <span className="text-xs text-muted-foreground">
              total · peak {formatHours(peak)}
            </span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
                barCategoryGap="20%"
              >
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={28}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                    padding: "6px 10px",
                  }}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  formatter={(v: number) => [`${v}h`, "Hours"]}
                />
                <Bar
                  dataKey="hours"
                  fill="oklch(0.7 0.18 160)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<TaskStatusKey, string> = {
  backlog: "oklch(0.7 0.02 250)",
  todo: "oklch(0.7 0.18 240)",
  in_progress: "oklch(0.75 0.18 70)",
  in_review: "oklch(0.7 0.18 300)",
  qa: "oklch(0.7 0.16 200)",
  done: "oklch(0.7 0.18 160)",
};

function StatusDonutChart({
  breakdown,
  loading,
}: {
  breakdown: Record<string, number> | undefined;
  loading: boolean;
}) {
  const keys: TaskStatusKey[] = [
    "backlog",
    "todo",
    "in_progress",
    "in_review",
    "qa",
    "done",
  ];
  const data = keys
    .map((k) => ({
      name: TASK_STATUS_STYLES[k].label,
      key: k,
      value: breakdown?.[k] ?? 0,
    }))
    .filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex h-full flex-col rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-sky-600 dark:text-sky-400" />
          <h2 className="text-base font-semibold">Task distribution</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {total > 0 ? `${total} tasks` : ""}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : total === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-1 text-center">
          <ListChecks className="size-5 text-muted-foreground/60" />
          <p className="text-sm font-medium">No tasks yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto] items-center gap-4">
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                    padding: "6px 10px",
                  }}
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((d) => (
                    <Cell key={d.key} fill={STATUS_COLORS[d.key]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 text-xs">
            {data.map((d) => {
              const pct = Math.round((d.value / total) * 100);
              return (
                <li key={d.key} className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: STATUS_COLORS[d.key] }}
                  />
                  <span className="font-medium">{d.name}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {d.value} · {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  href,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  label: string;
  value: number | undefined;
  sub: string;
  href: string;
  loading: boolean;
}) {
  const t = TONE_STYLES[tone];
  return (
    <Link href={href} className="group">
      <div
        className={cn(
          "flex h-full items-center gap-3 rounded-xl border bg-card p-3.5 transition-colors",
          t.ring
        )}
      >
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            t.iconBg
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">{label}</div>
          <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
        </div>
        <div className="text-2xl font-bold tracking-tight tabular-nums">
          {loading ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            (value ?? 0).toLocaleString()
          )}
        </div>
        <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </Link>
  );
}

function HoursStatCard({
  tone,
  weekHours,
  totalHours,
  loading,
  isUser,
}: {
  tone: Tone;
  weekHours: number | undefined;
  totalHours: number | undefined;
  loading: boolean;
  isUser: boolean;
}) {
  const t = TONE_STYLES[tone];
  return (
    <div
      className={cn(
        "flex h-full items-center gap-3 rounded-xl border bg-card p-3.5 transition-all",
        t.ring
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          t.iconBg
        )}
      >
        <Clock className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">
          {isUser ? "My hours" : "Hours logged"}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {loading ? "" : `${formatHours(totalHours)} all time`}
        </p>
      </div>
      <div className="text-2xl font-bold tracking-tight tabular-nums">
        {loading ? (
          <Skeleton className="h-7 w-14" />
        ) : (
          formatHours(weekHours)
        )}
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        Week
      </span>
    </div>
  );
}

function StatusDistributionCard({
  breakdown,
  loading,
  className,
}: {
  breakdown: Record<string, number> | undefined;
  loading: boolean;
  className?: string;
}) {
  const keys: TaskStatusKey[] = [
    "backlog",
    "todo",
    "in_progress",
    "in_review",
    "qa",
    "done",
  ];
  const total = keys.reduce((sum, k) => sum + (breakdown?.[k] ?? 0), 0) || 1;
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border bg-card p-5",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Task pipeline</h2>
        <Link
          href="/dashboard/tasks"
          className="text-xs text-muted-foreground hover:text-primary"
        >
          View all
        </Link>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {keys.map((k) => {
            const n = breakdown?.[k] ?? 0;
            const pct = Math.round((n / total) * 100);
            return (
              <li key={k} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        TASK_STATUS_STYLES[k].dot
                      )}
                    />
                    <span className="font-medium">
                      {TASK_STATUS_STYLES[k].label}
                    </span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {n} <span className="text-muted-foreground/60">·</span> {pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      TASK_STATUS_STYLES[k].dot
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TopLoggersCard({
  loggers,
  loading,
}: {
  loggers: TopLogger[];
  loading: boolean;
}) {
  const max = Math.max(1, ...loggers.map((l) => l.total));
  return (
    <div className="flex h-full flex-col rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-base font-semibold">Top contributors</h2>
        </div>
        <span className="text-xs text-muted-foreground">This week</span>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : loggers.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <Clock className="size-5 text-muted-foreground/60" />
          <p className="text-sm font-medium">No time logged</p>
          <p className="text-xs text-muted-foreground">
            Hours show up here once team members start logging time.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {loggers.map((u) => {
            const pct = Math.round((u.total / max) * 100);
            return (
              <li key={u.userId} className="flex items-center gap-3">
                <UserInitialsAvatar
                  name={u.name}
                  role={u.role}
                  className="size-8 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {u.name}
                    </span>
                    <span className="tabular-nums text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatHours(u.total)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TeamCard({
  roleBreakdown,
  recentUsers,
  loading,
}: {
  roleBreakdown: Record<string, number> | undefined;
  recentUsers: UserRow[];
  loading: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-violet-600 dark:text-violet-400" />
          <h2 className="text-base font-semibold">Team</h2>
        </div>
        <Link
          href="/dashboard/users"
          className="text-xs text-muted-foreground hover:text-primary"
        >
          View all
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <RoleStat
          label="Admins"
          count={roleBreakdown?.admin ?? 0}
          loading={loading}
        />
        <RoleStat
          label="PMs"
          count={roleBreakdown?.project_manager ?? 0}
          loading={loading}
        />
        <RoleStat
          label="Users"
          count={roleBreakdown?.user ?? 0}
          loading={loading}
        />
      </div>
      <div className="mt-4 border-t border-border/40 pt-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recently added
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : recentUsers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No users yet.</p>
        ) : (
          <ul className="space-y-2">
            {recentUsers.slice(0, 4).map((u) => (
              <li key={u._id} className="flex items-center gap-2.5">
                <UserInitialsAvatar
                  name={u.name}
                  role={u.role}
                  className="size-7 text-[10px]"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{u.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {u.email}
                  </div>
                </div>
                <RoleBadge role={u.role} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RoleStat({
  label,
  count,
  loading,
}: {
  label: string;
  count: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-bold tabular-nums">
        {loading ? <Skeleton className="h-6 w-8" /> : count}
      </div>
    </div>
  );
}

function RecentLogsCard({
  logs,
  loading,
}: {
  logs: LogLite[];
  loading: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-base font-semibold">Recent time logs</h2>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <Clock className="size-5 text-muted-foreground/60" />
          <p className="text-sm font-medium">No logs yet</p>
          <p className="text-xs text-muted-foreground">
            Open a project and click Logs → Add log to record time.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {logs.map((l) => (
            <li
              key={l._id}
              className="flex items-center gap-3 rounded-md border border-border/40 bg-background px-3 py-2"
            >
              <span className="inline-flex shrink-0 items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatHours(l.hours)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {l.task ? l.task.title : "Project (general)"}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {l.project?.name ?? "—"}
                  {" · "}
                  <span className="font-mono">
                    {l.startTime}–{l.endTime}
                  </span>
                </div>
              </div>
              <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
                {relTime(l.date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Panel<T extends { _id: string }>({
  title,
  href,
  items,
  empty,
  loading,
  render,
}: {
  title: string;
  href: string;
  items: T[];
  empty: string;
  loading: boolean;
  render: (item: T) => React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <Link
          href={href}
          className="text-xs text-muted-foreground hover:text-primary"
        >
          View all
        </Link>
      </div>
      <div className="flex-1 p-2">
        {loading ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="flex flex-col">{items.map(render)}</ul>
        )}
      </div>
    </div>
  );
}

function relTime(iso?: string) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

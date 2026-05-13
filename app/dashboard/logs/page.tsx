"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Download,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/date-picker";
import { UserInitialsAvatar } from "@/components/role-status-badge";
import { cn } from "@/lib/utils";
import { type UserRole } from "@/lib/roles";
import { usePageTitle } from "@/hooks/use-page-title";

type UserLite = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

type ProjectLite = {
  _id: string;
  name: string;
  projectId: string;
};

type TaskLite = {
  _id: string;
  title: string;
  taskId?: string | null;
};

type Log = {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  note?: string;
  manualTaskTitle?: string;
  user: UserLite | null;
  project: ProjectLite | null;
  task: TaskLite | null;
  createdAt?: string;
};

type Session = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

const controlClasses =
  "shadow-none border-border bg-background focus-visible:ring-primary/30 focus-visible:border-primary/60";

function formatHours(h: number) {
  if (Number.isInteger(h)) return `${h}h`;
  return `${h.toFixed(2).replace(/\.?0+$/, "")}h`;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function to12h(t: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(t || "");
  if (!m) return t;
  const h = parseInt(m[1], 10);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${m[2]} ${period}`;
}

export default function LogsPage() {
  usePageTitle("Logs");
  const [session, setSession] = useState<Session | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);

  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const PAGE_SIZE = 25;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);

  const isManager =
    session?.role === "admin" || session?.role === "project_manager";
  const isUser = session?.role === "user";

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const d = await res.json();
        if (res.ok) setSession(d.user);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/projects?limit=100");
        const d = await res.json();
        if (res.ok) setProjects(d.projects ?? []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!isManager) return;
    (async () => {
      try {
        const res = await fetch("/api/users?limit=200");
        const d = await res.json();
        if (res.ok) setUsers(d.users ?? []);
      } catch {}
    })();
  }, [isManager]);

  const fetchLogsPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(PAGE_SIZE),
        });
        if (debouncedQuery) params.set("q", debouncedQuery);
        if (projectFilter !== "all") params.set("project", projectFilter);
        if (isManager && userFilter !== "all") params.set("user", userFilter);
        if (dateFrom) params.set("dateFrom", dateFrom.toISOString());
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          params.set("dateTo", end.toISOString());
        }

        const res = await fetch(`/api/logs?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load logs");
        const fetched: Log[] = data.logs ?? [];
        setLogs((prev) => (append ? [...prev, ...fetched] : fetched));
        setTotal(data.total ?? 0);
        setTotalHours(data.totalHours ?? 0);
        const totalPages = Math.max(
          1,
          Math.ceil((data.total ?? 0) / PAGE_SIZE)
        );
        setHasMore(pageNum < totalPages);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load logs");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, projectFilter, userFilter, dateFrom, dateTo, isManager]
  );

  useEffect(() => {
    pageRef.current = 1;
    fetchLogsPage(1, false);
  }, [fetchLogsPage]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          pageRef.current += 1;
          fetchLogsPage(pageRef.current, true);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, fetchLogsPage]);

  const hasFilters =
    Boolean(debouncedQuery) ||
    projectFilter !== "all" ||
    userFilter !== "all" ||
    !!dateFrom ||
    !!dateTo;

  function clearFilters() {
    setQuery("");
    setProjectFilter("all");
    setUserFilter("all");
    setDateFrom(null);
    setDateTo(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Logs</h1>
      </div>

      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">
            {isUser ? "My logs" : "All logs"}
          </h2>
          <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {loading ? "…" : `${total} total`}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            <Clock className="size-3" />
            {loading ? "…" : formatHours(totalHours)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center">
          <InputGroup
            className={`col-span-2 h-9 sm:col-span-4 lg:w-64 ${controlClasses}`}
          >
            <InputGroupAddon>
              <Search className="text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search task or note"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-sm"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger
              className={`col-span-2 w-full sm:col-span-2 lg:w-48 ${controlClasses}`}
            >
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isManager && (
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger
                className={`col-span-2 w-full sm:col-span-2 lg:w-48 ${controlClasses}`}
              >
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DatePicker
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="From"
            className="w-full lg:w-40"
          />
          <DatePicker
            value={dateTo}
            onChange={setDateTo}
            placeholder="To"
            className="w-full lg:w-40"
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="col-span-1 h-9 text-muted-foreground hover:text-foreground lg:ml-auto"
            >
              <X className="mr-1 size-4" /> Clear
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="col-span-2 h-9 w-full sm:col-span-1 sm:w-auto"
            disabled={exporting || total === 0}
            onClick={async () => {
              setExporting(true);
              try {
                const params = new URLSearchParams();
                if (debouncedQuery) params.set("q", debouncedQuery);
                if (projectFilter !== "all")
                  params.set("project", projectFilter);
                if (isManager && userFilter !== "all")
                  params.set("user", userFilter);
                if (dateFrom)
                  params.set("dateFrom", dateFrom.toISOString());
                if (dateTo) {
                  const end = new Date(dateTo);
                  end.setHours(23, 59, 59, 999);
                  params.set("dateTo", end.toISOString());
                }
                const res = await fetch(
                  `/api/logs/export?${params.toString()}`,
                  { cache: "no-store" }
                );
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.error ?? "Failed to export");
                }
                const blob = await res.blob();
                const filename =
                  res.headers
                    .get("Content-Disposition")
                    ?.match(/filename="?([^"]+)"?/)?.[1] ??
                  `time-logs-${new Date().toISOString().slice(0, 10)}.csv`;
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(blobUrl);
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Failed to export"
                );
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download className="mr-2 size-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-border/40 md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/40 hover:bg-muted/40">
              {isManager && (
                <TableHead className="h-10 w-44 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  User
                </TableHead>
              )}
              <TableHead className="h-10 w-56 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Project
              </TableHead>
              <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Task
              </TableHead>
              <TableHead className="h-10 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Date
              </TableHead>
              <TableHead className="h-10 w-44 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Time
              </TableHead>
              <TableHead className="h-10 w-24 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Duration
              </TableHead>
              <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Note
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow
                  key={i}
                  className="border-border/40 hover:bg-transparent"
                >
                  {isManager && (
                    <TableCell className="px-3 py-2.5">
                      <Skeleton className="h-7 w-32" />
                    </TableCell>
                  )}
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={isManager ? 7 : 6}
                  className="h-40"
                >
                  <EmptyState
                    hasFilters={hasFilters}
                    onClear={clearFilters}
                    isUser={isUser}
                  />
                </TableCell>
              </TableRow>
            ) : (
              logs.map((l) => (
                <TableRow
                  key={l._id}
                  className="border-border/40 hover:bg-muted/20"
                >
                  {isManager && (
                    <TableCell className="px-3 py-2.5">
                      {l.user ? (
                        <div className="flex items-center gap-2">
                          <UserInitialsAvatar
                            name={l.user.name}
                            role={l.user.role}
                            className="size-7 text-[10px]"
                          />
                          <span className="truncate text-sm font-medium">
                            {l.user.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="px-3 py-2.5">
                    {l.project ? (
                      <Link
                        href={`/dashboard/projects/${l.project._id}`}
                        className="text-sm hover:text-primary hover:underline"
                      >
                        <span className="truncate">{l.project.name}</span>
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-sm">
                    {l.task && l.project ? (
                      <Link
                        href={`/dashboard/projects/${l.project._id}?task=${l.task._id}`}
                        className="hover:text-primary hover:underline"
                      >
                        <span className="truncate">{l.task.title}</span>
                      </Link>
                    ) : l.manualTaskTitle ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="truncate">{l.manualTaskTitle}</span>
                        <span className="rounded border px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          manual
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Project (general)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(l.date)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 font-mono text-sm text-muted-foreground whitespace-nowrap">
                    {to12h(l.startTime)}
                    <span className="px-1">–</span>
                    {to12h(l.endTime)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatHours(l.hours)}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                    <span className="line-clamp-2">{l.note || "—"}</span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden">
        {loading ? (
          <div className="divide-y rounded-lg border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2 p-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border p-4">
            <EmptyState
              hasFilters={hasFilters}
              onClear={clearFilters}
              isUser={isUser}
            />
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {logs.map((l) => (
              <li key={l._id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {l.task
                        ? l.task.title
                        : l.manualTaskTitle
                          ? l.manualTaskTitle
                          : "Project (general)"}
                    </div>
                    {l.project && (
                      <Link
                        href={`/dashboard/projects/${l.project._id}`}
                        className="truncate text-xs text-muted-foreground hover:text-primary hover:underline"
                      >
                        {l.project.name}
                      </Link>
                    )}
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatHours(l.hours)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(l.date)}</span>
                  <span className="text-border">·</span>
                  <span className="font-mono">
                    {to12h(l.startTime)} – {to12h(l.endTime)}
                  </span>
                </div>
                {isManager && l.user && (
                  <div className="flex items-center gap-2 text-xs">
                    <UserInitialsAvatar
                      name={l.user.name}
                      role={l.user.role}
                      className="size-5 text-[9px]"
                    />
                    <span className="font-medium">{l.user.name}</span>
                  </div>
                )}
                {l.note && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {l.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {logs.length > 0 && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-4 text-xs text-muted-foreground"
        >
          {loadingMore
            ? "Loading more…"
            : hasMore
            ? "Scroll for more"
            : `All ${total} logs loaded`}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClear,
  isUser,
}: {
  hasFilters: boolean;
  onClear: () => void;
  isUser: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <Clock className="size-6 text-muted-foreground/60" />
      <p className="text-sm font-semibold">
        {hasFilters ? "No logs match filters" : "No time logs yet"}
      </p>
      <p className="max-w-md text-xs text-muted-foreground">
        {hasFilters
          ? "Try clearing filters or adjusting your search."
          : isUser
          ? "Open a project and use Logs → Add log to record your time."
          : "Logs will show up here once people start tracking time."}
      </p>
      {hasFilters && (
        <Button
          size="sm"
          variant="outline"
          className="mt-1"
          onClick={onClear}
        >
          <X className="mr-1 size-3.5" /> Clear filters
        </Button>
      )}
    </div>
  );
}

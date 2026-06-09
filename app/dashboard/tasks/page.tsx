"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronsUpDown,
  ExternalLink,
  Eye,
  FileText,
  LayoutGrid,
  List as ListIcon,
  Pencil,
  Search,
  Trash2,
  UserCircle2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  TASK_STATUS_STYLES,
  TASK_TYPE_STYLES,
  TaskStatusBadge,
  TaskTypeBadge,
  type TaskStatusKey,
  type TaskTypeKey,
  UserInitialsAvatar,
} from "@/components/role-status-badge";
import { PriorityBadge, PrioritySelect } from "@/components/priority-badge";
import { TagsInput } from "@/components/tags-input";
import { FieldError, FormAlert, RequiredMark } from "@/components/form-error";
import { RichTextEditor, RichTextViewer } from "@/components/rich-text-editor";
import { UserMultiPicker } from "@/components/user-pickers";
import { parseApiError, type FieldErrors } from "@/lib/form-errors";
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

type TaskPriorityKey = "low" | "medium" | "high" | "urgent";

type Task = {
  _id: string;
  taskId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatusKey;
  priority: TaskPriorityKey;
  type: TaskTypeKey;
  tags: string[];
  assignedDate: string | null;
  dueDate: string | null;
  project: ProjectLite | null;
  createdBy: UserLite | null;
  assignees: UserLite[];
  reportingPersons?: UserLite[];
  subtasks?: { _id: string; title: string; completed: boolean }[];
  createdAt?: string;
};

type Session = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

const BOARD_LIMIT = 200;
const STATUS_OPTIONS: { value: "all" | TaskStatusKey; label: string }[] = [
  { value: "all", label: "All status" },
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "in_review", label: "In review" },
  { value: "qa", label: "QA" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: { value: "all" | TaskPriorityKey; label: string }[] = [
  { value: "all", label: "All priority" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const BOARD_COLUMNS: TaskStatusKey[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "qa",
  "done",
];

const STATUS_ROW_BG: Record<TaskStatusKey, string> = {
  backlog: "bg-muted/30",
  todo: "bg-sky-500/5 dark:bg-sky-500/10",
  in_progress: "bg-amber-500/5 dark:bg-amber-500/10",
  in_review: "bg-violet-500/5 dark:bg-violet-500/10",
  qa: "bg-cyan-500/5 dark:bg-cyan-500/10",
  done: "bg-emerald-500/5 dark:bg-emerald-500/10",
};

const controlClasses =
  "shadow-none border-border bg-background focus-visible:ring-primary/30 focus-visible:border-primary/60";

export default function TasksPage() {
  usePageTitle("Tasks");
  const [session, setSession] = useState<Session | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [projects, setProjects] = useState<ProjectLite[]>([]);

  const [view, setView] = useState<"list" | "board">("list");
  // Gate first fetch until view restored from localStorage, else a list-then-board
  // double fetch races and the stale list response can overwrite the board data.
  const [viewReady, setViewReady] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("tasksView") === "board") setView("board");
    setViewReady(true);
  }, []);
  useEffect(() => {
    if (viewReady) localStorage.setItem("tasksView", view);
  }, [view, viewReady]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatusKey>(
    "all",
  );
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriorityKey>(
    "all",
  );
  const [typeFilter, setTypeFilter] = useState<"all" | TaskTypeKey>("all");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 25;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatusKey | null>(null);

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
    pageRef.current = 1;
  }, [
    projectFilter,
    statusFilter,
    priorityFilter,
    typeFilter,
    tagFilter,
    view,
    debouncedQuery,
  ]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (res.ok) setSession(data.user);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/projects?limit=100");
        const data = await res.json();
        if (res.ok) setProjects(data.projects ?? []);
      } catch {}
    })();
  }, []);

  const fetchTasksPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const effectiveLimit = view === "board" ? BOARD_LIMIT : PAGE_SIZE;
        const params = new URLSearchParams({
          page: String(view === "board" ? 1 : pageNum),
          limit: String(effectiveLimit),
        });
        if (debouncedQuery) params.set("q", debouncedQuery);
        if (projectFilter !== "all") params.set("project", projectFilter);
        if (view === "list" && statusFilter !== "all")
          params.set("status", statusFilter);
        if (priorityFilter !== "all") params.set("priority", priorityFilter);
        if (typeFilter !== "all") params.set("type", typeFilter);
        if (tagFilter.trim()) params.set("tag", tagFilter.trim());

        const res = await fetch(`/api/tasks?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load tasks");
        const fetched: Task[] = data.tasks ?? [];
        setTasks((prev) => (append ? [...prev, ...fetched] : fetched));
        setTotal(data.total ?? 0);
        if (view === "board") {
          setHasMore(false);
        } else {
          const totalPages = Math.max(
            1,
            Math.ceil((data.total ?? 0) / effectiveLimit),
          );
          setHasMore(pageNum < totalPages);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load tasks",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      debouncedQuery,
      projectFilter,
      statusFilter,
      priorityFilter,
      typeFilter,
      tagFilter,
      view,
    ],
  );

  useEffect(() => {
    if (!viewReady) return;
    pageRef.current = 1;
    fetchTasksPage(1, false);
  }, [fetchTasksPage, viewReady]);

  useEffect(() => {
    if (view === "board" || !hasMore || loading || loadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          pageRef.current += 1;
          fetchTasksPage(pageRef.current, true);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [view, hasMore, loading, loadingMore, fetchTasksPage]);
  const allTags = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => (t.tags ?? []).forEach((tag) => tag && set.add(tag)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tasks]);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);

  const hasFilters =
    Boolean(debouncedQuery) ||
    projectFilter !== "all" ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    typeFilter !== "all" ||
    tagFilter.trim() !== "";

  function clearFilters() {
    setQuery("");
    setProjectFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setTypeFilter("all");
    setTagFilter("");
  }

  const isUser = session?.role === "user";
  const isAdmin = session?.role === "admin";
  const isManager =
    session?.role === "admin" || session?.role === "project_manager";

  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDeleteTask() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${pendingDelete._id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete task");
      }
      setTasks((ts) => ts.filter((t) => t._id !== pendingDelete._id));
      setTotal((n) => Math.max(0, n - 1));
      toast.success("Task deleted");
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setDeleting(false);
    }
  }

  const permsFor = useCallback(
    (t: Task) => {
      const uid = session?._id;
      const isCreator = !!uid && t.createdBy?._id === uid;
      const isAssignee =
        !!uid && (t.assignees ?? []).some((a) => a._id === uid);
      const canEdit = isManager || isCreator;
      const canMove = canEdit || isAssignee;
      return { canEdit, canMove };
    },
    [session, isManager],
  );

  async function moveTask(taskId: string, newStatus: TaskStatusKey) {
    const existing = tasks.find((t) => t._id === taskId);
    if (!existing || existing.status === newStatus) return;

    const { canMove } = permsFor(existing);
    if (!canMove) {
      toast.error("You don't have permission to move this task");
      return;
    }

    if (newStatus === "done") {
      const subs = existing.subtasks ?? [];
      if (subs.length > 0 && subs.some((s) => !s.completed)) {
        toast.error("Complete all subtasks before marking task done");
        return;
      }
    }

    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)),
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setTasks(prev);
        const data = await res.json();
        toast.error(data.error || "Failed to update status");
      }
    } catch (err) {
      setTasks(prev);
      toast.error(
        err instanceof Error ? err.message : "Failed to update status",
      );
    }
  }

  const [viewOpen, setViewOpen] = useState(false);
  const [viewTask, setViewTask] = useState<Task | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatusKey>("todo");
  const [editPriority, setEditPriority] = useState<TaskPriorityKey>("medium");
  const [editType, setEditType] = useState<TaskTypeKey>("new");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editAssigned, setEditAssigned] = useState<Date | null>(null);
  const [editDue, setEditDue] = useState<Date | null>(null);
  const [editAssignees, setEditAssignees] = useState<UserLite[]>([]);
  const [editReporting, setEditReporting] = useState<UserLite[]>([]);
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editAlert, setEditAlert] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  function openViewTask(t: Task) {
    setViewTask(t);
    setViewOpen(true);
  }

  function openEditTask(t: Task) {
    setEditTask(t);
    setEditTitle(t.title);
    setEditDesc(t.description ?? "");
    setEditStatus(t.status);
    setEditPriority(t.priority ?? "medium");
    setEditType(t.type ?? "new");
    setEditTags(t.tags ?? []);
    setEditAssigned(t.assignedDate ? new Date(t.assignedDate) : null);
    setEditDue(t.dueDate ? new Date(t.dueDate) : null);
    setEditAssignees(t.assignees ?? []);
    setEditReporting(t.reportingPersons ?? []);
    setEditErrors({});
    setEditAlert(null);
    setEditOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTask) return;
    setEditAlert(null);
    const errs: FieldErrors = {};
    if (editTitle.trim().length < 2)
      errs.title = "Title must be at least 2 characters";
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }
    setEditErrors({});
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${editTask._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDesc,
          status: editStatus,
          priority: editPriority,
          type: editType,
          tags: editTags,
          assignedDate: editAssigned ? editAssigned.toISOString() : null,
          dueDate: editDue ? editDue.toISOString() : null,
          assignees: editAssignees.map((u) => u._id),
          reportingPersons: editReporting.map((u) => u._id),
        }),
      });
      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        if (Object.keys(fieldErrors).length > 0) setEditErrors(fieldErrors);
        else setEditAlert(message);
        return;
      }
      const data = await res.json();
      const updated = data.task as Task | undefined;
      if (updated) {
        setTasks((ts) =>
          ts.map((x) => (x._id === editTask._id ? { ...x, ...updated } : x)),
        );
      }
      toast.success("Task updated");
      setEditOpen(false);
      setEditTask(null);
    } catch (err) {
      setEditAlert(err instanceof Error ? err.message : "Request failed");
    } finally {
      setEditSubmitting(false);
    }
  }

  const boardTasks = useMemo(() => {
    const map: Record<TaskStatusKey, Task[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      in_review: [],
      qa: [],
      done: [],
    };
    for (const t of tasks) map[t.status]?.push(t);
    return map;
  }, [tasks]);

  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        view === "board" && "h-[calc(100vh-7.5rem)]",
      )}
    >
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tasks</h1>
      </div>

      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">
            {isUser ? "My tasks" : "All tasks"}
          </h2>
          <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {loading ? "…" : `${total} total`}
          </span>
          <div className="ml-auto inline-flex overflow-hidden rounded-md border bg-background sm:ml-0">
            <button
              type="button"
              onClick={() => setView("board")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 text-xs",
                view === "board"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <LayoutGrid className="size-3.5" /> Board
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 border-l px-2.5 py-1.5 text-xs",
                view === "list"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <ListIcon className="size-3.5" /> List
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center">
          <InputGroup
            className={`col-span-2 h-9 sm:col-span-4 lg:w-72 ${controlClasses}`}
          >
            <InputGroupAddon>
              <Search className="text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search task title"
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
          {view === "list" && (
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "all" | TaskStatusKey)}
            >
              <SelectTrigger
                className={`col-span-2 w-full sm:col-span-2 lg:w-40 ${controlClasses}`}
              >
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={priorityFilter}
            onValueChange={(v) =>
              setPriorityFilter(v as "all" | TaskPriorityKey)
            }
          >
            <SelectTrigger
              className={`w-full sm:col-span-2 lg:w-40 ${controlClasses}`}
            >
              <SelectValue placeholder="All priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as "all" | TaskTypeKey)}
          >
            <SelectTrigger
              className={`w-full sm:col-span-2 lg:w-36 ${controlClasses}`}
            >
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(TASK_TYPE_STYLES) as TaskTypeKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {TASK_TYPE_STYLES[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={tagFilterOpen}
                className={`col-span-2 h-9 w-full justify-between font-normal sm:col-span-4 lg:w-36 ${controlClasses} ${tagFilter ? "" : "text-muted-foreground"}`}
              >
                <span className="truncate">{tagFilter || "All tags"}</span>
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search tag…" />
                <CommandList>
                  <CommandEmpty>No tags found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__all__"
                      onSelect={() => {
                        setTagFilter("");
                        setTagFilterOpen(false);
                      }}
                    >
                      <Check
                        className={`mr-2 size-4 ${tagFilter === "" ? "opacity-100" : "opacity-0"}`}
                      />
                      All tags
                    </CommandItem>
                    {allTags.map((tag) => (
                      <CommandItem
                        key={tag}
                        value={tag}
                        onSelect={(v) => {
                          setTagFilter(v === tagFilter ? "" : v);
                          setTagFilterOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 size-4 ${tagFilter === tag ? "opacity-100" : "opacity-0"}`}
                        />
                        <span className="truncate">{tag}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="col-span-2 h-9 text-muted-foreground hover:text-foreground sm:col-span-4 lg:col-auto lg:ml-auto"
            >
              <X className="mr-1 size-4" /> Clear
            </Button>
          )}
        </div>
      </div>

      {view === "board" ? (
        <BoardView
          loading={loading}
          boardTasks={boardTasks}
          draggingId={draggingId}
          dragOverCol={dragOverCol}
          setDraggingId={setDraggingId}
          setDragOverCol={setDragOverCol}
          moveTask={moveTask}
          openEditTask={openEditTask}
          openViewTask={openViewTask}
          permsFor={permsFor}
          isAdmin={isAdmin}
          onDelete={setPendingDelete}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border/40 md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Title
                  </TableHead>
                  <TableHead className="h-10 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="h-10 w-28 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Priority
                  </TableHead>
                  <TableHead className="h-10 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="h-10 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Due
                  </TableHead>
                  <TableHead className="h-10 w-56 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Project
                  </TableHead>
                  <TableHead className="h-10 w-36 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Assignees
                  </TableHead>
                  <TableHead className="h-10 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Created by
                  </TableHead>
                  <TableHead className="h-10 w-12 px-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow
                      key={i}
                      className="border-border/40 hover:bg-transparent"
                    >
                      <TableCell className="px-3 py-2.5">
                        <Skeleton className="h-4 w-56" />
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Skeleton className="h-7 w-24 rounded-full" />
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell className="px-3 py-2.5" />
                    </TableRow>
                  ))
                ) : tasks.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="h-40">
                      <EmptyState
                        hasFilters={hasFilters}
                        onClear={clearFilters}
                        isUser={isUser}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((t) => {
                    const { canEdit } = permsFor(t);
                    return (
                      <TableRow
                        key={t._id}
                        className={cn(
                          "border-border/40 hover:bg-transparent",
                          STATUS_ROW_BG[t.status],
                        )}
                      >
                        <TableCell className="px-3 py-2.5 text-sm font-medium">
                          <div className="group/title flex items-center gap-2 ">
                            {t.project ? (
                              <Link
                                href={`/dashboard/projects/${t.project._id}?task=${t._id}`}
                                className="hover:text-primary hover:underline line-clamp-2 whitespace-pre-wrap break-words"
                                title="Open in project"
                              >
                                {t.title}
                              </Link>
                            ) : (
                              <span>{t.title}</span>
                            )}
                            <button
                              type="button"
                              aria-label="View task"
                              title="View task"
                              onClick={() => openViewTask(t)}
                              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-primary group-hover/title:opacity-100"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                aria-label="Edit task"
                                title="Edit task"
                                onClick={() => openEditTask(t)}
                                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-primary group-hover/title:opacity-100"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                aria-label="Delete task"
                                title="Delete task"
                                onClick={() => setPendingDelete(t)}
                                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/title:opacity-100"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                          {(t.tags ?? []).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(t.tags ?? []).slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center rounded-full border bg-muted/40 px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                              {(t.tags ?? []).length > 3 && (
                                <span className="inline-flex items-center rounded-full border bg-muted/40 px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                                  +{(t.tags ?? []).length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          <InlineStatusSelect
                            task={t}
                            canMove={permsFor(t).canMove}
                            onChange={(s) => moveTask(t._id, s)}
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          <PriorityBadge priority={t.priority} />
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          <TaskTypeBadge type={t.type ?? "new"} />
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-xs">
                          <DueLabel
                            due={t.dueDate}
                            isDone={t.status === "done"}
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          {t.project ? (
                            <Link
                              href={`/dashboard/projects/${t.project._id}`}
                              className="flex items-center gap-2 text-sm hover:text-primary hover:underline"
                            >
                              <span className="rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                {t.project.projectId}
                              </span>
                              <span className="truncate">{t.project.name}</span>
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          <AssigneeStack assignees={t.assignees} />
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                          {t.createdBy?.name ?? "—"}
                          {!!session?._id &&
                            t.createdBy?._id === session._id && (
                              <span className="ml-1 text-xs text-primary">
                                (you)
                              </span>
                            )}
                        </TableCell>
                        <TableCell className="px-3 py-2.5" />
                      </TableRow>
                    );
                  })
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
            ) : tasks.length === 0 ? (
              <div className="rounded-lg border p-4">
                <EmptyState
                  hasFilters={hasFilters}
                  onClear={clearFilters}
                  isUser={isUser}
                />
              </div>
            ) : (
              <ul className="divide-y rounded-lg border">
                {tasks.map((t) => {
                  const { canEdit: canDel } = permsFor(t);
                  return (
                    <li
                      key={t._id}
                      className={cn(
                        "flex flex-col gap-2 p-4",
                        STATUS_ROW_BG[t.status],
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {t.project ? (
                          <Link
                            href={`/dashboard/projects/${t.project._id}?task=${t._id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {t.title}
                          </Link>
                        ) : (
                          <span className="font-medium">{t.title}</span>
                        )}
                        {canDel && (
                          <button
                            type="button"
                            aria-label="Delete task"
                            title="Delete task"
                            onClick={() => setPendingDelete(t)}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <TaskStatusBadge status={t.status} />
                        {t.project && (
                          <Link
                            href={`/dashboard/projects/${t.project._id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {t.project.name}
                          </Link>
                        )}
                        <span>· {formatDate(t.createdAt)}</span>
                      </div>
                      <AssigneeStack assignees={t.assignees} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {tasks.length > 0 && (
            <div
              ref={sentinelRef}
              className="flex items-center justify-center py-4 text-xs text-muted-foreground"
            >
              {loadingMore
                ? "Loading more…"
                : hasMore
                  ? "Scroll for more"
                  : `All ${total} tasks loaded`}
            </div>
          )}
        </>
      )}

      <ViewTaskDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        task={viewTask}
        onEdit={(t) => {
          setViewOpen(false);
          openEditTask(t);
        }}
        canEdit={viewTask ? permsFor(viewTask).canEdit : false}
      />

      <EditTaskDialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditTask(null);
        }}
        task={editTask}
        title={editTitle}
        setTitle={setEditTitle}
        desc={editDesc}
        setDesc={setEditDesc}
        status={editStatus}
        setStatus={setEditStatus}
        priority={editPriority}
        setPriority={setEditPriority}
        taskType={editType}
        setTaskType={setEditType}
        tags={editTags}
        setTags={setEditTags}
        assignedDate={editAssigned}
        setAssignedDate={setEditAssigned}
        dueDate={editDue}
        setDueDate={setEditDue}
        assignees={editAssignees}
        setAssignees={setEditAssignees}
        reporting={editReporting}
        setReporting={setEditReporting}
        errors={editErrors}
        setErrors={setEditErrors}
        alertMsg={editAlert}
        submitting={editSubmitting}
        onSubmit={handleSaveEdit}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.title}" will be permanently deleted. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteTask();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BoardView({
  loading,
  boardTasks,
  draggingId,
  dragOverCol,
  setDraggingId,
  setDragOverCol,
  moveTask,
  openEditTask,
  openViewTask,
  permsFor,
  isAdmin,
  onDelete,
}: {
  loading: boolean;
  boardTasks: Record<TaskStatusKey, Task[]>;
  draggingId: string | null;
  dragOverCol: TaskStatusKey | null;
  setDraggingId: (v: string | null) => void;
  setDragOverCol: (
    v:
      | TaskStatusKey
      | null
      | ((c: TaskStatusKey | null) => TaskStatusKey | null),
  ) => void;
  moveTask: (taskId: string, newStatus: TaskStatusKey) => void;
  openEditTask: (t: Task) => void;
  openViewTask: (t: Task) => void;
  permsFor: (t: Task) => { canEdit: boolean; canMove: boolean };
  isAdmin: boolean;
  onDelete: (t: Task) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-md" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex-1 min-h-0 overflow-x-auto">
      <div className="flex h-full gap-3 py-2 min-w-max">
        {BOARD_COLUMNS.map((col) => {
          const colTasks = boardTasks[col];
          const style = TASK_STATUS_STYLES[col];
          const isOver = dragOverCol === col;
          return (
            <div
              key={col}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCol(col);
              }}
              onDragLeave={() => setDragOverCol((c) => (c === col ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingId) moveTask(draggingId, col);
                setDraggingId(null);
                setDragOverCol(null);
              }}
              className={cn(
                "flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-lg border bg-muted/30",
                isOver && "ring-2 ring-primary/40",
              )}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 px-2.5 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", style.dot)} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    {style.label}
                  </span>
                </div>
                <span className="rounded-full border bg-background px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                  {colTasks.length}
                </span>
              </div>
              <div className="flex flex-1 min-h-0 flex-col gap-1.5 overflow-y-auto p-1.5">
                {colTasks.length === 0 ? (
                  <div className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
                    Drop tasks here
                  </div>
                ) : (
                  colTasks.map((t) => {
                    const { canEdit, canMove } = permsFor(t);
                    return (
                      <BoardCard
                        key={t._id}
                        task={t}
                        dragging={draggingId === t._id}
                        canEdit={canEdit}
                        canMove={canMove}
                        canDelete={canEdit}
                        onEdit={() => openEditTask(t)}
                        onView={() => openViewTask(t)}
                        onDelete={() => onDelete(t)}
                        onDragStart={() => setDraggingId(t._id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverCol(null);
                        }}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({
  task,
  dragging,
  canEdit,
  canMove,
  canDelete,
  onEdit,
  onView,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  dragging: boolean;
  canEdit: boolean;
  canMove: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const href = task.project
    ? `/dashboard/projects/${task.project._id}?task=${task._id}`
    : `#`;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView();
        }
      }}
      draggable={canMove}
      onDragStart={(e) => {
        if (!canMove) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task._id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group select-none rounded-lg border p-2.5 shadow-sm transition-all hover:shadow-md",
        TASK_STATUS_STYLES[task.status].card,
        canMove ? "cursor-grab" : "cursor-pointer",
        dragging && "opacity-40 cursor-grabbing",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {task.project ? (
            <span className="rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {task.project.projectId}
            </span>
          ) : null}
          <PriorityBadge priority={task.priority} />
        </div>
        <div className="flex items-center gap-0.5">
          {canEdit ? (
            <button
              type="button"
              aria-label="Edit task"
              title="Edit task"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit();
              }}
              draggable={false}
              onDragStart={(e) => e.stopPropagation()}
              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-primary group-hover:opacity-100"
            >
              <Pencil className="size-3.5" />
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              aria-label="Delete task"
              title="Delete task"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
              draggable={false}
              onDragStart={(e) => e.stopPropagation()}
              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      {task.project ? (
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => e.preventDefault()}
          draggable={false}
          title="Open in project"
          className="block text-sm font-semibold leading-snug line-clamp-2 hover:text-primary hover:underline"
        >
          {task.title}
        </Link>
      ) : (
        <div className="text-sm font-semibold leading-snug line-clamp-2">
          {task.title}
        </div>
      )}
      {(task.assignedDate || task.dueDate) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          {task.assignedDate ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="size-3" />
              <span className="font-medium text-foreground/80">Start</span>
              <span>{formatShortDate(task.assignedDate)}</span>
            </span>
          ) : null}
          {task.dueDate ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="size-3" />
              <span className="font-medium text-foreground/80">Due</span>
              <DueLabel due={task.dueDate} isDone={task.status === "done"} />
            </span>
          ) : null}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <AssigneeStack assignees={task.assignees} />
        {task.project ? (
          <span className="truncate text-[11px] text-muted-foreground">
            {task.project.name}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function InlineStatusSelect({
  task,
  canMove,
  onChange,
}: {
  task: Task;
  canMove: boolean;
  onChange: (s: TaskStatusKey) => void;
}) {
  if (!canMove) return <TaskStatusBadge status={task.status} />;
  return (
    <Select
      value={task.status}
      onValueChange={(v) => onChange(v as TaskStatusKey)}
    >
      <SelectTrigger
        size="sm"
        className={cn(
          "h-7 w-[130px] gap-1.5 border-transparent px-2 text-xs font-medium shadow-none hover:border-border",
          TASK_STATUS_STYLES[task.status].cls,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BOARD_COLUMNS.map((s) => (
          <SelectItem key={s} value={s}>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  TASK_STATUS_STYLES[s].dot,
                )}
              />
              {TASK_STATUS_STYLES[s].label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DueLabel({ due, isDone }: { due: string | null; isDone: boolean }) {
  if (!due) return <span className="text-muted-foreground">—</span>;
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dm = new Date(d);
  dm.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (dm.getTime() - today.getTime()) / (24 * 3600 * 1000),
  );
  const overdue = !isDone && diff < 0;
  const soon = !isDone && diff >= 0 && diff <= 2;
  const label = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <span
      className={cn(
        "font-medium",
        overdue && "text-rose-600 dark:text-rose-400",
        soon && !overdue && "text-amber-600 dark:text-amber-400",
        !overdue && !soon && "text-muted-foreground",
      )}
    >
      {label}
      {overdue ? " · overdue" : ""}
    </span>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatShortDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function AssigneeStack({ assignees }: { assignees: UserLite[] }) {
  if (!assignees || assignees.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const visible = assignees.slice(0, 3);
  const extra = assignees.length - visible.length;
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((u) => (
        <UserInitialsAvatar
          key={u._id}
          name={u.name}
          role={u.role}
          className="size-7 text-[10px] ring-2 ring-background"
        />
      ))}
      {extra > 0 && (
        <span className="flex size-7 items-center justify-center rounded-full border bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
          +{extra}
        </span>
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
    <div className="flex flex-col items-center justify-center gap-1 p-6 text-center">
      <p className="text-sm font-medium">
        {hasFilters
          ? "No tasks match your filters"
          : isUser
            ? "No tasks assigned to you yet"
            : "No tasks yet"}
      </p>
      <p className="text-xs text-muted-foreground">
        {hasFilters
          ? "Try clearing filters or adjusting your search."
          : "Tasks created under any project will appear here."}
      </p>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="mt-2 text-muted-foreground hover:text-foreground"
        >
          <X className="mr-1 size-4" /> Clear filters
        </Button>
      )}
    </div>
  );
}

function ViewTaskDialog({
  open,
  onOpenChange,
  task,
  onEdit,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
  onEdit: (t: Task) => void;
  canEdit: boolean;
}) {
  const style = task ? TASK_STATUS_STYLES[task.status] : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl overflow-hidden p-0"
        showCloseButton={false}
      >
        {task && style ? (
          <>
            <div
              className={cn(
                "relative px-5 pt-5 pb-4 border-b border-border/60",
                style.card,
              )}
            >
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {task.project ? (
                  <span className="rounded-md border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {task.project.projectId}
                  </span>
                ) : null}
                <TaskStatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
              </div>
              <DialogTitle className="mt-2 text-left text-xl font-semibold leading-snug">
                {task.title}
              </DialogTitle>
              {task.project ? (
                <DialogDescription className="mt-0.5 text-left text-xs">
                  <Link
                    href={`/dashboard/projects/${task.project._id}`}
                    className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                  >
                    In <span className="font-medium">{task.project.name}</span>
                  </Link>
                </DialogDescription>
              ) : null}
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <MetaTile
                  icon={<CalendarDays className="size-4" />}
                  label="Assigned"
                  value={
                    <span className="text-sm font-medium">
                      {formatShortDate(task.assignedDate)}
                    </span>
                  }
                />
                <MetaTile
                  icon={<CalendarClock className="size-4" />}
                  label="Due"
                  value={
                    <DueLabel
                      due={task.dueDate}
                      isDone={task.status === "done"}
                    />
                  }
                />
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Users className="size-3.5" /> Assignees
                </div>
                {task.assignees.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {task.assignees.map((u) => (
                      <PersonChip key={u._id} user={u} />
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No assignees
                  </span>
                )}
              </div>

              {task.reportingPersons && task.reportingPersons.length > 0 ? (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <UserCircle2 className="size-3.5" /> Reporting to
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {task.reportingPersons.map((u) => (
                      <PersonChip key={u._id} user={u} />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <FileText className="size-3.5" /> Description
                </div>
                {task.description && task.description.trim() !== "" ? (
                  <RichTextViewer html={task.description} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No description.
                  </p>
                )}
              </div>

              {task.createdBy || task.createdAt ? (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {task.createdBy ? (
                    <>
                      <span>Created by</span>
                      <UserInitialsAvatar
                        name={task.createdBy.name}
                        role={task.createdBy.role}
                        className="size-4 text-[8px]"
                      />
                      <span className="font-medium text-foreground/80">
                        {task.createdBy.name}
                      </span>
                    </>
                  ) : null}
                  {task.createdAt ? (
                    <span>· {formatDate(task.createdAt)}</span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <DialogFooter className="gap-2 border-t border-border/60 bg-muted/20 px-5 py-3 sm:justify-between">
              <div className="flex items-center gap-2">
                {task.project ? (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/dashboard/projects/${task.project._id}?task=${task._id}`}
                    >
                      <ExternalLink className="mr-1 size-3.5" /> Open in project
                    </Link>
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                {canEdit ? (
                  <Button type="button" size="sm" onClick={() => onEdit(task)}>
                    <Pencil className="mr-1 size-3.5" /> Edit
                  </Button>
                ) : null}
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MetaTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="truncate text-sm">{value}</div>
      </div>
    </div>
  );
}

function PersonChip({ user }: { user: UserLite }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background py-0.5 pl-0.5 pr-2.5 text-xs">
      <UserInitialsAvatar
        name={user.name}
        role={user.role}
        className="size-5 text-[9px]"
      />
      <span className="font-medium">{user.name}</span>
    </span>
  );
}

function EditTaskDialog({
  open,
  onOpenChange,
  task,
  title,
  setTitle,
  desc,
  setDesc,
  status,
  setStatus,
  priority,
  setPriority,
  taskType,
  setTaskType,
  tags,
  setTags,
  assignedDate,
  setAssignedDate,
  dueDate,
  setDueDate,
  assignees,
  setAssignees,
  reporting,
  setReporting,
  errors,
  setErrors,
  alertMsg,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
  title: string;
  setTitle: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  status: TaskStatusKey;
  setStatus: (v: TaskStatusKey) => void;
  priority: TaskPriorityKey;
  setPriority: (v: TaskPriorityKey) => void;
  taskType: TaskTypeKey;
  setTaskType: (v: TaskTypeKey) => void;
  tags: string[];
  setTags: (v: string[]) => void;
  assignedDate: Date | null;
  setAssignedDate: (v: Date | null) => void;
  dueDate: Date | null;
  setDueDate: (v: Date | null) => void;
  assignees: UserLite[];
  setAssignees: (v: UserLite[]) => void;
  reporting: UserLite[];
  setReporting: (v: UserLite[]) => void;
  errors: FieldErrors;
  setErrors: React.Dispatch<React.SetStateAction<FieldErrors>>;
  alertMsg: string | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>
              {task?.project
                ? `Update details for this task in ${task.project.name}.`
                : "Update task details."}
            </DialogDescription>
          </DialogHeader>

          <FormAlert message={alertMsg} />

          <div className="grid gap-1.5">
            <Label htmlFor="edit-task-title">
              Title
              <RequiredMark />
            </Label>
            <Input
              id="edit-task-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((p) => ({ ...p, title: "" }));
              }}
              placeholder="Short, action-oriented title"
              aria-invalid={errors.title ? true : undefined}
              className="shadow-none"
              autoFocus
            />
            <FieldError reserve message={errors.title} />
          </div>

          <div className="grid gap-1.5">
            <Label>Description</Label>
            <RichTextEditor
              value={desc}
              onChange={setDesc}
              placeholder="Describe the task…"
              minHeight="min-h-32"
              invalid={Boolean(errors.description)}
            />
            <FieldError message={errors.description} />
          </div>

          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatusKey)}
              >
                <SelectTrigger className="w-full shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOARD_COLUMNS.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            TASK_STATUS_STYLES[s].dot,
                          )}
                        />
                        {TASK_STATUS_STYLES[s].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <PrioritySelect
                value={priority}
                onChange={setPriority}
                triggerClassName="h-9 w-full text-sm"
                size="default"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select
                value={taskType}
                onValueChange={(v) => setTaskType(v as TaskTypeKey)}
              >
                <SelectTrigger className="w-full shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TASK_TYPE_STYLES) as TaskTypeKey[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            TASK_TYPE_STYLES[k].dot,
                          )}
                        />
                        {TASK_TYPE_STYLES[k].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Tags</Label>
            <TagsInput
              value={tags}
              onChange={setTags}
              placeholder="Add tag — Enter to add"
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-task-assigned">Assigned date</Label>
              <DatePicker
                id="edit-task-assigned"
                value={assignedDate}
                onChange={setAssignedDate}
                placeholder="Pick start date"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-task-due">Due date</Label>
              <DatePicker
                id="edit-task-due"
                value={dueDate}
                onChange={setDueDate}
                placeholder="Pick due date"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Assignees</Label>
              <UserMultiPicker
                selected={assignees}
                onChange={setAssignees}
                placeholder="Select assignees"
              />
              <FieldError message={errors.assignees} />
            </div>
            <div className="grid gap-1.5">
              <Label>Reporting persons</Label>
              <UserMultiPicker
                selected={reporting}
                onChange={setReporting}
                placeholder="Select reporting persons"
              />
              <FieldError message={errors.reportingPersons} />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

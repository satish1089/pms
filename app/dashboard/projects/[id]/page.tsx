"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  Check,
  ClipboardList,
  Clock,
  FileText,
  FolderKanban,
  LayoutGrid,
  List as ListIcon,
  Link2,
  ListChecks,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RoleBadge,
  StatusBadge,
  TASK_STATUS_STYLES,
  TASK_TYPE_STYLES,
  TaskStatusBadge,
  TaskTypeBadge,
  type TaskStatusKey,
  type TaskTypeKey,
  UserInitialsAvatar,
} from "@/components/role-status-badge";
import { TagsInput } from "@/components/tags-input";
import { cn } from "@/lib/utils";
import { FieldError, FormAlert, RequiredMark } from "@/components/form-error";
import {
  MediaLightbox,
  MediaThumb,
  RichTextEditor,
  RichTextViewer,
  extractMediaItems,
  type MediaItem,
  type HashTask,
} from "@/components/rich-text-editor";
import { MentionInput } from "@/components/mention-input";
import { usePageTitle } from "@/hooks/use-page-title";
import { DatePicker } from "@/components/ui/date-picker";
import { TimeClockPicker } from "@/components/time-clock-picker";
import {
  PriorityBadge,
  PrioritySelect,
} from "@/components/priority-badge";
import { type UserLite as PickerUser } from "@/components/user-pickers";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { type UserRole } from "@/lib/roles";
import {
  type FieldErrors,
  parseApiError,
  parseJsonResponse,
} from "@/lib/form-errors";

type UserLite = PickerUser;

type Project = {
  _id: string;
  projectId: string;
  name: string;
  description?: string;
  status: "active" | "inactive";
  createdBy: UserLite | null;
  reportingTo: UserLite[];
  assignees: UserLite[];
  createdAt?: string;
  updatedAt?: string;
};

type Subtask = {
  _id: string;
  title: string;
  completed: boolean;
  assignee?: UserLite | null;
};

type TaskPriorityKey = "low" | "medium" | "high" | "urgent";

type Task = {
  _id: string;
  taskId?: string | null;
  title: string;
  description: string;
  status: TaskStatusKey;
  priority: TaskPriorityKey;
  type: TaskTypeKey;
  tags: string[];
  assignedDate: string | null;
  dueDate: string | null;
  createdBy: UserLite | null;
  assignees: UserLite[];
  reportingPersons: UserLite[];
  subtasks?: Subtask[];
  createdAt?: string;
  updatedAt?: string;
};

const chromeTabClasses = cn(
  "group relative -mb-[2px] h-10 flex-none items-center gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-sm font-medium text-muted-foreground shadow-none",
  "hover:text-foreground",
  "data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
);

const TAB_OVERVIEW = cn(
  "bg-primary/10 hover:bg-primary/15",
  "data-[state=active]:bg-primary/15 data-[state=active]:border-primary",
  "[&>svg]:text-primary/70 data-[state=active]:[&>svg]:text-primary"
);
const TAB_TASKS = cn(
  "bg-sky-500/10 hover:bg-sky-500/15",
  "data-[state=active]:bg-sky-500/15 data-[state=active]:border-sky-500",
  "[&>svg]:text-sky-600/80 data-[state=active]:[&>svg]:text-sky-600 dark:[&>svg]:text-sky-400/80 dark:data-[state=active]:[&>svg]:text-sky-400"
);
const TAB_FILES = cn(
  "bg-violet-500/10 hover:bg-violet-500/15",
  "data-[state=active]:bg-violet-500/15 data-[state=active]:border-violet-500",
  "[&>svg]:text-violet-600/80 data-[state=active]:[&>svg]:text-violet-600 dark:[&>svg]:text-violet-400/80 dark:data-[state=active]:[&>svg]:text-violet-400"
);
const TAB_LOGS = cn(
  "bg-emerald-500/10 hover:bg-emerald-500/15",
  "data-[state=active]:bg-emerald-500/15 data-[state=active]:border-emerald-500",
  "[&>svg]:text-emerald-600/80 data-[state=active]:[&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-400/80 dark:data-[state=active]:[&>svg]:text-emerald-400"
);

const BOARD_COLUMNS: TaskStatusKey[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "qa",
  "done",
];

const STATUS_TAB_ACTIVE: Record<TaskStatusKey, string> = {
  backlog: "data-[state=active]:bg-muted/70",
  todo: "data-[state=active]:bg-sky-500/20",
  in_progress: "data-[state=active]:bg-amber-500/20",
  in_review: "data-[state=active]:bg-violet-500/20",
  qa: "data-[state=active]:bg-cyan-500/20",
  done: "data-[state=active]:bg-emerald-500/20",
};

const STATUS_ROW_BG: Record<TaskStatusKey, string> = {
  backlog: "bg-muted/30",
  todo: "bg-sky-500/5 dark:bg-sky-500/10",
  in_progress: "bg-amber-500/5 dark:bg-amber-500/10",
  in_review: "bg-violet-500/5 dark:bg-violet-500/10",
  qa: "bg-cyan-500/5 dark:bg-cyan-500/10",
  done: "bg-emerald-500/5 dark:bg-emerald-500/10",
};

type Session = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

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

function DueDateCell({
  due,
  status,
}: {
  due: string | null;
  status: TaskStatusKey;
}) {
  if (!due) return <span className="text-xs text-muted-foreground">—</span>;
  const dueDate = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueMidnight = new Date(dueDate);
  dueMidnight.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (dueMidnight.getTime() - today.getTime()) / (24 * 3600 * 1000)
  );
  const isDone = status === "done";
  const overdue = !isDone && diffDays < 0;
  const soon = !isDone && diffDays >= 0 && diffDays <= 2;
  return (
    <span
      className={cn(
        "text-xs font-medium",
        overdue && "text-rose-600 dark:text-rose-400",
        soon && !overdue && "text-amber-600 dark:text-amber-400",
        !overdue && !soon && "text-muted-foreground"
      )}
      title={dueDate.toLocaleDateString()}
    >
      {formatShortDate(due)}
      {overdue ? " · overdue" : ""}
    </span>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const taskParam = searchParams?.get("task") ?? null;
  const editParam = searchParams?.get("edit") ?? null;
  const id = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskEditId, setTaskEditId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskStatus, setTaskStatus] = useState<TaskStatusKey>("todo");
  const [taskPriority, setTaskPriority] = useState<TaskPriorityKey>("medium");
  const [taskType, setTaskType] = useState<TaskTypeKey>("new");
  const [taskTags, setTaskTags] = useState<string[]>([]);
  const [projectTags, setProjectTags] = useState<string[]>([]);
  const [taskAssignedDate, setTaskAssignedDate] = useState<Date | null>(null);
  const [taskDueDate, setTaskDueDate] = useState<Date | null>(null);
  const [view, setView] = useState<"list" | "board">("list");
  const [taskQuery, setTaskQuery] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<
    "all" | TaskStatusKey
  >("all");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<
    "all" | TaskPriorityKey
  >("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState<"all" | TaskTypeKey>(
    "all"
  );
  const [taskTagFilter, setTaskTagFilter] = useState<string>("all");
  const [tab, setTab] = useState<string>("tasks");

  type LogEntry = {
    _id: string;
    user: UserLite | null;
    task: { _id: string; title: string; taskId?: string | null } | null;
    date: string;
    startTime: string;
    endTime: string;
    hours: number;
    note: string;
    createdAt?: string;
  };
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsSubmitting, setLogsSubmitting] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const LOG_PAGE_SIZE = 10;
  const [logTotal, setLogTotal] = useState(0);
  const [logTotalHours, setLogTotalHours] = useState(0);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [logTaskId, setLogTaskId] = useState<string>("project");
  const [logDate, setLogDate] = useState<Date | null>(new Date());
  const [logStartHour, setLogStartHour] = useState<string>("09");
  const [logStartMin, setLogStartMin] = useState<string>("00");
  const [logEndHour, setLogEndHour] = useState<string>("10");
  const [logEndMin, setLogEndMin] = useState<string>("00");
  const [logNote, setLogNote] = useState<string>("");
  const [logUserFilter, setLogUserFilter] = useState<string>("all");
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [pendingDeleteLog, setPendingDeleteLog] = useState<LogEntry | null>(null);
  const [deletingLog, setDeletingLog] = useState(false);
  const computedLogHours = useMemo(() => {
    const start = parseInt(logStartHour, 10) * 60 + parseInt(logStartMin, 10);
    const end = parseInt(logEndHour, 10) * 60 + parseInt(logEndMin, 10);
    const diff = end - start;
    return diff > 0 ? +(diff / 60).toFixed(2) : 0;
  }, [logStartHour, logStartMin, logEndHour, logEndMin]);

  const fetchLogs = useCallback(async () => {
    if (!project?._id) return;
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(logPage));
      params.set("limit", String(LOG_PAGE_SIZE));
      if (logUserFilter !== "all") params.set("userId", logUserFilter);
      const res = await fetch(
        `/api/projects/${project._id}/logs?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load logs");
      const data = await res.json();
      setLogs(data.logs ?? []);
      setLogTotal(data.total ?? 0);
      setLogTotalHours(data.totalHours ?? 0);
      setLogTotalPages(data.totalPages ?? 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load logs";
      toast.error(msg);
    } finally {
      setLogsLoading(false);
    }
  }, [project?._id, logPage, logUserFilter]);

  useEffect(() => {
    if (tab === "logs") fetchLogs();
  }, [tab, fetchLogs]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatusKey | null>(null);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

  type CommentT = {
    _id: string;
    body: string;
    createdAt?: string;
    author: UserLite | null;
    kind?: "comment" | "system";
    system?: {
      type:
        | "status"
        | "priority"
        | "assignee_added"
        | "assignee_removed"
        | "reporting_added"
        | "reporting_removed";
      from?: string;
      to?: string;
    } | null;
  };

  const [projComments, setProjComments] = useState<CommentT[]>([]);
  const [projCommentsLoading, setProjCommentsLoading] = useState(false);
  const projCommentsFetchedRef = useRef(false);
  const [newProjComment, setNewProjComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentAlert, setCommentAlert] = useState<string | null>(null);
  const [projComposerOpen, setProjComposerOpen] = useState(false);

  type TaskTabState = {
    comments: CommentT[];
    loading: boolean;
    draft: string;
    composerOpen: boolean;
    alert: string | null;
    posting: boolean;
  };
  const [openTaskIds, setOpenTaskIds] = useState<string[]>([]);
  const [taskTabs, setTaskTabs] = useState<Record<string, TaskTabState>>({});

  function updateTaskTab(id: string, patch: Partial<TaskTabState>) {
    setTaskTabs((prev) => {
      const curr: TaskTabState = prev[id] ?? {
        comments: [],
        loading: false,
        draft: "",
        composerOpen: false,
        alert: null,
        posting: false,
      };
      return { ...prev, [id]: { ...curr, ...patch } };
    });
  }
  const [taskAssignees, setTaskAssignees] = useState<UserLite[]>([]);
  const [taskReporting, setTaskReporting] = useState<UserLite[]>([]);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskErrors, setTaskErrors] = useState<FieldErrors>({});
  const [taskAlert, setTaskAlert] = useState<string | null>(null);

  const canEdit =
    session?.role === "admin" || session?.role === "project_manager";
  const isAdmin = session?.role === "admin";
  const sessionUserId = session?._id;
  const isTaskCreator = (t: Task) =>
    !!sessionUserId && String(t.createdBy?._id ?? "") === sessionUserId;
  const isTaskAssignee = (t: Task) =>
    !!sessionUserId && (t.assignees ?? []).some((u) => u._id === sessionUserId);
  const isTaskReporting = (t: Task) =>
    !!sessionUserId &&
    (t.reportingPersons ?? []).some((u) => u._id === sessionUserId);
  const canEditTask = (t: Task) => canEdit || isTaskCreator(t);
  const canDeleteTask = (t: Task) => canEdit || isTaskCreator(t);
  const canChangeTaskStatus = (t: Task) =>
    canEditTask(t) || isTaskAssignee(t) || isTaskReporting(t);

  const [pendingDeleteTask, setPendingDeleteTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  async function confirmDeleteTask() {
    if (!pendingDeleteTask) return;
    setDeletingTask(true);
    try {
      const res = await fetch(`/api/tasks/${pendingDeleteTask._id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete task");
      }
      setTasks((ts) => ts.filter((t) => t._id !== pendingDeleteTask._id));
      toast.success("Task deleted");
      setPendingDeleteTask(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setDeletingTask(false);
    }
  }

  const filteredTasks = useMemo(() => {
    const q = taskQuery.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      if (taskStatusFilter !== "all" && t.status !== taskStatusFilter)
        return false;
      if (taskPriorityFilter !== "all" && t.priority !== taskPriorityFilter)
        return false;
      if (taskTypeFilter !== "all" && t.type !== taskTypeFilter) return false;
      if (taskTagFilter !== "all" && !(t.tags ?? []).includes(taskTagFilter))
        return false;
      if (taskAssigneeFilter !== "all") {
        if (taskAssigneeFilter === "__unassigned") {
          if ((t.assignees?.length ?? 0) > 0) return false;
        } else if (
          !(t.assignees ?? []).some((a) => a._id === taskAssigneeFilter)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    tasks,
    taskQuery,
    taskStatusFilter,
    taskPriorityFilter,
    taskAssigneeFilter,
    taskTypeFilter,
    taskTagFilter,
  ]);

  const hasTaskFilters =
    Boolean(taskQuery.trim()) ||
    taskStatusFilter !== "all" ||
    taskPriorityFilter !== "all" ||
    taskAssigneeFilter !== "all" ||
    taskTypeFilter !== "all" ||
    taskTagFilter !== "all";


  type ProjectFile = MediaItem & {
    id: string;
    date?: string;
    source: string;
  };

  const projectFiles = useMemo<ProjectFile[]>(() => {
    if (typeof window === "undefined") return [];
    const out: ProjectFile[] = [];
    for (const t of tasks) {
      if (!t.description) continue;
      const items = extractMediaItems(t.description);
      items.forEach((m, i) => {
        out.push({
          ...m,
          id: `task-${t._id}-${i}`,
          date: t.createdAt,
          source: t.taskId ? `Task ${t.taskId}` : `Task: ${t.title}`,
        });
      });
    }
    for (const c of projComments) {
      if (!c.body) continue;
      const items = extractMediaItems(c.body);
      items.forEach((m, i) => {
        out.push({
          ...m,
          id: `comment-${c._id}-${i}`,
          date: c.createdAt,
          source: c.author?.name ? `Post by ${c.author.name}` : "Project post",
        });
      });
    }
    return out;
  }, [tasks, projComments]);

  const projectFilesCount = projectFiles.length;
  const [filesLightbox, setFilesLightbox] = useState<MediaItem | null>(null);

  const hashTasks = useMemo(() => {
    if (!project) return [];
    return tasks
      .filter((t) => t.taskId)
      .map((t) => ({
        _id: t._id,
        taskId: t.taskId as string,
        title: t.title,
        projectId: project._id,
      }));
  }, [tasks, project]);

  const projectMembers = useMemo(() => {
    if (!project) return [];
    const list: {
      _id: string;
      name: string;
      email?: string;
      role?: UserRole;
    }[] = [];
    const seen = new Set<string>();
    const push = (u: UserLite | null | undefined) => {
      if (!u?._id || seen.has(u._id)) return;
      seen.add(u._id);
      list.push({ _id: u._id, name: u.name, email: u.email, role: u.role });
    };
    for (const u of project.reportingTo ?? []) push(u);
    push(project.createdBy);
    for (const a of project.assignees) push(a);
    return list;
  }, [project]);

  const mentionUsersForTask = useCallback(
    (taskId: string) => {
      const t = tasks.find((x) => x._id === taskId);
      if (!t) return projectMembers;
      const list = [...projectMembers];
      const seen = new Set(list.map((u) => u._id));
      const push = (u: UserLite | null | undefined) => {
        if (!u?._id || seen.has(u._id)) return;
        seen.add(u._id);
        list.push({ _id: u._id, name: u.name, email: u.email, role: u.role });
      };
      for (const a of t.assignees) push(a);
      for (const a of t.reportingPersons) push(a);
      push(t.createdBy);
      return list;
    },
    [projectMembers, tasks]
  );

  const taskPickerOptions = useMemo<UserLite[]>(() => {
    if (!project) return [];
    const list: UserLite[] = [];
    const seen = new Set<string>();
    const push = (u: UserLite | null | undefined) => {
      if (!u?._id || seen.has(u._id)) return;
      seen.add(u._id);
      list.push(u);
    };
    for (const u of project.reportingTo ?? []) push(u);
    for (const a of project.assignees) push(a);
    return list;
  }, [project]);

  async function addAssignee(userId: string) {
    if (!project) return;
    const existing = project.assignees.map((a) => a._id);
    if (existing.includes(userId)) return;
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignees: [...existing, userId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add assignee");
      setProject(data.project);
      toast.success("Assignee added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add assignee");
    }
  }

  async function removeAssignee(userId: string) {
    if (!project) return;
    const next = project.assignees
      .filter((a) => a._id !== userId)
      .map((a) => a._id);
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignees: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove assignee");
      setProject(data.project);
      toast.success("Assignee removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove assignee");
    }
  }

  async function addReporting(userId: string) {
    if (!project) return;
    const existing = (project.reportingTo ?? []).map((a) => a._id);
    if (existing.includes(userId)) return;
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportingTo: [...existing, userId] }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to add reporting person");
      setProject(data.project);
      toast.success("Reporting person added");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add reporting person"
      );
    }
  }

  async function removeReporting(userId: string) {
    if (!project) return;
    const next = (project.reportingTo ?? [])
      .filter((a) => a._id !== userId)
      .map((a) => a._id);
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportingTo: next }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to remove reporting person");
      setProject(data.project);
      toast.success("Reporting person removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove reporting person"
      );
    }
  }

  async function patchProjectField(
    payload: Partial<{
      name: string;
      status: "active" | "inactive";
      reportingTo: string[];
    }>,
    label: string
  ) {
    if (!project) return;
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to update ${label}`);
      setProject(data.project);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Failed to update ${label}`
      );
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (res.ok) setSession(data.user);
      } catch {}
    })();
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) {
        const { message } = await parseApiError(res);
        throw new Error(message || "Failed to load project");
      }
      const data = await parseJsonResponse<{ project: Project }>(res);
      setProject(data.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadTasks = useCallback(async () => {
    if (!id) return;
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/tasks`);
      if (!res.ok) {
        const { message } = await parseApiError(res);
        throw new Error(message || "Failed to load tasks");
      }
      const data = await parseJsonResponse<{ tasks: Task[] }>(res);
      setTasks(data.tasks ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (project) loadTasks();
  }, [project, loadTasks]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${id}/tags`);
        const data = await res.json();
        if (res.ok) setProjectTags(data.tags ?? []);
      } catch {}
    })();
  }, [id, tasks]);

  const editHandledRef = useRef(false);
  useEffect(() => {
    if (editParam !== "1" || !taskParam || !project) return;
    if (editHandledRef.current) return;
    const t = tasks.find((x) => x._id === taskParam);
    if (!t) return;
    editHandledRef.current = true;
    openEditTask(t);
    if (pathname) {
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      sp.delete("edit");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParam, taskParam, project, tasks]);

  const loadProjComments = useCallback(async () => {
    if (!id) return;
    setProjCommentsLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/comments`);
      if (!res.ok) {
        const { message } = await parseApiError(res);
        throw new Error(message || "Failed to load discussion");
      }
      const data = await parseJsonResponse<{ comments: CommentT[] }>(res);
      setProjComments(data.comments ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load discussion");
    } finally {
      setProjCommentsLoading(false);
    }
  }, [id]);

  const ensureProjComments = useCallback(() => {
    if (projCommentsFetchedRef.current) return;
    projCommentsFetchedRef.current = true;
    loadProjComments();
  }, [loadProjComments]);

  useEffect(() => {
    if (!project) return;
    if (tab === "overview" || tab === "files") ensureProjComments();
  }, [project, tab, ensureProjComments]);

  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!project || hydratedRef.current) return;
    hydratedRef.current = true;
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(`projectly:tabs:${project._id}`);
    } catch {}
    if (taskParam) {
      setOpenTaskIds([taskParam]);
      setTaskTabs({
        [taskParam]: {
          comments: [],
          loading: true,
          draft: "",
          composerOpen: false,
          alert: null,
          posting: false,
        },
      });
      setTab(`task:${taskParam}`);
      loadTaskComments(taskParam);
    } else {
      setOpenTaskIds([]);
      setTaskTabs({});
      setTab("tasks");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  useEffect(() => {
    if (!project || !hydratedRef.current) return;
    if (typeof window === "undefined") return;
    try {
      const drafts: Record<string, { draft: string; composerOpen: boolean }> = {};
      openTaskIds.forEach((tid) => {
        const s = taskTabs[tid];
        if (s) {
          drafts[tid] = { draft: s.draft, composerOpen: s.composerOpen };
        }
      });
      sessionStorage.setItem(
        `projectly:tabs:${project._id}`,
        JSON.stringify({ openTaskIds, tab, drafts })
      );
    } catch {}
  }, [project, openTaskIds, tab, taskTabs]);

  useEffect(() => {
    if (!project || !hydratedRef.current) return;
    if (!taskParam) return;
    setOpenTaskIds((prev) =>
      prev.includes(taskParam) ? prev : [...prev, taskParam]
    );
    setTaskTabs((prev) =>
      prev[taskParam]
        ? prev
        : {
            ...prev,
            [taskParam]: {
              comments: [],
              loading: true,
              draft: "",
              composerOpen: false,
              alert: null,
              posting: false,
            },
          }
    );
    setTab(`task:${taskParam}`);
    if (!taskTabs[taskParam]) loadTaskComments(taskParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskParam, project]);

  async function loadTaskComments(taskId: string) {
    updateTaskTab(taskId, { loading: true });
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load discussion");
      updateTaskTab(taskId, { comments: data.comments ?? [], loading: false });
    } catch (err) {
      updateTaskTab(taskId, { loading: false });
      toast.error(err instanceof Error ? err.message : "Failed to load discussion");
    }
  }

  function openTaskTab(taskId: string) {
    setOpenTaskIds((prev) =>
      prev.includes(taskId) ? prev : [...prev, taskId]
    );
    setTaskTabs((prev) =>
      prev[taskId]
        ? prev
        : {
            ...prev,
            [taskId]: {
              comments: [],
              loading: true,
              draft: "",
              composerOpen: false,
              alert: null,
              posting: false,
            },
          }
    );
    setTab(`task:${taskId}`);
    if (!taskTabs[taskId]) loadTaskComments(taskId);
  }

  function closeTaskTab(taskId: string) {
    setOpenTaskIds((prev) => {
      const next = prev.filter((id) => id !== taskId);
      if (tab === `task:${taskId}`) {
        const idx = prev.indexOf(taskId);
        const fallback =
          next[idx] ?? next[idx - 1] ?? (next.length > 0 ? next[0] : null);
        setTab(fallback ? `task:${fallback}` : "tasks");
      }
      return next;
    });
    setTaskTabs((prev) => {
      const { [taskId]: _, ...rest } = prev;
      void _;
      return rest;
    });
    if (taskParam === taskId && pathname) {
      router.replace(pathname);
    }
  }

  async function postTaskComment(e: React.FormEvent, taskId: string) {
    e.preventDefault();
    const state = taskTabs[taskId];
    if (!state) return;
    const plain = state.draft.replace(/<[^>]+>/g, "").trim();
    if (plain.length === 0) {
      updateTaskTab(taskId, { alert: "Comment cannot be empty" });
      return;
    }
    updateTaskTab(taskId, { posting: true, alert: null });
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: state.draft }),
      });
      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        const errs = fieldErrors as FieldErrors;
        updateTaskTab(taskId, {
          alert: errs.body || message,
          posting: false,
        });
        return;
      }
      updateTaskTab(taskId, {
        draft: "",
        composerOpen: false,
        posting: false,
      });
      await loadTaskComments(taskId);
    } catch (err) {
      updateTaskTab(taskId, {
        alert: err instanceof Error ? err.message : "Failed to post",
        posting: false,
      });
    }
  }

  async function postProjComment(e: React.FormEvent) {
    e.preventDefault();
    setCommentAlert(null);
    const plain = newProjComment.replace(/<[^>]+>/g, "").trim();
    if (plain.length === 0) {
      setCommentAlert("Comment cannot be empty");
      return;
    }
    setPostingComment(true);
    try {
      const res = await fetch(`/api/projects/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newProjComment }),
      });
      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        const errs = fieldErrors as FieldErrors;
        setCommentAlert(errs.body || message);
        return;
      }
      setNewProjComment("");
      setProjComposerOpen(false);
      await loadProjComments();
    } catch (err) {
      setCommentAlert(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setPostingComment(false);
    }
  }

  async function updateTaskAssignees(
    taskId: string,
    nextAssignees: UserLite[]
  ) {
    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) => (t._id === taskId ? { ...t, assignees: nextAssignees } : t))
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignees: nextAssignees.map((u) => u._id) }),
      });
      if (!res.ok) {
        setTasks(prev);
        const data = await res.json();
        toast.error(data.error || "Failed to update assignees");
      }
    } catch (err) {
      setTasks(prev);
      toast.error(
        err instanceof Error ? err.message : "Failed to update assignees"
      );
    }
  }

  async function updateTaskReporting(
    taskId: string,
    nextReporting: UserLite[]
  ) {
    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) =>
        t._id === taskId ? { ...t, reportingPersons: nextReporting } : t
      )
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportingPersons: nextReporting.map((u) => u._id),
        }),
      });
      if (!res.ok) {
        setTasks(prev);
        const data = await res.json();
        toast.error(data.error || "Failed to update reporting");
      }
    } catch (err) {
      setTasks(prev);
      toast.error(
        err instanceof Error ? err.message : "Failed to update reporting"
      );
    }
  }

  async function patchTaskField(
    taskId: string,
    patch: Partial<{
      priority: TaskPriorityKey;
      assignedDate: string | null;
      dueDate: string | null;
      type: TaskTypeKey;
      tags: string[];
    }>,
    optimistic: Partial<Task>,
    label: string
  ) {
    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) => (t._id === taskId ? { ...t, ...optimistic } : t))
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        setTasks(prev);
        const data = await res.json();
        toast.error(data.error || `Failed to update ${label}`);
      }
    } catch (err) {
      setTasks(prev);
      toast.error(
        err instanceof Error ? err.message : `Failed to update ${label}`
      );
    }
  }

  async function moveTask(taskId: string, newStatus: TaskStatusKey) {
    const existing = tasks.find((t) => t._id === taskId);
    if (!existing || existing.status === newStatus) return;

    if (newStatus === "done") {
      const subs = existing.subtasks ?? [];
      if (subs.length > 0 && subs.some((s) => !s.completed)) {
        toast.error("Complete all subtasks before marking task done");
        return;
      }
    }

    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
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
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function saveSubtasks(
    taskId: string,
    nextSubtasks: Subtask[],
    subtaskMention?: { title: string; mentionIds: string[] }
  ) {
    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) =>
        t._id === taskId ? { ...t, subtasks: nextSubtasks } : t
      )
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtasks: nextSubtasks.map((s) => ({
            _id: s._id.startsWith("tmp-") ? undefined : s._id,
            title: s.title,
            completed: s.completed,
            assignee: s.assignee?._id ?? null,
          })),
          ...(subtaskMention && subtaskMention.mentionIds.length > 0
            ? { subtaskMention }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTasks(prev);
        toast.error(data.error || "Failed to update subtasks");
        return;
      }
      const serverSubtasks = (data.task?.subtasks ?? []) as Subtask[];
      setTasks((ts) =>
        ts.map((t) =>
          t._id === taskId ? { ...t, subtasks: serverSubtasks } : t
        )
      );
    } catch (err) {
      setTasks(prev);
      toast.error(err instanceof Error ? err.message : "Failed to update subtasks");
    }
  }

  function openCreateTask() {
    setTaskEditId(null);
    setTaskTitle("");
    setTaskDesc("");
    setTaskStatus("todo");
    setTaskPriority("medium");
    setTaskType("new");
    setTaskTags([]);
    setTaskAssignedDate(new Date());
    setTaskDueDate(null);
    setTaskAssignees([]);
    setTaskReporting([]);
    setTaskErrors({});
    setTaskAlert(null);
    setTaskDialogOpen(true);
  }

  function openEditTask(t: Task) {
    setTaskEditId(t._id);
    setTaskTitle(t.title);
    setTaskDesc(t.description ?? "");
    setTaskStatus(t.status);
    setTaskPriority(t.priority ?? "medium");
    setTaskType(t.type ?? "new");
    setTaskTags(t.tags ?? []);
    setTaskAssignedDate(t.assignedDate ? new Date(t.assignedDate) : null);
    setTaskDueDate(t.dueDate ? new Date(t.dueDate) : null);
    setTaskAssignees(t.assignees);
    setTaskReporting(t.reportingPersons);
    setTaskErrors({});
    setTaskAlert(null);
    setTaskDialogOpen(true);
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setTaskAlert(null);
    const errs: FieldErrors = {};
    if (taskTitle.trim().length < 2)
      errs.title = "Title must be at least 2 characters";
    if (Object.keys(errs).length > 0) {
      setTaskErrors(errs);
      return;
    }
    setTaskErrors({});
    setTaskSubmitting(true);
    const isEdit = Boolean(taskEditId);
    try {
      const url = isEdit
        ? `/api/tasks/${taskEditId}`
        : `/api/projects/${id}/tasks`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc,
          status: taskStatus,
          priority: taskPriority,
          type: taskType,
          tags: taskTags,
          assignedDate: taskAssignedDate
            ? taskAssignedDate.toISOString()
            : null,
          dueDate: taskDueDate ? taskDueDate.toISOString() : null,
          assignees: taskAssignees.map((u) => u._id),
          reportingPersons: taskReporting.map((u) => u._id),
        }),
      });
      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        if (Object.keys(fieldErrors).length > 0) setTaskErrors(fieldErrors);
        else setTaskAlert(message);
        return;
      }
      toast.success(isEdit ? "Task updated" : "Task created");
      setTaskDialogOpen(false);
      setTaskEditId(null);
      await loadTasks();
    } catch (err) {
      setTaskAlert(err instanceof Error ? err.message : "Request failed");
    } finally {
      setTaskSubmitting(false);
    }
  }

  const activeTaskFromTab = tab.startsWith("task:")
    ? tasks.find((t) => t._id === tab.slice("task:".length)) ?? null
    : null;

  usePageTitle(
    loading
      ? "Loading project…"
      : error
      ? "Project not found"
      : project
      ? activeTaskFromTab
        ? `${
            activeTaskFromTab.taskId ? `${activeTaskFromTab.taskId} · ` : ""
          }${activeTaskFromTab.title} · ${project.name}`
        : `${project.name}${
            project.projectId ? ` (${project.projectId})` : ""
          }`
      : null
  );

  if (loading) return <DetailSkeleton />;
  if (error || !project)
    return <DetailError message={error ?? "Project not found"} />;

  const openTaskTabs = openTaskIds
    .map((id) => tasks.find((t) => t._id === id))
    .filter((t): t is Task => Boolean(t));

  const pendingTaskTabIds = openTaskIds.filter(
    (id) => !tasks.some((t) => t._id === id)
  );

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-3.5rem)] flex-col sm:-mx-6 sm:-my-8 lg:h-[calc(100vh-3.5rem)] lg:min-h-0 lg:overflow-hidden">
      <div className="flex flex-1 min-w-0 flex-col lg:min-h-0">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex min-w-0 flex-1 flex-col gap-0 lg:min-h-0"
        >
          <div className="relative">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b-2 border-border/60 bg-transparent pr-3 py-0 shadow-none sm:pr-3">
              <TabsTrigger
                value="overview"
                className={cn(chromeTabClasses, TAB_OVERVIEW)}
              >
                <FolderKanban className="size-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className={cn(chromeTabClasses, TAB_TASKS)}
              >
                <ListChecks className="size-4" />
                <span>Tasks</span>
              </TabsTrigger>
              <TabsTrigger
                value="files"
                className={cn(chromeTabClasses, TAB_FILES)}
              >
                <Paperclip className="size-4" />
                <span>Files</span>
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className={cn(chromeTabClasses, TAB_LOGS)}
              >
                <Clock className="size-4" />
                <span>Logs</span>
              </TabsTrigger>
              {pendingTaskTabIds.map((tid) => (
                <TabsTrigger
                  key={tid}
                  value={`task:${tid}`}
                  className={cn(chromeTabClasses, "pr-1.5")}
                >
                  <Skeleton className="size-2 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </TabsTrigger>
              ))}
              {openTaskTabs.map((t) => (
                <TabsTrigger
                  key={t._id}
                  value={`task:${t._id}`}
                  className={cn(
                    chromeTabClasses,
                    "pr-1.5",
                    TASK_STATUS_STYLES[t.status].card,
                    STATUS_TAB_ACTIVE[t.status]
                  )}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      TASK_STATUS_STYLES[t.status].dot
                    )}
                  />
                  <span className="max-w-[160px] truncate">{t.title}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Close ${t.title}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      closeTaskTab(t._id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="ml-1 flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </span>
                </TabsTrigger>
              ))}
              <button
                type="button"
                aria-label="Back to projects"
                title="Back to projects"
                onClick={() => router.push("/dashboard/projects")}
                className="group/back ml-auto mt-1 flex size-8 shrink-0 cursor-pointer items-center justify-center self-start rounded-md border border-border/60 bg-background text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="size-4 transition-transform group-hover/back:-translate-x-0.5" />
              </button>
            </TabsList>
          </div>

          <TabsContent
            value="overview"
            className="flex-1 lg:min-h-0 lg:overflow-hidden"
          >
            <div className="flex flex-col lg:h-full lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="scrollbar-hide min-w-0 lg:overflow-y-auto lg:border-r lg:border-border/40">
                <div>
                  <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5 sm:px-6">
                    <FileText className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold tracking-tight">
                      Description
                    </h3>
                  </div>
                  <div className="px-4 py-3 sm:px-6">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {project.createdBy && (
                        <span className="font-medium text-foreground">
                          {project.createdBy.name}
                        </span>
                      )}
                      <span>· {formatDate(project.createdAt)}</span>
                    </div>
                    <div className="mt-1">
                      {project.description && project.description.trim() !== "" ? (
                        <RichTextViewer html={project.description} />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No description.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5 sm:px-6">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="size-4 text-primary" />
                      <h3 className="text-sm font-semibold tracking-tight">
                        Comments
                      </h3>
                      <span className="rounded-full border bg-background px-1.5 py-0 text-[11px] font-medium text-muted-foreground">
                        {projCommentsLoading ? "…" : projComments.length}
                      </span>
                    </div>
                  </div>

                  <div className="border-b border-border/40 px-4 py-2 sm:px-6">
                    {!projComposerOpen ? (
                      <button
                        type="button"
                        onClick={() => setProjComposerOpen(true)}
                        className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2.5 text-left text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      >
                        <MessageSquare className="size-3.5 text-muted-foreground" />
                        Comment...
                      </button>
                    ) : (
                      <form onSubmit={postProjComment} className="space-y-3">
                        <FormAlert message={commentAlert} />
                        <RichTextEditor
                          value={newProjComment}
                          onChange={(v) => {
                            setNewProjComment(v);
                            if (commentAlert) setCommentAlert(null);
                          }}
                          placeholder="Share an update — @mention people, #link tasks, paste URLs…"
                          minHeight="min-h-24"
                          mentionUsers={projectMembers}
                          hashTasks={hashTasks}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setNewProjComment("");
                              setCommentAlert(null);
                              setProjComposerOpen(false);
                            }}
                            disabled={postingComment}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={postingComment}
                            size="sm"
                          >
                            <Send className="mr-2 size-4" />
                            {postingComment ? "Posting…" : "Post to project"}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>

                  {projCommentsLoading ? (
                    <div className="space-y-3 p-3 sm:px-6">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <Skeleton className="size-7 rounded-full" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-3 w-40" />
                            <Skeleton className="h-3 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    (() => {
                      const sorted = [...projComments].sort(
                        (a, b) =>
                          new Date(b.createdAt ?? 0).getTime() -
                          new Date(a.createdAt ?? 0).getTime()
                      );
                      const renderComment = (c: (typeof sorted)[number]) => (
                        <li
                          key={c._id}
                          className="flex items-start gap-2 px-4 py-2 sm:px-6"
                        >
                          <UserInitialsAvatar
                            name={c.author?.name ?? "?"}
                            role={c.author?.role}
                            className="size-6 text-[9px]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {c.author?.name ?? "Unknown"}
                              </span>
                              <span>· {formatDate(c.createdAt)}</span>
                            </div>
                            <div className="mt-1">
                              <RichTextViewer html={c.body} />
                            </div>
                          </div>
                        </li>
                      );

                      return sorted.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-0.5 p-3 text-center">
                          <MessageSquare className="size-4 text-muted-foreground" />
                          <p className="text-sm font-medium">No posts yet</p>
                          <p className="text-xs text-muted-foreground">
                            Share updates, context, or questions for the whole project.
                          </p>
                        </div>
                      ) : (
                        <ul className="divide-y divide-border/40">
                          {sorted.map((c) => renderComment(c))}
                        </ul>
                      );
                    })()
                  )}
                </div>
              </div>

              <aside className="scrollbar-hide border-t border-border/40 lg:border-t-0 lg:overflow-y-auto">
                <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5 sm:px-6">
                  <FolderKanban className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold tracking-tight">
                    Project info
                  </h3>
                </div>
                <div className="space-y-3 px-4 py-3 text-sm sm:px-6">
                  <InfoField label="ID">
                    <span className="font-mono text-sm font-semibold">
                      {project.projectId}
                    </span>
                  </InfoField>

                  <InfoField label="Name">
                    {canEdit ? (
                      <ProjectNameInline
                        value={project.name}
                        onSave={(name) =>
                          patchProjectField({ name }, "name")
                        }
                      />
                    ) : (
                      <span className="text-sm font-medium">
                        {project.name}
                      </span>
                    )}
                  </InfoField>

                  <InfoField label="Status">
                    {canEdit ? (
                      <Select
                        value={project.status ?? "active"}
                        onValueChange={(v) =>
                          patchProjectField(
                            { status: v as "active" | "inactive" },
                            "status"
                          )
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "h-9 w-full gap-1.5 px-3 text-sm font-medium shadow-none",
                            project.status === "active"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">
                            <span className="flex items-center gap-2">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          </SelectItem>
                          <SelectItem value="inactive">
                            <span className="flex items-center gap-2">
                              <span className="size-1.5 rounded-full bg-muted-foreground" />
                              Inactive
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusBadge status={project.status ?? "active"} />
                    )}
                  </InfoField>

                  <InfoField label="Reporting to">
                    <AssigneeAvatarRow
                      users={project.reportingTo ?? []}
                      canEdit={canEdit}
                      existingIds={[
                        ...project.assignees.map((u) => u._id),
                        ...(project.reportingTo ?? []).map((u) => u._id),
                      ]}
                      onAdd={addReporting}
                      onRemove={removeReporting}
                    />
                  </InfoField>

                  <InfoField label="Assignees">
                    <AssigneeAvatarRow
                      users={project.assignees}
                      canEdit={canEdit}
                      existingIds={[
                        ...project.assignees.map((u) => u._id),
                        ...(project.reportingTo ?? []).map((u) => u._id),
                      ]}
                      onAdd={addAssignee}
                      onRemove={removeAssignee}
                    />
                  </InfoField>

                  <div className="border-t border-border/40 pt-3 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span>Created by</span>
                      <span className="font-medium text-foreground">
                        {project.createdBy?.name ?? "—"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span>Created</span>
                      <span>{formatDate(project.createdAt)}</span>
                    </div>
                    {project.updatedAt && (
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span>Updated</span>
                        <span>{formatDate(project.updatedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </TabsContent>

          <TabsContent
            value="tasks"
            className="flex flex-1 flex-col lg:min-h-0"
          >
            <div className="flex flex-1 flex-col lg:min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-2 sm:px-6 shrink-0">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Tasks</h2>
            <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {tasksLoading ? "…" : tasks.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-md border">
              <button
                type="button"
                onClick={() => setView("board")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 text-xs",
                  view === "board"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent"
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
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <ListIcon className="size-3.5" /> List
              </button>
            </div>
            <Button size="sm" onClick={openCreateTask}>
              <Plus className="mr-2 size-4" /> Add task
            </Button>
          </div>
        </div>

        {tasks.length > 0 && !tasksLoading ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/40 px-4 py-2 sm:px-6">
            <InputGroup className="h-8 w-full shadow-none sm:w-64">
              <InputGroupAddon>
                <Search className="size-3.5 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search title"
                value={taskQuery}
                onChange={(e) => setTaskQuery(e.target.value)}
              />
            </InputGroup>
            <Select
              value={taskStatusFilter}
              onValueChange={(v) =>
                setTaskStatusFilter(v as "all" | TaskStatusKey)
              }
            >
              <SelectTrigger size="sm" className="h-8 w-36 shadow-none">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {BOARD_COLUMNS.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          TASK_STATUS_STYLES[s].dot
                        )}
                      />
                      {TASK_STATUS_STYLES[s].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={taskPriorityFilter}
              onValueChange={(v) =>
                setTaskPriorityFilter(v as "all" | TaskPriorityKey)
              }
            >
              <SelectTrigger size="sm" className="h-8 w-36 shadow-none">
                <SelectValue placeholder="All priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={taskAssigneeFilter}
              onValueChange={setTaskAssigneeFilter}
            >
              <SelectTrigger size="sm" className="h-8 w-44 shadow-none">
                <SelectValue placeholder="All assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                <SelectItem value="__unassigned">Unassigned</SelectItem>
                {project.assignees.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={taskTypeFilter}
              onValueChange={(v) =>
                setTaskTypeFilter(v as "all" | TaskTypeKey)
              }
            >
              <SelectTrigger size="sm" className="h-8 w-32 shadow-none">
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
            {projectTags.length > 0 && (
              <Select value={taskTagFilter} onValueChange={setTaskTagFilter}>
                <SelectTrigger size="sm" className="h-8 w-36 shadow-none">
                  <SelectValue placeholder="All tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {projectTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasTaskFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTaskQuery("");
                  setTaskStatusFilter("all");
                  setTaskPriorityFilter("all");
                  setTaskAssigneeFilter("all");
                  setTaskTypeFilter("all");
                  setTaskTagFilter("all");
                }}
                className="h-8 text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 size-3.5" /> Clear
              </Button>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {filteredTasks.length} of {tasks.length}
            </span>
          </div>
        ) : null}

        {tasksLoading ? (
          view === "board" ? (
            <div className="flex gap-3 overflow-x-auto px-4 py-3 sm:px-6">
              {Array.from({ length: 6 }).map((_, col) => (
                <div
                  key={col}
                  className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/20 p-2"
                >
                  <div className="flex items-center justify-between px-1 py-1">
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="size-2 rounded-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-6 rounded-full" />
                  </div>
                  {Array.from({ length: 2 + (col % 2) }).map((_, i) => (
                    <div
                      key={i}
                      className="space-y-2 rounded-lg border bg-card p-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-14 rounded-full" />
                        <Skeleton className="h-4 w-10 rounded-full" />
                      </div>
                      <Skeleton className="h-3.5 w-4/5" />
                      <Skeleton className="h-3 w-3/5" />
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex -space-x-2">
                          <Skeleton className="size-6 rounded-full" />
                          <Skeleton className="size-6 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                  <Skeleton className="h-4 w-20 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-2/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="hidden h-6 w-24 rounded-full sm:block" />
                  <Skeleton className="hidden h-6 w-16 rounded-full md:block" />
                  <div className="flex -space-x-2">
                    <Skeleton className="size-7 rounded-full" />
                    <Skeleton className="size-7 rounded-full" />
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
              <ListChecks className="size-5" />
            </div>
            <p className="mt-1 text-sm font-semibold">No tasks yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Create the first task to start tracking work for this project.
            </p>
            <Button
              size="sm"
              className="mt-2"
              onClick={openCreateTask}
            >
              <Plus className="mr-1 size-3.5" /> Add task
            </Button>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
              <Search className="size-5" />
            </div>
            <p className="mt-1 text-sm font-semibold">No tasks match filters</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Try clearing filters or adjusting your search.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                setTaskQuery("");
                setTaskStatusFilter("all");
                setTaskPriorityFilter("all");
                setTaskAssigneeFilter("all");
                setTaskTypeFilter("all");
                setTaskTagFilter("all");
              }}
            >
              <X className="mr-1 size-3.5" /> Clear filters
            </Button>
          </div>
        ) : view === "board" ? (
          <div className="overflow-x-auto lg:flex-1 lg:min-h-0">
            <div className="flex gap-3 px-4 py-2 min-w-max sm:px-6 lg:h-full">
              {BOARD_COLUMNS.map((col) => {
                const colTasks = filteredTasks.filter((t) => t.status === col);
                const style = TASK_STATUS_STYLES[col];
                const isOver = dragOverCol === col;
                return (
                  <div
                    key={col}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverCol(col);
                    }}
                    onDragLeave={() =>
                      setDragOverCol((c) => (c === col ? null : c))
                    }
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggingId) moveTask(draggingId, col);
                      setDraggingId(null);
                      setDragOverCol(null);
                    }}
                    className={cn(
                      "flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border bg-muted/30 lg:h-full",
                      isOver && "ring-2 ring-primary/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 px-2.5 py-1.5 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn("size-2 rounded-full", style.dot)}
                        />
                        <span className="text-[11px] font-semibold uppercase tracking-wide">
                          {style.label}
                        </span>
                      </div>
                      <span className="rounded-full border bg-background px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 p-1.5 overflow-y-auto min-h-0 flex-1">
                      {colTasks.length === 0 ? (
                        <div className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
                          Drop tasks here
                        </div>
                      ) : (
                        colTasks.map((t) => (
                          <KanbanCard
                            key={t._id}
                            task={t}
                            dragging={draggingId === t._id}
                            projectMembers={project.assignees}
                            canEdit={canEditTask(t)}
                            canDelete={canDeleteTask(t)}
                            onOpen={() => openTaskTab(t._id)}
                            onEdit={() => openEditTask(t)}
                            onDelete={() => setPendingDeleteTask(t)}
                            onAssigneesChange={(next) =>
                              updateTaskAssignees(t._id, next)
                            }
                            onDragStart={() => setDraggingId(t._id)}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDragOverCol(null);
                            }}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden">
            <div className="hidden md:block md:flex-1 md:overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-8 w-28 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">ID</TableHead>
                  <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title</TableHead>
                  <TableHead className="h-8 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  <TableHead className="h-8 w-28 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Priority</TableHead>
                  <TableHead className="h-8 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</TableHead>
                  <TableHead className="h-8 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assigned</TableHead>
                  <TableHead className="h-8 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Due</TableHead>
                  <TableHead className="h-8 w-40 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assignees</TableHead>
                  <TableHead className="h-8 w-40 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reporting</TableHead>
                  <TableHead className="h-8 w-36 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created by</TableHead>
                  <TableHead className="h-8 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((t) => (
                  <TableRow
                    key={t._id}
                    className={cn(
                      "group cursor-pointer hover:bg-transparent",
                      STATUS_ROW_BG[t.status]
                    )}
                    onClick={() => openTaskTab(t._id)}
                  >
                    <TableCell className="px-3 py-1.5">
                      {t.taskId ? (
                        <span className="font-mono text-sm text-muted-foreground">
                          {t.taskId}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-sm font-medium">
                      <div className="group/title flex items-center gap-2">
                        <button
                          type="button"
                          className="text-left hover:text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTaskTab(t._id);
                          }}
                        >
                          {t.title}
                        </button>
                        <button
                          type="button"
                          aria-label="Copy task link"
                          title={
                            copiedTaskId === t._id
                              ? "Copied!"
                              : "Copy task link"
                          }
                          onClick={async (e) => {
                            e.stopPropagation();
                            const url = `${window.location.origin}/dashboard/projects/${project._id}?task=${t._id}`;
                            try {
                              await navigator.clipboard.writeText(url);
                              setCopiedTaskId(t._id);
                              toast.success("Task link copied");
                              setTimeout(() => {
                                setCopiedTaskId((c) =>
                                  c === t._id ? null : c
                                );
                              }, 1500);
                            } catch {
                              toast.error("Failed to copy");
                            }
                          }}
                          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-primary group-hover/title:opacity-100"
                        >
                          {copiedTaskId === t._id ? (
                            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Link2 className="size-3.5" />
                          )}
                        </button>
                        {canEditTask(t) && (
                          <button
                            type="button"
                            aria-label="Edit task"
                            title="Edit task"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditTask(t);
                            }}
                            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-primary group-hover/title:opacity-100"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                        {canDeleteTask(t) && (
                          <button
                            type="button"
                            aria-label="Delete task"
                            title="Delete task"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeleteTask(t);
                            }}
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
                    <TableCell
                      className="px-3 py-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Select
                        value={t.status}
                        onValueChange={(v) =>
                          moveTask(t._id, v as TaskStatusKey)
                        }
                        disabled={!canChangeTaskStatus(t)}
                      >
                        <SelectTrigger
                          size="sm"
                          className={cn(
                            "h-7 w-[130px] gap-1.5 border-transparent px-2 text-xs font-medium shadow-none hover:border-border",
                            TASK_STATUS_STYLES[t.status].cls
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
                                    TASK_STATUS_STYLES[s].dot
                                  )}
                                />
                                {TASK_STATUS_STYLES[s].label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <PriorityBadge priority={t.priority} />
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <TaskTypeBadge type={t.type ?? "new"} />
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-xs text-muted-foreground">
                      {formatShortDate(t.assignedDate)}
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <DueDateCell
                        due={t.dueDate}
                        status={t.status}
                      />
                    </TableCell>
                    <TableCell
                      className="px-3 py-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TaskAssigneeRow
                        selected={t.assignees}
                        options={project.assignees}
                        onChange={(next) => updateTaskAssignees(t._id, next)}
                        canEdit={canEditTask(t)}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <AssigneeBadges
                        users={t.reportingPersons}
                        max={3}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-sm text-muted-foreground">
                      {t.createdBy?.name ?? "—"}
                      {isTaskCreator(t) && (
                        <span className="ml-1 text-xs text-primary">(you)</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      {formatShortDate(t.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>

            <ul className="divide-y divide-border/40 md:hidden">
              {filteredTasks.map((t) => (
                  <li
                    key={t._id}
                    className={cn("p-3", STATUS_ROW_BG[t.status])}
                    onClick={() => openTaskTab(t._id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {t.taskId ? (
                            <span className="font-mono">{t.taskId}</span>
                          ) : null}
                          <PriorityBadge priority={t.priority} />
                        </div>
                        <div className="truncate text-sm font-medium">
                          {t.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <TaskStatusBadge status={t.status} />
                          {t.dueDate ? (
                            <DueDateCell due={t.dueDate} status={t.status} />
                          ) : null}
                          <span>{formatShortDate(t.createdAt)}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <AssigneeBadges
                          users={t.assignees}
                          max={3}
                          size="sm"
                        />
                      </div>
                    </div>
                  </li>
                ))}
            </ul>

          </div>
        )}
            </div>
          </TabsContent>

          <TabsContent
            value="files"
            className="flex-1 lg:min-h-0 lg:overflow-y-auto"
          >
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2 sm:px-6">
              <Paperclip className="size-3.5 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Files</h2>
              <span className="rounded-full border bg-background px-1.5 py-0 text-[11px] font-medium text-muted-foreground">
                {projectFilesCount}
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                From task descriptions &amp; project thread
              </span>
            </div>
            {projectFilesCount === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 p-8 text-center">
                <Paperclip className="size-5 text-muted-foreground" />
                <p className="text-sm font-medium">No files yet</p>
                <p className="text-xs text-muted-foreground">
                  Paste a media URL in a task description or project post.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 px-4 py-3 sm:px-6">
                {projectFiles.map((f) => (
                  <div key={f.id} className="flex flex-col gap-1">
                    <MediaThumb
                      item={{ src: f.src, kind: f.kind, filename: f.filename }}
                      onOpen={() =>
                        setFilesLightbox({
                          src: f.src,
                          kind: f.kind,
                          filename: f.filename,
                        })
                      }
                    />
                    <div className="px-0.5 leading-tight">
                      <div
                        className="truncate text-[11px] font-medium"
                        title={f.filename}
                      >
                        {f.filename}
                      </div>
                      <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                        <span className="truncate" title={f.source}>
                          {f.source}
                        </span>
                        {f.date ? (
                          <span className="shrink-0">
                            {formatShortDate(f.date)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="logs"
            className="flex flex-1 flex-col lg:min-h-0"
          >
            {(() => {
              const userOptions = isAdmin
                ? Array.from(
                    new Map(
                      [
                        ...(project.assignees ?? []),
                        ...(project.reportingTo ?? []),
                      ].map((u) => [u._id, { id: u._id, name: u.name }]),
                    ).values(),
                  )
                : [];

              return (
                <div className="flex flex-1 flex-col lg:min-h-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-2 shrink-0 sm:px-6">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold">Logs</h2>
                      <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {logsLoading ? "…" : logTotal}
                      </span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        · {logTotalHours}h total
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingLogId(null);
                        setLogTaskId("project");
                        setLogDate(new Date());
                        setLogStartHour("09");
                        setLogStartMin("00");
                        setLogEndHour("10");
                        setLogEndMin("00");
                        setLogNote("");
                        setLogDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-2 size-4" /> Add log
                    </Button>
                  </div>

                  {(isAdmin || logTotal > 0) && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/40 px-4 py-2 sm:px-6">
                      {isAdmin && (
                        <Select
                          value={logUserFilter}
                          onValueChange={(v) => {
                            setLogUserFilter(v);
                            setLogPage(1);
                          }}
                        >
                          <SelectTrigger size="sm" className="h-8 w-44 shadow-none">
                            <SelectValue placeholder="All users" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All users</SelectItem>
                            {userOptions.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {isAdmin && logUserFilter !== "all" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLogUserFilter("all");
                            setLogPage(1);
                          }}
                          className="h-8 text-muted-foreground hover:text-foreground"
                        >
                          <X className="mr-1 size-3.5" /> Clear
                        </Button>
                      )}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {logTotal} of {logTotal}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden">
                    <div className="md:flex-1 md:overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/40 bg-muted/40 hover:bg-muted/40">
                            <TableHead className="h-9 w-48 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              User
                            </TableHead>
                            <TableHead className="h-9 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Task
                            </TableHead>
                            <TableHead className="h-9 w-32 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Date
                            </TableHead>
                            <TableHead className="h-9 w-40 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Time
                            </TableHead>
                            <TableHead className="h-9 w-28 px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Duration
                            </TableHead>
                            <TableHead className="h-9 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Note
                            </TableHead>
                            <TableHead className="h-9 w-20 px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logsLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                              <TableRow key={`skel-${i}`} className="border-border/40">
                                <TableCell className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <Skeleton className="size-6 rounded-full" />
                                    <Skeleton className="h-3 w-24" />
                                  </div>
                                </TableCell>
                                <TableCell className="px-3 py-2">
                                  <Skeleton className="h-3 w-40" />
                                </TableCell>
                                <TableCell className="px-3 py-2">
                                  <Skeleton className="h-3 w-20" />
                                </TableCell>
                                <TableCell className="px-3 py-2">
                                  <Skeleton className="h-3 w-28" />
                                </TableCell>
                                <TableCell className="px-3 py-2">
                                  <Skeleton className="ml-auto h-3 w-12" />
                                </TableCell>
                                <TableCell className="px-3 py-2">
                                  <Skeleton className="h-3 w-48" />
                                </TableCell>
                                <TableCell className="px-3 py-2">
                                  <Skeleton className="ml-auto h-3 w-12" />
                                </TableCell>
                              </TableRow>
                            ))
                          ) : logs.length === 0 ? (
                            <TableRow className="border-border/40 hover:bg-transparent">
                              <TableCell
                                colSpan={7}
                                className="h-40 text-center text-sm text-muted-foreground"
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <Clock className="size-5 text-muted-foreground/60" />
                                  <span className="font-medium">No logs yet</span>
                                  <span className="text-xs">
                                    Click Add log to record time worked.
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            logs.map((l) => (
                              <TableRow
                                key={l._id}
                                className="border-border/40 hover:bg-muted/30"
                              >
                                <TableCell className="px-3 py-2.5 align-top">
                                  <div className="flex items-center gap-2">
                                    <UserInitialsAvatar
                                      name={l.user?.name ?? "?"}
                                      role={l.user?.role}
                                      className="size-7 text-[11px]"
                                    />
                                    <span className="text-sm font-medium">
                                      {l.user?.name ?? "—"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="px-3 py-2.5 align-top text-sm">
                                  {l.task ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      {l.task.taskId && (
                                        <span className="font-mono text-xs text-muted-foreground">
                                          {l.task.taskId}
                                        </span>
                                      )}
                                      <span>{l.task.title}</span>
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      Project (general)
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="px-3 py-2.5 align-top text-sm tabular-nums text-muted-foreground whitespace-nowrap">
                                  {formatShortDate(l.date)}
                                </TableCell>
                                <TableCell className="px-3 py-2.5 align-top font-mono text-sm tabular-nums text-muted-foreground whitespace-nowrap">
                                  {l.startTime} – {l.endTime}
                                </TableCell>
                                <TableCell className="px-3 py-2.5 align-top text-right">
                                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-sm font-semibold tabular-nums text-primary">
                                    {l.hours}h
                                  </span>
                                </TableCell>
                                <TableCell
                                  className="max-w-[420px] whitespace-pre-wrap break-words px-3 py-2.5 align-top text-sm text-muted-foreground"
                                  title={l.note || undefined}
                                >
                                  {l.note || "—"}
                                </TableCell>
                                <TableCell className="px-3 py-2.5 align-top text-right">
                                  {(canEdit ||
                                    (sessionUserId &&
                                      l.user?._id === sessionUserId)) && (
                                    <div className="flex items-center justify-end gap-0.5">
                                      <button
                                        type="button"
                                        aria-label="Edit log"
                                        title="Edit log"
                                        onClick={() => {
                                          setEditingLogId(l._id);
                                          setLogTaskId(l.task?._id ?? "project");
                                          setLogDate(new Date(l.date));
                                          const [sh, sm] = l.startTime.split(":");
                                          const [eh, em] = l.endTime.split(":");
                                          setLogStartHour(sh ?? "09");
                                          setLogStartMin(sm ?? "00");
                                          setLogEndHour(eh ?? "10");
                                          setLogEndMin(em ?? "00");
                                          setLogNote(l.note ?? "");
                                          setLogDialogOpen(true);
                                        }}
                                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                                      >
                                        <Pencil className="size-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label="Delete log"
                                        title="Delete log"
                                        onClick={() => setPendingDeleteLog(l)}
                                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {logTotal > LOG_PAGE_SIZE && (
                      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/40 px-4 py-3 sm:px-6">
                        <span className="text-xs text-muted-foreground">
                          Showing {(logPage - 1) * LOG_PAGE_SIZE + 1}-
                          {Math.min(logPage * LOG_PAGE_SIZE, logTotal)} of {logTotal}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                            disabled={logPage === 1 || logsLoading}
                          >
                            Prev
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Page {logPage} / {logTotalPages}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setLogPage((p) => Math.min(logTotalPages, p + 1))
                            }
                            disabled={logPage >= logTotalPages || logsLoading}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <Dialog
                    open={logDialogOpen}
                    onOpenChange={(open) => {
                      setLogDialogOpen(open);
                      if (!open) setEditingLogId(null);
                    }}
                  >
                    <DialogContent className="sm:max-w-[640px]">
                      <DialogHeader>
                        <DialogTitle>
                          {editingLogId ? "Edit time log" : "Add time log"}
                        </DialogTitle>
                        <DialogDescription>
                          {editingLogId
                            ? "Update hours worked on the project or task."
                            : "Record hours worked on the project or a specific task."}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                          <Label>Task</Label>
                          <Select value={logTaskId} onValueChange={setLogTaskId}>
                            <SelectTrigger className="h-9 w-full shadow-none">
                              <SelectValue placeholder="Pick task" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="project">Project (general)</SelectItem>
                              {tasks.map((t) => (
                                <SelectItem key={t._id} value={t._id}>
                                  {t.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-[1fr_1fr_1fr_90px] gap-3">
                          <div className="grid gap-1.5">
                            <Label>Date</Label>
                            <DatePicker
                              value={logDate}
                              onChange={setLogDate}
                              clearable={false}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>Start</Label>
                            <TimeClockPicker
                              ariaLabel="Start time"
                              value={`${logStartHour}:${logStartMin}`}
                              onChange={(v) => {
                                const [h, m] = v.split(":");
                                setLogStartHour(h);
                                setLogStartMin(m);
                              }}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>End</Label>
                            <TimeClockPicker
                              ariaLabel="End time"
                              value={`${logEndHour}:${logEndMin}`}
                              onChange={(v) => {
                                const [h, m] = v.split(":");
                                setLogEndHour(h);
                                setLogEndMin(m);
                              }}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>Duration</Label>
                            <div
                              className={cn(
                                "flex h-9 w-full items-center justify-center rounded-md border px-3 text-sm font-semibold tabular-nums",
                                computedLogHours > 0
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : "bg-background text-muted-foreground",
                              )}
                            >
                              {computedLogHours > 0 ? `${computedLogHours}h` : "—"}
                            </div>
                          </div>
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Note</Label>
                          <Textarea
                            rows={4}
                            className="w-full resize-y shadow-none"
                            value={logNote}
                            onChange={(e) => setLogNote(e.target.value)}
                            placeholder="What did you work on?"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setLogDialogOpen(false)}
                          disabled={logsSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          disabled={logsSubmitting}
                          onClick={async () => {
                            if (!session || !logDate) {
                              toast.error("Pick date");
                              return;
                            }
                            if (computedLogHours <= 0) {
                              toast.error("End time must be after start time");
                              return;
                            }
                            setLogsSubmitting(true);
                            try {
                              const isEdit = Boolean(editingLogId);
                              const res = await fetch(
                                isEdit
                                  ? `/api/logs/${editingLogId}`
                                  : `/api/projects/${project._id}/logs`,
                                {
                                  method: isEdit ? "PATCH" : "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    task: logTaskId === "project" ? null : logTaskId,
                                    date: logDate.toISOString(),
                                    startTime: `${logStartHour}:${logStartMin}`,
                                    endTime: `${logEndHour}:${logEndMin}`,
                                    note: logNote.trim(),
                                  }),
                                }
                              );
                              if (!res.ok) {
                                const data = await res.json().catch(() => ({}));
                                throw new Error(
                                  data.error ?? (isEdit ? "Failed to update log" : "Failed to add log")
                                );
                              }
                              setLogNote("");
                              setLogDialogOpen(false);
                              setEditingLogId(null);
                              toast.success(isEdit ? "Log updated" : "Log added");
                              if (!isEdit) setLogPage(1);
                              fetchLogs();
                            } catch (err) {
                              const msg = err instanceof Error ? err.message : "Failed";
                              toast.error(msg);
                            } finally {
                              setLogsSubmitting(false);
                            }
                          }}
                        >
                          {logsSubmitting
                            ? "Saving…"
                            : editingLogId
                              ? "Save changes"
                              : "Save log"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog
                    open={Boolean(pendingDeleteLog)}
                    onOpenChange={(open) =>
                      !open && !deletingLog && setPendingDeleteLog(null)
                    }
                  >
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this log?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {pendingDeleteLog
                            ? `${pendingDeleteLog.hours}h on ${formatShortDate(pendingDeleteLog.date)} will be permanently removed.`
                            : ""}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingLog}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          disabled={deletingLog}
                          onClick={async (e) => {
                            e.preventDefault();
                            if (!pendingDeleteLog) return;
                            setDeletingLog(true);
                            try {
                              const res = await fetch(
                                `/api/logs/${pendingDeleteLog._id}`,
                                { method: "DELETE" }
                              );
                              if (!res.ok) {
                                const data = await res.json().catch(() => ({}));
                                throw new Error(
                                  data.error ?? "Failed to delete log"
                                );
                              }
                              toast.success("Log deleted");
                              setPendingDeleteLog(null);
                              fetchLogs();
                            } catch (err) {
                              const msg =
                                err instanceof Error ? err.message : "Failed";
                              toast.error(msg);
                            } finally {
                              setDeletingLog(false);
                            }
                          }}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          {deletingLog ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })()}
          </TabsContent>

          {pendingTaskTabIds.map((tid) => (
            <TabsContent
              key={tid}
              value={`task:${tid}`}
              className="flex-1 lg:min-h-0 lg:overflow-y-auto"
            >
              <TaskTabSkeleton />
            </TabsContent>
          ))}

          {openTaskTabs.map((t) => {
            const state = taskTabs[t._id];
            if (!state) return null;
            return (
              <TabsContent
                key={t._id}
                value={`task:${t._id}`}
                className="flex-1 lg:min-h-0 lg:overflow-hidden"
              >
                <div className="flex flex-col lg:h-full lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="scrollbar-hide min-w-0 lg:overflow-y-auto lg:border-r lg:border-border/40">
                    <div>
                      <div className="flex h-12 items-center gap-2 border-b border-border/40 px-4 sm:px-6">
                        <FileText className="size-4 text-primary" />
                        <h3 className="text-sm font-semibold tracking-tight">
                          Description
                        </h3>
                      </div>
                      <div className="px-4 py-3 sm:px-6">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {t.createdBy && (
                            <span className="font-medium text-foreground">
                              {t.createdBy.name}
                            </span>
                          )}
                          <span>· {formatDate(t.createdAt)}</span>
                        </div>
                        <div className="mt-1">
                          {t.description && t.description.trim() !== "" ? (
                            <RichTextViewer html={t.description} />
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No description.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <SubtaskPanel
                        task={t}
                        mentionUsers={mentionUsersForTask(t._id)}
                        hashTasks={hashTasks}
                        projectMembers={project.assignees}
                        canEdit={canChangeTaskStatus(t)}
                        canManage={canEditTask(t)}
                        onSave={(next, subtaskMention) =>
                          saveSubtasks(t._id, next, subtaskMention)
                        }
                      />

                      <div>
                        <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5 sm:px-6">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="size-4 text-primary" />
                            <h3 className="text-sm font-semibold tracking-tight">
                              Comments
                            </h3>
                            <span className="rounded-full border bg-background px-1.5 py-0 text-[11px] font-medium text-muted-foreground">
                              {state.comments.length}
                            </span>
                          </div>
                        </div>

                        <div className="border-b border-border/40 px-4 py-2 sm:px-6">
                        {!state.composerOpen ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateTaskTab(t._id, { composerOpen: true })
                            }
                            className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2.5 text-left text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          >
                            <MessageSquare className="size-3.5 text-muted-foreground" />
                            Comment...
                          </button>
                        ) : (
                          <form
                            onSubmit={(e) => postTaskComment(e, t._id)}
                            className="space-y-3"
                          >
                            <FormAlert message={state.alert} />
                            <RichTextEditor
                              value={state.draft}
                              onChange={(v) => {
                                updateTaskTab(t._id, {
                                  draft: v,
                                  alert: state.alert ? null : state.alert,
                                });
                              }}
                              placeholder="Reply — @mention, #link tasks, paste URLs…"
                              minHeight="min-h-20"
                              mentionUsers={mentionUsersForTask(t._id)}
                              hashTasks={hashTasks}
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateTaskTab(t._id, {
                                    draft: "",
                                    alert: null,
                                    composerOpen: false,
                                  })
                                }
                                disabled={state.posting}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                disabled={state.posting}
                                size="sm"
                              >
                                <Send className="mr-2 size-4" />
                                {state.posting
                                  ? "Posting…"
                                  : "Post comment"}
                              </Button>
                            </div>
                          </form>
                        )}
                      </div>

                      {state.loading ? (
                        <div className="space-y-4 px-4 py-4">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <Skeleton className="size-7 shrink-0 rounded-full" />
                              <div className="flex-1 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Skeleton className="h-3 w-24" />
                                  <Skeleton className="h-3 w-10 rounded-full" />
                                  <Skeleton className="h-3 w-16" />
                                </div>
                                <Skeleton
                                  className="h-3"
                                  style={{ width: `${70 - i * 12}%` }}
                                />
                                <Skeleton
                                  className="h-3"
                                  style={{ width: `${55 - i * 10}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : state.comments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-1 p-6 text-center">
                          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                            <MessageSquare className="size-4" />
                          </div>
                          <p className="mt-1 text-sm font-semibold">
                            No comments yet
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Start the discussion — be the first to reply.
                          </p>
                        </div>
                      ) : (
                        <ul className="divide-y divide-border/40">
                          {[...state.comments]
                            .sort(
                              (a, b) =>
                                new Date(b.createdAt ?? 0).getTime() -
                                new Date(a.createdAt ?? 0).getTime()
                            )
                            .map((c) =>
                              c.kind === "system" ? (
                                <li
                                  key={c._id}
                                  className="flex items-center gap-2 px-4 py-1 text-[11px] text-muted-foreground"
                                >
                                  <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] text-muted-foreground">
                                    •
                                  </span>
                                  <span>
                                    <span className="font-medium text-foreground">
                                      {c.author?.name ?? "System"}
                                    </span>{" "}
                                    {c.body}{" "}
                                    <span className="text-muted-foreground">
                                      · {formatDate(c.createdAt)}
                                    </span>
                                  </span>
                                </li>
                              ) : (
                                <li
                                  key={c._id}
                                  className="flex items-start gap-2 px-4 py-1.5"
                                >
                                  <UserInitialsAvatar
                                    name={c.author?.name ?? "?"}
                                    role={c.author?.role}
                                    className="size-6 text-[9px]"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                      <span className="font-medium text-foreground">
                                        {c.author?.name ?? "Unknown"}
                                      </span>
                                      <span>· {formatDate(c.createdAt)}</span>
                                    </div>
                                    <div className="mt-1">
                                      <RichTextViewer html={c.body} />
                                    </div>
                                  </div>
                                </li>
                              )
                            )}
                        </ul>
                      )}
                    </div>
                  </div>

                    <aside className="scrollbar-hide border-t border-border/40 lg:border-t-0 lg:overflow-y-auto">
                      <div className="flex h-12 items-center justify-between gap-2 border-b border-border/40 px-4 sm:px-6">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="size-4 text-primary" />
                          <h3 className="text-sm font-semibold tracking-tight">
                            Task info
                          </h3>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Copy task link"
                            title={
                              copiedTaskId === t._id
                                ? "Copied!"
                                : "Copy task link"
                            }
                            onClick={async () => {
                              const url = `${window.location.origin}/dashboard/projects/${project._id}?task=${t._id}`;
                              try {
                                await navigator.clipboard.writeText(url);
                                setCopiedTaskId(t._id);
                                toast.success("Task link copied");
                                setTimeout(() => {
                                  setCopiedTaskId((c) =>
                                    c === t._id ? null : c
                                  );
                                }, 1500);
                              } catch {
                                toast.error("Failed to copy");
                              }
                            }}
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            {copiedTaskId === t._id ? (
                              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Link2 className="size-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => closeTaskTab(t._id)}
                            aria-label="Close tab"
                            title="Close tab"
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 border-b border-border/40 px-4 py-3 sm:px-6">
                        <h2 className="break-words text-base font-semibold leading-snug">
                          {t.title}
                        </h2>
                        {t.taskId && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {t.taskId}
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="space-y-3 px-4 py-3 text-sm sm:px-6">
                          <InfoField label="Status">
                            <Select
                              value={t.status}
                              onValueChange={(v) =>
                                moveTask(t._id, v as TaskStatusKey)
                              }
                              disabled={!canChangeTaskStatus(t)}
                            >
                              <SelectTrigger
                                className={cn(
                                  "h-9 w-full gap-1.5 px-3 text-sm font-medium shadow-none",
                                  TASK_STATUS_STYLES[t.status].cls
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
                                          TASK_STATUS_STYLES[s].dot
                                        )}
                                      />
                                      {TASK_STATUS_STYLES[s].label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </InfoField>

                          <InfoField label="Priority">
                            {canEditTask(t) ? (
                              <PrioritySelect
                                value={t.priority}
                                onChange={(p) =>
                                  patchTaskField(
                                    t._id,
                                    { priority: p },
                                    { priority: p },
                                    "priority"
                                  )
                                }
                                triggerClassName="h-9 w-full px-3 text-sm"
                              />
                            ) : (
                              <PriorityBadge priority={t.priority} />
                            )}
                          </InfoField>

                          <InfoField label="Type">
                            {canEditTask(t) ? (
                              <Select
                                value={t.type ?? "new"}
                                onValueChange={(v) =>
                                  patchTaskField(
                                    t._id,
                                    { type: v as TaskTypeKey },
                                    { type: v as TaskTypeKey },
                                    "type"
                                  )
                                }
                              >
                                <SelectTrigger className="h-9 w-full text-sm shadow-none">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(TASK_TYPE_STYLES) as TaskTypeKey[]).map(
                                    (k) => (
                                      <SelectItem key={k} value={k}>
                                        <span className="flex items-center gap-2">
                                          <span
                                            className={cn(
                                              "size-1.5 rounded-full",
                                              TASK_TYPE_STYLES[k].dot
                                            )}
                                          />
                                          {TASK_TYPE_STYLES[k].label}
                                        </span>
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                            ) : (
                              <TaskTypeBadge type={t.type ?? "new"} />
                            )}
                          </InfoField>

                          <InfoField label="Tags">
                            {canEditTask(t) ? (
                              <TagsInput
                                value={t.tags ?? []}
                                onChange={(next) =>
                                  patchTaskField(
                                    t._id,
                                    { tags: next },
                                    { tags: next },
                                    "tags"
                                  )
                                }
                                suggestions={projectTags}
                                placeholder="Add tag"
                              />
                            ) : (t.tags ?? []).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {(t.tags ?? []).map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center rounded-full border bg-muted/60 px-2 py-0.5 text-xs"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                —
                              </span>
                            )}
                          </InfoField>

                          <InfoField label="Assigned">
                            {canEditTask(t) ? (
                              <DatePicker
                                value={
                                  t.assignedDate
                                    ? new Date(t.assignedDate)
                                    : null
                                }
                                onChange={(d) =>
                                  patchTaskField(
                                    t._id,
                                    {
                                      assignedDate: d
                                        ? d.toISOString()
                                        : null,
                                    },
                                    {
                                      assignedDate: d
                                        ? d.toISOString()
                                        : null,
                                    },
                                    "assigned date"
                                  )
                                }
                                className="h-9 text-sm"
                                placeholder="Pick start"
                              />
                            ) : (
                              <span className="text-sm">
                                {t.assignedDate
                                  ? formatDate(t.assignedDate)
                                  : "—"}
                              </span>
                            )}
                          </InfoField>

                          <InfoField label="Due">
                            {canEditTask(t) ? (
                              <DatePicker
                                value={
                                  t.dueDate ? new Date(t.dueDate) : null
                                }
                                onChange={(d) =>
                                  patchTaskField(
                                    t._id,
                                    {
                                      dueDate: d ? d.toISOString() : null,
                                    },
                                    {
                                      dueDate: d ? d.toISOString() : null,
                                    },
                                    "due date"
                                  )
                                }
                                className="h-9 text-sm"
                                placeholder="Pick due"
                              />
                            ) : (
                              <span className="text-sm">
                                {t.dueDate ? formatDate(t.dueDate) : "—"}
                              </span>
                            )}
                          </InfoField>

                          <InfoField label="Assignees">
                            <TaskAssigneeRow
                              selected={t.assignees}
                              options={project.assignees}
                              onChange={(next) =>
                                updateTaskAssignees(t._id, next)
                              }
                              canEdit={canEditTask(t)}
                            />
                          </InfoField>

                          <InfoField label="Reporting">
                            <TaskAssigneeRow
                              selected={t.reportingPersons ?? []}
                              options={[
                                ...project.assignees,
                                ...(project.reportingTo ?? []),
                              ]}
                              onChange={(next) =>
                                updateTaskReporting(t._id, next)
                              }
                              canEdit={canEditTask(t)}
                            />
                          </InfoField>

                          <div className="border-t border-border/40 pt-3 text-xs text-muted-foreground">
                            <div className="flex items-center justify-between gap-2">
                              <span>Created by</span>
                              <span className="font-medium text-foreground">
                                {t.createdBy?.name ?? "—"}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <span>Created</span>
                              <span>{formatDate(t.createdAt)}</span>
                            </div>
                            {t.updatedAt && (
                              <div className="mt-1.5 flex items-center justify-between gap-2">
                                <span>Updated</span>
                                <span>{formatDate(t.updatedAt)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </aside>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
        </div>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent
          className="sm:max-w-xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <form onSubmit={handleCreateTask} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{taskEditId ? "Edit task" : "Add task"}</DialogTitle>
              <DialogDescription>
                {taskEditId
                  ? `Update details for this task in ${project.name}.`
                  : `Create a task under ${project.name}.`}
              </DialogDescription>
            </DialogHeader>

            <FormAlert message={taskAlert} />

            <div className="grid gap-1.5">
              <Label htmlFor="task-title">
                Title
                <RequiredMark />
              </Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => {
                  setTaskTitle(e.target.value);
                  if (taskErrors.title)
                    setTaskErrors((p) => ({ ...p, title: "" }));
                }}
                placeholder="Short, action-oriented title"
                aria-invalid={taskErrors.title ? true : undefined}
                className="shadow-none"
                autoFocus
              />
              <FieldError reserve message={taskErrors.title} />
            </div>

            <div className="grid gap-1.5">
              <Label>Description</Label>
              <RichTextEditor
                value={taskDesc}
                onChange={setTaskDesc}
                placeholder="Describe the task — @mention people, #link tasks, paste URLs…"
                minHeight="min-h-32"
                invalid={Boolean(taskErrors.description)}
                mentionUsers={projectMembers}
                hashTasks={hashTasks}
              />
              <FieldError message={taskErrors.description} />
            </div>

            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select
                  value={taskStatus}
                  onValueChange={(v) => setTaskStatus(v as TaskStatusKey)}
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
                              TASK_STATUS_STYLES[s].dot
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
                  value={taskPriority}
                  onChange={setTaskPriority}
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
                              TASK_TYPE_STYLES[k].dot
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
                value={taskTags}
                onChange={setTaskTags}
                suggestions={projectTags}
                placeholder="Add tag — Enter to add"
              />
            </div>

            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="task-assigned">Assigned date</Label>
                <DatePicker
                  id="task-assigned"
                  value={taskAssignedDate}
                  onChange={setTaskAssignedDate}
                  placeholder="Pick start date"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="task-due">Due date</Label>
                <DatePicker
                  id="task-due"
                  value={taskDueDate}
                  onChange={setTaskDueDate}
                  placeholder="Pick due date"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Assignees</Label>
                <ProjectUserPicker
                  options={taskPickerOptions}
                  selected={taskAssignees}
                  onChange={setTaskAssignees}
                  placeholder="Select assignees"
                />
                <FieldError message={taskErrors.assignees} />
              </div>
              <div className="grid gap-1.5">
                <Label>Reporting persons</Label>
                <ProjectUserPicker
                  options={taskPickerOptions}
                  selected={taskReporting}
                  onChange={setTaskReporting}
                  placeholder="Select reporting persons"
                />
                <FieldError message={taskErrors.reportingPersons} />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTaskDialogOpen(false)}
                disabled={taskSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={taskSubmitting}>
                {taskSubmitting
                  ? taskEditId
                    ? "Saving…"
                    : "Creating…"
                  : taskEditId
                  ? "Save changes"
                  : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <MediaLightbox
        media={filesLightbox}
        onClose={() => setFilesLightbox(null)}
      />

      <AlertDialog
        open={Boolean(pendingDeleteTask)}
        onOpenChange={(open) =>
          !open && !deletingTask && setPendingDeleteTask(null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteTask
                ? `"${pendingDeleteTask.title}" will be permanently deleted. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingTask}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteTask();
              }}
              disabled={deletingTask}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletingTask ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function renderSubtaskTitle(
  title: string,
  hashTasks: HashTask[] | undefined,
  mentionUsers:
    | { _id: string; name: string; email?: string; role?: UserRole }[]
    | undefined
) {
  const byTaskId = new Map((hashTasks ?? []).map((t) => [t.taskId, t]));
  const nameToUser = new Map(
    (mentionUsers ?? []).map((u) => [u.name, u])
  );
  const sortedNames = (mentionUsers ?? [])
    .map((u) => u.name)
    .sort((a, b) => b.length - a.length);

  const hashChipCls =
    "inline-block rounded-sm bg-primary/15 px-1.5 font-mono text-[0.75rem] text-primary no-underline hover:underline whitespace-nowrap";
  const mentionChipCls =
    "inline-block rounded-sm bg-primary/15 px-1.5 text-[0.8125rem] font-medium text-primary whitespace-nowrap";

  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;
  let buf = "";
  const flush = () => {
    if (buf) {
      parts.push(buf);
      buf = "";
    }
  };

  while (i < title.length) {
    const ch = title[i];
    const prev = i === 0 ? " " : title[i - 1];
    const atBoundary = /\s/.test(prev) || i === 0;

    if (ch === "#" && atBoundary) {
      const rest = title.slice(i + 1);
      const m = /^([A-Za-z0-9_-]+)/.exec(rest);
      if (m) {
        const ref = byTaskId.get(m[1]);
        flush();
        if (ref) {
          parts.push(
            <a
              key={key++}
              href={`/dashboard/projects/${ref.projectId}?task=${ref._id}`}
              className={hashChipCls}
              data-type="hashtag"
              data-id={ref._id}
              data-label={ref.taskId}
              data-project-id={ref.projectId}
              onClick={(e) => e.stopPropagation()}
            >
              #{ref.taskId}
            </a>
          );
        } else {
          parts.push(`#${m[1]}`);
        }
        i += 1 + m[1].length;
        continue;
      }
    }

    if (ch === "@" && atBoundary) {
      const rest = title.slice(i + 1);
      const matched = sortedNames.find((n) => rest.startsWith(n));
      if (matched) {
        const user = nameToUser.get(matched);
        flush();
        parts.push(
          <span
            key={key++}
            className={mentionChipCls}
            data-type="mention"
            data-id={user?._id}
            data-label={matched}
          >
            @{matched}
          </span>
        );
        i += 1 + matched.length;
        continue;
      }
    }

    buf += ch;
    i += 1;
  }
  flush();
  return parts.length > 0 ? parts : title;
}

function SubtaskPanel({
  task,
  mentionUsers,
  hashTasks,
  projectMembers,
  canEdit = true,
  canManage = true,
  onSave,
}: {
  task: Task;
  mentionUsers?: {
    _id: string;
    name: string;
    email?: string;
    role?: UserRole;
  }[];
  hashTasks?: HashTask[];
  projectMembers?: UserLite[];
  canEdit?: boolean;
  canManage?: boolean;
  onSave: (
    next: Subtask[],
    subtaskMention?: { title: string; mentionIds: string[] }
  ) => void | Promise<void>;
}) {
  const subtasks = task.subtasks ?? [];
  const total = subtasks.length;
  const done = subtasks.filter((s) => s.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const allDone = total > 0 && done === total;

  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Subtask | null>(null);
  const [draftMentions, setDraftMentions] = useState<Set<string>>(new Set());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editMentions, setEditMentions] = useState<Set<string>>(new Set());

  function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (title.length === 0) return;
    const next: Subtask[] = [
      ...subtasks,
      { _id: `tmp-${Date.now()}`, title, completed: false },
    ];
    const mentionIds = title.includes("@") ? Array.from(draftMentions) : [];
    setDraft("");
    setDraftMentions(new Set());
    setAdding(false);
    onSave(
      next,
      mentionIds.length > 0 ? { title, mentionIds } : undefined
    );
  }

  function toggle(id: string) {
    const next = subtasks.map((s) =>
      s._id === id ? { ...s, completed: !s.completed } : s
    );
    onSave(next);
  }

  function confirmRemove() {
    if (!pendingRemove) return;
    const id = pendingRemove._id;
    setPendingRemove(null);
    onSave(subtasks.filter((s) => s._id !== id));
  }

  function startEdit(s: Subtask) {
    setEditingId(s._id);
    setEditDraft(s.title);
    setEditMentions(new Set());
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
    setEditMentions(new Set());
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const title = editDraft.trim();
    if (title.length === 0) return;
    const target = subtasks.find((s) => s._id === editingId);
    if (!target) {
      cancelEdit();
      return;
    }
    if (title === target.title && editMentions.size === 0) {
      cancelEdit();
      return;
    }
    const next = subtasks.map((s) =>
      s._id === editingId ? { ...s, title } : s
    );
    const mentionIds =
      title.includes("@") && editMentions.size > 0
        ? Array.from(editMentions)
        : [];
    cancelEdit();
    onSave(
      next,
      mentionIds.length > 0 ? { title, mentionIds } : undefined
    );
  }

  return (
    <div className="border-b border-border/40">
      <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5 sm:px-6">
        <ListChecks className="size-4 text-primary" />
        <h3 className="text-sm font-semibold tracking-tight">Subtasks</h3>
        <span className="rounded-full border bg-background px-1.5 py-0 text-[11px] font-medium text-muted-foreground">
          {done}/{total}
        </span>
        {total > 0 && (
          <div className="h-1.5 max-w-40 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                allDone ? "bg-emerald-500" : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {task.status !== "done" && total > 0 && !allDone && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Complete all to mark Done
          </span>
        )}
      </div>
      <div className="px-4 py-3 sm:px-6">

      {total > 0 && (
        <ul className="mb-2 flex flex-col gap-2">
          {subtasks.map((s) => {
            const isEditing = editingId === s._id;
            return (
              <li
                key={s._id}
                className="group flex items-center gap-3 rounded-lg border bg-background px-3 py-2 transition-colors hover:border-primary/30"
              >
                <button
                  type="button"
                  onClick={() => canEdit && !isEditing && toggle(s._id)}
                  disabled={isEditing || !canEdit}
                  aria-label={s.completed ? "Mark incomplete" : "Mark complete"}
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    s.completed
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-muted-foreground/40 hover:border-primary",
                    !canEdit && "cursor-not-allowed opacity-60"
                  )}
                >
                  {s.completed && <Check className="size-3" strokeWidth={3} />}
                </button>
                {isEditing ? (
                  <form
                    onSubmit={saveEdit}
                    className="flex flex-1 items-center gap-2"
                  >
                    <MentionInput
                      value={editDraft}
                      onChange={setEditDraft}
                      onMention={(id) =>
                        setEditMentions((prev) => {
                          const next = new Set(prev);
                          next.add(id);
                          return next;
                        })
                      }
                      mentionUsers={mentionUsers}
                      hashTasks={hashTasks}
                      placeholder="Edit subtask — @mention, #link tasks"
                      autoFocus
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={editDraft.trim().length === 0}
                    >
                      <Check className="size-3.5" /> Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className={cn(
                          "min-w-0 flex-1 break-words text-left text-sm leading-5",
                          s.completed && "text-muted-foreground line-through"
                        )}
                      >
                        {renderSubtaskTitle(s.title, hashTasks, mentionUsers)}
                      </button>
                    ) : (
                      <span
                        className={cn(
                          "min-w-0 flex-1 break-words text-sm leading-5",
                          s.completed && "text-muted-foreground line-through"
                        )}
                      >
                        {renderSubtaskTitle(s.title, hashTasks, mentionUsers)}
                      </span>
                    )}
                    {canManage ? (
                      <SubtaskAssigneeControl
                        value={s.assignee ?? null}
                        members={projectMembers ?? []}
                        onChange={(user) => {
                          const next = subtasks.map((x) =>
                            x._id === s._id ? { ...x, assignee: user } : x
                          );
                          onSave(next);
                        }}
                      />
                    ) : s.assignee ? (
                      <UserInitialsAvatar
                        name={s.assignee.name}
                        role={s.assignee.role}
                        className="size-7 shrink-0 text-[10px]"
                      />
                    ) : null}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setPendingRemove(s)}
                        aria-label="Remove subtask"
                        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={Boolean(pendingRemove)}
        onOpenChange={(open) => !open && setPendingRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this subtask?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove
                ? `"${pendingRemove.title}" will be permanently removed from this task.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canManage && adding ? (
        <form onSubmit={addSubtask} className="flex items-center gap-2">
          <MentionInput
            value={draft}
            onChange={setDraft}
            onMention={(id) =>
              setDraftMentions((prev) => {
                const next = new Set(prev);
                next.add(id);
                return next;
              })
            }
            mentionUsers={mentionUsers}
            hashTasks={hashTasks}
            placeholder="New subtask — @mention, #link tasks"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={draft.trim().length === 0}>
            Add
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft("");
              setDraftMentions(new Set());
              setAdding(false);
            }}
          >
            Cancel
          </Button>
        </form>
      ) : canManage ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          <Plus className="size-3.5" /> Add subtask
        </button>
      ) : null}
      </div>
    </div>
  );
}

function SubtaskAssigneeControl({
  value,
  members,
  onChange,
}: {
  value: UserLite | null;
  members: UserLite[];
  onChange: (user: UserLite | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = members.filter((u) =>
    !q
      ? true
      : u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={value ? `Assigned to ${value.name}` : "Assign subtask"}
          title={value ? `Assigned to ${value.name}` : "Assign subtask"}
          className={cn(
            "shrink-0 rounded-full transition-colors",
            value
              ? "ring-2 ring-transparent hover:ring-primary/30"
              : "flex size-7 items-center justify-center border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary"
          )}
        >
          {value ? (
            <UserInitialsAvatar
              name={value.name}
              role={value.role}
              className="size-7 text-[10px]"
            />
          ) : (
            <UserPlus className="size-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <InputGroup className="h-8 mb-2 shadow-none">
          <InputGroupAddon>
            <Search className="size-3.5 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search member"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3.5" /> Unassign
          </button>
        )}
        <div className="max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              No members found.
            </p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((u) => {
                const selected = value?._id === u._id;
                return (
                  <li key={u._id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(u);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                        selected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <UserInitialsAvatar
                        name={u.name}
                        role={u.role}
                        className="size-6 text-[10px]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{u.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {u.email}
                        </div>
                      </div>
                      {selected && <Check className="size-3.5" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ProjectNameInline({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex h-9 w-full items-center rounded-md border border-transparent bg-transparent px-3 text-left text-sm font-medium hover:border-border hover:bg-accent"
      >
        {value}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim();
        setEditing(false);
        if (next.length >= 2 && next !== value) onSave(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className="h-9 w-full rounded-md border bg-background px-3 text-sm font-medium shadow-none outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
    />
  );
}

function InfoField({
  label,
  children,
}: {
  label: string;
  stack?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function MinimalPerson({ user }: { user: UserLite }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-help items-center gap-2">
            <UserInitialsAvatar name={user.name} role={user.role} className="size-6 text-[10px]" />
            <span className="truncate text-sm">{user.name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <div className="text-xs">
            <div className="font-medium">{user.name}</div>
            <div className="text-muted-foreground">{user.email}</div>
            <div className="mt-0.5 text-muted-foreground">
              {user.role === "admin"
                ? "Admin"
                : user.role === "project_manager"
                ? "Project Manager"
                : "User"}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function colorForRole(role?: UserRole) {
  switch (role) {
    case "admin":
      return "bg-red-600 text-white";
    case "project_manager":
      return "bg-amber-500 text-white";
    case "user":
    default:
      return "bg-green-600 text-white";
  }
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "U";
}

function AssigneeAvatarRow({
  users,
  canEdit,
  existingIds,
  onAdd,
  onRemove,
}: {
  users: UserLite[];
  canEdit: boolean;
  existingIds: string[];
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmUser, setConfirmUser] = useState<UserLite | null>(null);

  useEffect(() => {
    if (!pickerOpen) {
      setQuery("");
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ status: "active", limit: "20" });
        if (query) params.set("q", query);
        const res = await fetch(`/api/users?${params.toString()}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (res.ok) {
          setResults(
            (data.users ?? []).filter(
              (u: UserLite) => !existingIds.includes(u._id)
            )
          );
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [pickerOpen, query, existingIds]);

  return (
    <div className="flex items-center">
      <TooltipProvider delayDuration={150}>
        <div className="flex items-center -space-x-2">
          {users.map((u) => (
            <Tooltip key={u._id}>
              <TooltipTrigger asChild>
                <div className="relative z-0 hover:z-20">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold",
                      colorForRole(u.role)
                    )}
                  >
                    {initialsOf(u.name)}
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`Remove ${u.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmUser(u);
                      }}
                      className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-background bg-destructive text-white opacity-0 transition-opacity hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="text-xs">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-muted-foreground">{u.email}</div>
                  <div className="mt-0.5 text-muted-foreground">
                    {u.role === "admin"
                      ? "Admin"
                      : u.role === "project_manager"
                      ? "Project Manager"
                      : "User"}
                  </div>
                  {canEdit && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Click to remove
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {canEdit && (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Add assignee"
              className={cn(
                "relative z-0 flex size-8 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background text-muted-foreground transition-all hover:z-20 hover:scale-110 hover:border-primary/60 hover:bg-primary/10 hover:text-primary",
                users.length > 0 && "-ml-2"
              )}
            >
              <UserPlus className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0">
            <div className="border-b p-2">
              <InputGroup className="h-8 shadow-none">
                <InputGroupAddon>
                  <Search className="text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="Search people"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </InputGroup>
            </div>
            <div className="max-h-60 overflow-auto py-1">
              {loading ? (
                <div className="p-2 text-xs text-muted-foreground">
                  Searching…
                </div>
              ) : results.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">
                  No users available.
                </div>
              ) : (
                results.map((u) => (
                  <button
                    type="button"
                    key={u._id}
                    onClick={() => {
                      onAdd(u._id);
                      setPickerOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ring-inset",
                        colorForRole(u.role)
                      )}
                    >
                      {initialsOf(u.name)}
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="truncate font-medium">{u.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <AlertDialog
        open={Boolean(confirmUser)}
        onOpenChange={(open) => !open && setConfirmUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove assignee?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUser
                ? `${confirmUser.name} (${confirmUser.email}) will no longer see this project in their list.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmUser) onRemove(confirmUser._id);
                setConfirmUser(null);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PersonLine({ user }: { user: UserLite }) {
  return (
    <div className="flex items-center gap-3">
      <UserInitialsAvatar name={user.name} role={user.role} className="size-9" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{user.name}</div>
        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
      </div>
      <RoleBadge role={user.role} />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-3.5rem)] flex-col sm:-mx-6 sm:-my-8 lg:h-[calc(100vh-3.5rem)] lg:min-h-0 lg:overflow-hidden">
      <div className="flex flex-1 min-w-0 flex-col lg:min-h-0">
        <div className="flex items-center gap-1 border-b-2 border-border/60 px-2 py-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-md" />
          ))}
          <Skeleton className="ml-auto size-8 rounded-md" />
        </div>

        <div className="flex flex-1 flex-col lg:h-full lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 lg:border-r lg:border-border/40">
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5 sm:px-6">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-2 px-4 py-3 sm:px-6">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>

            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5 sm:px-6">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-6 rounded-full" />
            </div>
            <div className="border-b border-border/40 px-4 py-2 sm:px-6">
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <ul className="divide-y divide-border/40">
              {Array.from({ length: 2 }).map((_, i) => (
                <li key={i} className="flex items-start gap-2 px-4 py-2 sm:px-6">
                  <Skeleton className="size-6 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <aside className="border-t border-border/40 lg:border-t-0">
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5 sm:px-6">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-3 px-4 py-3 text-sm sm:px-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function DetailError({ message }: { message: string }) {
  const isForbidden = /forbidden|not found|403|404/i.test(message);
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/projects"
        className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to projects
      </Link>
      <div className="mx-auto w-full max-w-md rounded-xl border border-destructive/20 bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20">
          <ShieldAlert className="size-6" />
        </div>
        <p className="mt-5 text-base font-semibold text-foreground">
          {isForbidden ? "Can't open this project" : "Couldn't load project"}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {message ||
            "Something went wrong while loading this project. Please try again."}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link href="/dashboard/projects">
              <ArrowLeft className="mr-1.5 size-3.5" /> Back
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              toast.info("Retrying…");
              window.location.reload();
            }}
          >
            <RefreshCw className="mr-1.5 size-3.5" /> Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskTabSkeleton() {
  return (
    <div className="flex flex-col lg:h-full lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 lg:border-r lg:border-border/40">
        <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5 sm:px-6">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2 px-4 py-3 sm:px-6">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>

        <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5 sm:px-6">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-10 rounded-full" />
        </div>
        <div className="space-y-2 px-4 py-2 sm:px-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-3 flex-1 max-w-md" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5 sm:px-6">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-6 rounded-full" />
        </div>
        <div className="border-b border-border/40 px-4 py-2 sm:px-6">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <ul className="divide-y divide-border/40">
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i} className="flex items-start gap-2 px-4 py-2 sm:px-6">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="border-t border-border/40 lg:border-t-0">
        <div className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="size-7 rounded-md" />
          </div>
        </div>
        <div className="flex flex-col gap-1 border-b border-border/40 px-4 py-3 sm:px-6">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="space-y-3 px-4 py-3 text-sm sm:px-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function KanbanCard({
  task,
  dragging,
  projectMembers,
  canEdit,
  canDelete,
  onOpen,
  onEdit,
  onDelete,
  onAssigneesChange,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  dragging: boolean;
  projectMembers: UserLite[];
  canEdit?: boolean;
  canDelete?: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onAssigneesChange: (next: UserLite[]) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task._id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group cursor-grab select-none rounded-lg border p-2.5 shadow-sm transition-all hover:shadow-md",
        TASK_STATUS_STYLES[task.status].card,
        dragging && "opacity-40 cursor-grabbing"
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {task.taskId ? (
            <span className="font-mono text-xs text-muted-foreground">
              {task.taskId}
            </span>
          ) : null}
          <PriorityBadge priority={task.priority} />
        </div>
        <div className="flex items-center gap-0.5">
          {canEdit && onEdit ? (
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
          {canDelete && onDelete ? (
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
      <div className="text-sm font-semibold leading-snug line-clamp-2">
        {task.title}
      </div>
      {task.description && task.description.trim() !== "" && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {task.description.replace(/<[^>]+>/g, "").slice(0, 140)}
        </p>
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
              <DueDateCell due={task.dueDate} status={task.status} />
            </span>
          ) : null}
        </div>
      )}
      <div
        className="mt-2 flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        draggable={false}
        onDragStart={(e) => e.stopPropagation()}
      >
        <TaskAssigneeRow
          selected={task.assignees}
          options={projectMembers}
          onChange={onAssigneesChange}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

function TaskAssigneeRow({
  selected,
  options,
  onChange,
  canEdit = true,
}: {
  selected: UserLite[];
  options: UserLite[];
  onChange: (next: UserLite[]) => void;
  canEdit?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [confirmUser, setConfirmUser] = useState<UserLite | null>(null);

  useEffect(() => {
    if (!pickerOpen) setQuery("");
  }, [pickerOpen]);

  const selectedIds = selected.map((s) => s._id);
  const q = query.trim().toLowerCase();
  const available = options
    .filter((u) => !selectedIds.includes(u._id))
    .filter((u) =>
      !q
        ? true
        : u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
    );

  function addUser(u: UserLite) {
    onChange([...selected, u]);
    setPickerOpen(false);
  }

  function confirmRemove() {
    if (!confirmUser) return;
    onChange(selected.filter((s) => s._id !== confirmUser._id));
    setConfirmUser(null);
  }

  return (
    <div className="flex items-center">
      <TooltipProvider delayDuration={150}>
        <div className="flex items-center -space-x-2">
          {selected.map((u) => (
            <Tooltip key={u._id}>
              <TooltipTrigger asChild>
                <div className="relative z-0 hover:z-20">
                  <div
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border-2 border-background text-[9px] font-semibold",
                      colorForRole(u.role)
                    )}
                  >
                    {initialsOf(u.name)}
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`Remove ${u.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmUser(u);
                      }}
                      className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-background bg-destructive text-white opacity-0 transition-opacity hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="text-xs">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-muted-foreground">{u.email}</div>
                  {canEdit && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      Click to remove
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {canEdit && (
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Add assignee"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative z-0 flex size-7 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background text-muted-foreground transition-all hover:z-20 hover:scale-110 hover:border-primary/60 hover:bg-primary/10 hover:text-primary",
              selected.length > 0 && "-ml-2"
            )}
          >
            <UserPlus className="size-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-64 p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b p-2">
            <InputGroup className="h-8 shadow-none">
              <InputGroupAddon>
                <Search className="text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search project members"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </InputGroup>
          </div>
          <div className="max-h-56 overflow-auto py-1">
            {options.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">
                No project members yet.
              </div>
            ) : available.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">
                {selected.length === options.length
                  ? "All project members assigned."
                  : "No matches."}
              </div>
            ) : (
              available.map((u) => (
                <button
                  type="button"
                  key={u._id}
                  onClick={() => addUser(u)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold",
                      colorForRole(u.role)
                    )}
                  >
                    {initialsOf(u.name)}
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {u.email}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      )}

      <AlertDialog
        open={Boolean(confirmUser)}
        onOpenChange={(open) => !open && setConfirmUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove assignee?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUser
                ? `${confirmUser.name} will be removed from this task's assignees.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProjectUserPicker({
  options,
  selected,
  onChange,
  placeholder = "Select people",
  excludeIds,
  excludeLabel = "Already selected",
}: {
  options: UserLite[];
  selected: UserLite[];
  onChange: (list: UserLite[]) => void;
  placeholder?: string;
  excludeIds?: string[];
  excludeLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const excludeSet = new Set(excludeIds ?? []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  })();

  function toggle(u: UserLite) {
    if (excludeSet.has(u._id)) return;
    if (selected.some((s) => s._id === u._id)) {
      onChange(selected.filter((s) => s._id !== u._id));
    } else {
      onChange([...selected, u]);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-left text-sm shadow-none",
            "focus:border-primary/60 focus:ring-2 focus:ring-primary/30 focus:outline-none"
          )}
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground px-1">{placeholder}</span>
          ) : (
            selected.map((u) => (
              <span
                key={u._id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full pl-0.5 pr-1.5 py-0.5 text-xs font-medium text-white",
                  colorForRole(u.role)
                )}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-white/25 text-[9px]">
                  {initialsOf(u.name)}
                </span>
                {u.name}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${u.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(u);
                  }}
                  className="ml-0.5 cursor-pointer rounded-full hover:bg-white/20"
                >
                  <X className="size-3" />
                </span>
              </span>
            ))
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
      >
        <div className="border-b p-2">
          <InputGroup className="h-8 shadow-none">
            <InputGroupAddon>
              <Search className="text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search project members"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </InputGroup>
        </div>
        <div className="max-h-60 overflow-auto py-1">
          {options.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              No project members yet. Add assignees to the project first.
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">No matches.</div>
          ) : (
            filtered.map((u) => {
              const sel = selected.some((s) => s._id === u._id);
              const excluded = excludeSet.has(u._id);
              return (
                <button
                  type="button"
                  key={u._id}
                  onClick={() => toggle(u)}
                  disabled={excluded}
                  title={excluded ? excludeLabel : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent",
                    sel && "bg-primary/5",
                    excluded && "cursor-not-allowed opacity-60 hover:bg-transparent"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold border-2 border-background",
                      colorForRole(u.role)
                    )}
                  >
                    {initialsOf(u.name)}
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {u.email}
                    </div>
                  </div>
                  {excluded ? (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {excludeLabel}
                    </span>
                  ) : sel ? (
                    <X className="size-4 text-muted-foreground" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AssigneeBadges({
  users,
  max = 3,
  size = "md",
}: {
  users: UserLite[];
  max?: number;
  size?: "sm" | "md";
}) {
  if (!users || users.length === 0) {
    return (
      <span className="text-[10px] text-muted-foreground">Unassigned</span>
    );
  }
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  const sizeCls =
    size === "sm"
      ? "size-6 text-[9px]"
      : "size-7 text-[10px]";
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center -space-x-2">
        {shown.map((u) => (
          <Tooltip key={u._id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "relative z-0 flex items-center justify-center rounded-full border-2 border-background font-semibold transition-transform hover:z-20 hover:scale-110",
                  sizeCls,
                  colorForRole(u.role)
                )}
              >
                {initialsOf(u.name)}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="text-xs">
                <div className="font-medium">{u.name}</div>
                <div className="text-muted-foreground">{u.email}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
        {extra > 0 && (
          <span
            className={cn(
              "relative z-0 flex items-center justify-center rounded-full border-2 border-background bg-muted font-semibold text-muted-foreground",
              sizeCls
            )}
          >
            +{extra}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}

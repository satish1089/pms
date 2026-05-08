"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  FolderKanban,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { usePageTitle } from "@/hooks/use-page-title";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RoleBadge,
  TASK_STATUS_STYLES,
  TaskStatusBadge,
  type TaskStatusKey,
  UserInitialsAvatar,
} from "@/components/role-status-badge";
import { cn } from "@/lib/utils";
import { FormAlert } from "@/components/form-error";
import { RichTextEditor, RichTextViewer } from "@/components/rich-text-editor";
import {
  PriorityBadge,
  PrioritySelect,
} from "@/components/priority-badge";
import { DatePicker } from "@/components/ui/date-picker";
import { TaskTimerButton } from "@/components/task-timer-button";
import { type FieldErrors, parseApiError } from "@/lib/form-errors";
import { type UserRole } from "@/lib/roles";

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
  description: string;
  status: TaskStatusKey;
  priority: TaskPriorityKey;
  assignedDate: string | null;
  dueDate: string | null;
  createdBy: UserLite | null;
  assignees: UserLite[];
  reportingPersons: UserLite[];
  project: ProjectLite | null;
  createdAt?: string;
  updatedAt?: string;
};

const BOARD_COLUMNS: TaskStatusKey[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "qa",
  "done",
];

type Comment = {
  _id: string;
  author: UserLite | null;
  body: string;
  createdAt?: string;
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

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [session, setSession] = useState<Session | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageTitle(
    loading
      ? "Loading task…"
      : error
      ? "Task not found"
      : task
      ? `${task.taskId ? `${task.taskId} · ` : ""}${task.title}`
      : "Task"
  );

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentAlert, setCommentAlert] = useState<string | null>(null);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);

  const [projectTasks, setProjectTasks] = useState<
    { _id: string; taskId: string | null; title: string }[]
  >([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (res.ok) setSession(data.user);
      } catch {}
    })();
  }, []);

  const loadTask = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load task");
      setTask(data.task);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadComments = useCallback(async () => {
    if (!id) return;
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/tasks/${id}/comments`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load discussion");
      setComments(data.comments ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load discussion");
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  useEffect(() => {
    if (task) loadComments();
  }, [task, loadComments]);

  useEffect(() => {
    if (!task?.project?._id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/projects/${task.project!._id}/tasks`
        );
        const data = await res.json();
        if (!cancelled && res.ok) {
          setProjectTasks(
            (data.tasks ?? []).map(
              (t: { _id: string; taskId?: string | null; title: string }) => ({
                _id: t._id,
                taskId: t.taskId ?? null,
                title: t.title,
              })
            )
          );
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [task?.project?._id]);

  const hashTasks = useMemo(() => {
    if (!task?.project?._id) return [];
    return projectTasks
      .filter((t) => t.taskId && t._id !== task._id)
      .map((t) => ({
        _id: t._id,
        taskId: t.taskId as string,
        title: t.title,
        projectId: task.project!._id,
      }));
  }, [projectTasks, task]);

  async function handleStatusChange(newStatus: TaskStatusKey) {
    if (!task || task.status === newStatus) return;
    const prev = task;
    setTask({ ...task, status: newStatus });
    try {
      const res = await fetch(`/api/tasks/${task._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setTask(prev);
        const data = await res.json();
        toast.error(data.error || "Failed to change status");
        return;
      }
      toast.success("Status updated");
    } catch (err) {
      setTask(prev);
      toast.error(err instanceof Error ? err.message : "Failed to change status");
    }
  }

  async function patchTask(patch: Record<string, unknown>, label: string) {
    if (!task) return;
    const prev = task;
    try {
      const res = await fetch(`/api/tasks/${task._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setTask(prev);
        toast.error(data.error || `Failed to update ${label}`);
        return;
      }
      if (data.task) setTask(data.task);
      toast.success(`${label} updated`);
    } catch (err) {
      setTask(prev);
      toast.error(
        err instanceof Error ? err.message : `Failed to update ${label}`
      );
    }
  }

  async function handlePriorityChange(p: TaskPriorityKey) {
    if (!task || task.priority === p) return;
    setTask({ ...task, priority: p });
    await patchTask({ priority: p }, "Priority");
  }

  async function handleAssignedDateChange(d: Date | null) {
    if (!task) return;
    setTask({ ...task, assignedDate: d ? d.toISOString() : null });
    await patchTask(
      { assignedDate: d ? d.toISOString() : null },
      "Assigned date"
    );
  }

  async function handleDueDateChange(d: Date | null) {
    if (!task) return;
    setTask({ ...task, dueDate: d ? d.toISOString() : null });
    await patchTask({ dueDate: d ? d.toISOString() : null }, "Due date");
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    setCommentAlert(null);

    const plain = newComment.replace(/<[^>]+>/g, "").trim();
    if (plain.length === 0) {
      setCommentAlert("Comment cannot be empty");
      return;
    }

    setPosting(true);
    try {
      const res = await fetch(`/api/tasks/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newComment }),
      });
      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        const errs = fieldErrors as FieldErrors;
        setCommentAlert(errs.body || message);
        return;
      }
      setNewComment("");
      await loadComments();
    } catch (err) {
      setCommentAlert(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  async function handleDeleteComment() {
    if (!deleteCommentId) return;
    try {
      const res = await fetch(`/api/comments/${deleteCommentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast.success("Comment deleted");
      setDeleteCommentId(null);
      await loadComments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const isManager =
    session?.role === "admin" || session?.role === "project_manager";
  const isTaskCreator =
    !!session?._id && task?.createdBy?._id === session._id;
  const canManage = isManager || isTaskCreator;

  const mentionUsers = useMemo(() => {
    if (!task) return [];
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
    for (const a of task.assignees) push(a);
    for (const a of task.reportingPersons) push(a);
    push(task.createdBy);
    return list;
  }, [task]);

  if (loading) return <DetailSkeleton />;
  if (error || !task) return <DetailError message={error ?? "Task not found"} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={
            task.project
              ? `/dashboard/projects/${task.project._id}`
              : "/dashboard/projects"
          }
          className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {task.project ? `Back to ${task.project.name}` : "Back to projects"}
        </Link>
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="size-6" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={task.status}
                onValueChange={(v) => handleStatusChange(v as TaskStatusKey)}
              >
                <SelectTrigger className="h-auto w-auto gap-2 rounded-full border-0 bg-transparent px-0 py-0 shadow-none hover:opacity-90 focus:ring-0 focus-visible:ring-0 focus-visible:border-0 [&_svg]:hidden">
                  <TaskStatusBadge status={task.status} />
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
              <PrioritySelect
                value={task.priority}
                onChange={handlePriorityChange}
              />
              {task.taskId ? (
                <span className="font-mono text-sm text-muted-foreground">
                  {task.taskId}
                </span>
              ) : null}
              {task.project && (
                <Link
                  href={`/dashboard/projects/${task.project._id}`}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <FolderKanban className="size-3" />
                  <span className="font-mono">{task.project.projectId}</span>
                  <span>· {task.project.name}</span>
                </Link>
              )}
              <TaskTimerButton
                taskId={task._id}
                taskTitle={task.title}
                className="ml-auto"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {task.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Created by {task.createdBy?.name ?? "—"} · {formatDate(task.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Description</h2>
            <div className="mt-3">
              {task.description && task.description.trim() !== "" ? (
                <RichTextViewer html={task.description} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No description.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Discussion</h2>
                <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {commentsLoading ? "…" : comments.length}
                </span>
              </div>
            </div>

            {commentsLoading ? (
              <div className="space-y-4 p-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 p-6 text-center">
                <MessageSquare className="size-5 text-muted-foreground" />
                <p className="text-sm font-medium">No comments yet</p>
                <p className="text-xs text-muted-foreground">
                  Start the discussion below.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {comments.map((c) => {
                  const canDelete =
                    canManage || (session?._id && c.author?._id === session._id);
                  return (
                    <li key={c._id} className="flex items-start gap-3 p-4">
                      <UserInitialsAvatar
                        name={c.author?.name ?? "?"}
                        role={c.author?.role}
                        className="size-8 text-[10px]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {c.author?.name ?? "Unknown"}
                          </span>
                          {c.author?.role && (
                            <RoleBadge role={c.author.role} />
                          )}
                          <span>· {formatDate(c.createdAt)}</span>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteCommentId(c._id)}
                              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                              aria-label="Delete comment"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="mt-2">
                          <RichTextViewer html={c.body} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-t p-4">
              <form onSubmit={handlePostComment} className="space-y-3">
                <FormAlert message={commentAlert} />
                <RichTextEditor
                  value={newComment}
                  onChange={(v) => {
                    setNewComment(v);
                    if (commentAlert) setCommentAlert(null);
                  }}
                  placeholder="Write a comment — @mention people, #link tasks, paste URLs…"
                  minHeight="min-h-24"
                  mentionUsers={mentionUsers}
                  hashTasks={hashTasks}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={posting} size="sm">
                    <Send className="mr-2 size-4" />
                    {posting ? "Posting…" : "Post comment"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <InfoCard label="Priority & dates" icon={ClipboardList}>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Priority</span>
                {canManage ? (
                  <PrioritySelect
                    value={task.priority}
                    onChange={handlePriorityChange}
                  />
                ) : (
                  <PriorityBadge priority={task.priority} />
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Assigned</span>
                {canManage ? (
                  <DatePicker
                    value={
                      task.assignedDate ? new Date(task.assignedDate) : null
                    }
                    onChange={handleAssignedDateChange}
                    className="h-8 w-44 text-xs"
                    placeholder="Pick start"
                  />
                ) : (
                  <span className="text-xs">
                    {task.assignedDate
                      ? new Date(task.assignedDate).toLocaleDateString(
                          undefined,
                          { dateStyle: "medium" }
                        )
                      : "—"}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Due</span>
                {canManage ? (
                  <DatePicker
                    value={task.dueDate ? new Date(task.dueDate) : null}
                    onChange={handleDueDateChange}
                    className="h-8 w-44 text-xs"
                    placeholder="Pick due"
                  />
                ) : (
                  <span className="text-xs">
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString(undefined, {
                          dateStyle: "medium",
                        })
                      : "—"}
                  </span>
                )}
              </div>
            </div>
          </InfoCard>
          <InfoCard label="Assignees" icon={UsersIcon}>
            <PeopleList users={task.assignees} emptyLabel="No assignees" />
          </InfoCard>
          <InfoCard label="Reporting persons" icon={ClipboardList}>
            <PeopleList
              users={task.reportingPersons}
              emptyLabel="No reporting persons"
            />
          </InfoCard>
          <InfoCard label="Timeline" icon={ClipboardList}>
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(task.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Updated</span>
                <span>{formatDate(task.updatedAt)}</span>
              </div>
            </div>
          </InfoCard>
        </div>
      </div>

      <AlertDialog
        open={Boolean(deleteCommentId)}
        onOpenChange={(open) => !open && setDeleteCommentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteComment}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
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

function PeopleList({
  users,
  emptyLabel,
}: {
  users: UserLite[];
  emptyLabel: string;
}) {
  if (!users || users.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {users.map((u) => (
        <li key={u._id} className="flex items-center gap-2">
          <UserInitialsAvatar name={u.name} role={u.role} className="size-7 text-[10px]" />
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
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-3.5 w-40" />
      <div className="flex items-start gap-4">
        <Skeleton className="size-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-3 w-52" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}

function DetailError({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/projects"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to projects
      </Link>
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-5" />
        </div>
        <p className="mt-4 text-sm font-medium">Couldn&apos;t load task</p>
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="mr-2 size-3.5" /> Retry
        </Button>
      </div>
    </div>
  );
}

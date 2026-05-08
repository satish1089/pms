import { cn } from "@/lib/utils";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  const styles: Record<UserRole, string> = {
    admin:
      "bg-red-900/20 text-red-950 ring-red-900/45 dark:bg-red-800/25 dark:text-red-200 dark:ring-red-800/50",
    project_manager:
      "bg-yellow-900/20 text-yellow-950 ring-yellow-900/45 dark:bg-yellow-800/25 dark:text-yellow-200 dark:ring-yellow-800/50",
    user:
      "bg-green-900/20 text-green-950 ring-green-900/45 dark:bg-green-800/25 dark:text-green-200 dark:ring-green-800/50",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[role],
        className
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: "active" | "inactive";
  className?: string;
}) {
  const isActive = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        isActive
          ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/30"
          : "bg-muted text-muted-foreground ring-border",
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isActive ? "bg-emerald-500" : "bg-muted-foreground/60"
        )}
      />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export type TaskStatusKey =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "qa"
  | "done";

export const TASK_STATUS_STYLES: Record<
  TaskStatusKey,
  { label: string; cls: string; dot: string; card: string; accent: string }
> = {
  backlog: {
    label: "Backlog",
    cls: "bg-muted text-muted-foreground ring-border",
    dot: "bg-muted-foreground/60",
    card: "bg-muted/50 dark:bg-muted/40",
    accent: "border-l-muted-foreground/50",
  },
  todo: {
    label: "To do",
    cls:
      "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:bg-sky-500/15 dark:text-sky-400 dark:ring-sky-500/30",
    dot: "bg-sky-500",
    card: "bg-sky-500/10 dark:bg-sky-500/15",
    accent: "border-l-sky-500",
  },
  in_progress: {
    label: "In progress",
    cls:
      "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-500/30",
    dot: "bg-amber-500",
    card: "bg-amber-500/10 dark:bg-amber-500/15",
    accent: "border-l-amber-500",
  },
  in_review: {
    label: "In review",
    cls:
      "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:bg-violet-500/15 dark:text-violet-400 dark:ring-violet-500/30",
    dot: "bg-violet-500",
    card: "bg-violet-500/10 dark:bg-violet-500/15",
    accent: "border-l-violet-500",
  },
  qa: {
    label: "QA",
    cls:
      "bg-cyan-500/10 text-cyan-700 ring-cyan-500/25 dark:bg-cyan-500/15 dark:text-cyan-400 dark:ring-cyan-500/30",
    dot: "bg-cyan-500",
    card: "bg-cyan-500/10 dark:bg-cyan-500/15",
    accent: "border-l-cyan-500",
  },
  done: {
    label: "Done",
    cls:
      "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/30",
    dot: "bg-emerald-500",
    card: "bg-emerald-500/10 dark:bg-emerald-500/15",
    accent: "border-l-emerald-500",
  },
};

export function TaskStatusBadge({
  status,
  className,
}: {
  status: TaskStatusKey;
  className?: string;
}) {
  const c = TASK_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        c.cls,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}

export type TaskTypeKey = "new" | "bug" | "production_bug";

export const TASK_TYPE_STYLES: Record<
  TaskTypeKey,
  { label: string; cls: string; dot: string }
> = {
  new: {
    label: "New",
    cls:
      "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:bg-sky-500/15 dark:text-sky-400 dark:ring-sky-500/30",
    dot: "bg-sky-500",
  },
  bug: {
    label: "Bug",
    cls:
      "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-500/30",
    dot: "bg-amber-500",
  },
  production_bug: {
    label: "Production Bug",
    cls:
      "bg-red-500/10 text-red-700 ring-red-500/25 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/30",
    dot: "bg-red-500",
  },
};

export function TaskTypeBadge({
  type,
  className,
}: {
  type: TaskTypeKey;
  className?: string;
}) {
  const c = TASK_TYPE_STYLES[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        c.cls,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}

const ROLE_AVATAR_STYLES: Record<UserRole, string> = {
  admin: "bg-red-600 text-white",
  project_manager: "bg-amber-500 text-white",
  user: "bg-green-600 text-white",
};

export function UserInitialsAvatar({
  name,
  role,
  className,
}: {
  name: string;
  role?: UserRole;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  const tone = role
    ? ROLE_AVATAR_STYLES[role]
    : "bg-gradient-to-br from-primary/15 to-primary/5 text-primary";
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        tone,
        className
      )}
    >
      {initials || "U"}
    </span>
  );
}

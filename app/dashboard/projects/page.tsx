"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  FolderKanban,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { usePageTitle } from "@/hooks/use-page-title";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatusBadge,
  UserInitialsAvatar,
} from "@/components/role-status-badge";
import { FieldError, FormAlert, RequiredMark } from "@/components/form-error";
import { RichTextEditor } from "@/components/rich-text-editor";
import { cn } from "@/lib/utils";
import { type UserRole } from "@/lib/roles";
import { type FieldErrors, parseApiError } from "@/lib/form-errors";

type UserLite = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

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
};

type Session = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

type StatusFilter = "all" | "active" | "inactive";


const controlClasses =
  "shadow-none border-border bg-background focus-visible:ring-primary/30 focus-visible:border-primary/60";

const emptyForm = {
  name: "",
  description: "",
  status: "active" as "active" | "inactive",
  reportingTo: [] as string[],
  assignees: [] as string[],
};

export default function ProjectsPage() {
  usePageTitle("Projects");
  const [session, setSession] = useState<Session | null>(null);

  const [reportingUsers, setReportingUsers] = useState<UserLite[]>([]);
  const [assigneeUsers, setAssigneeUsers] = useState<UserLite[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 25;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [nextId, setNextId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formAlert, setFormAlert] = useState<string | null>(null);

  const canEdit = session?.role === "admin" || session?.role === "project_manager";

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
        const data = await res.json();
        if (res.ok) setSession(data.user);
      } catch {}
    })();
  }, []);

  const fetchProjectsPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(PAGE_SIZE),
        });
        if (debouncedQuery) params.set("q", debouncedQuery);
        if (statusFilter !== "all") params.set("status", statusFilter);

        const res = await fetch(`/api/projects?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load projects");
        const normalized: Project[] = (data.projects ?? []).map(
          (p: Project & { reportingTo: UserLite[] | UserLite | null }) => ({
            ...p,
            reportingTo: Array.isArray(p.reportingTo)
              ? p.reportingTo
              : p.reportingTo
              ? [p.reportingTo as UserLite]
              : [],
          })
        );
        setProjects((prev) => (append ? [...prev, ...normalized] : normalized));
        setTotal(data.total ?? 0);
        const totalPages = Math.max(
          1,
          Math.ceil((data.total ?? 0) / PAGE_SIZE)
        );
        setHasMore(pageNum < totalPages);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load projects"
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, statusFilter]
  );

  const loadProjects = useCallback(() => {
    pageRef.current = 1;
    return fetchProjectsPage(1, false);
  }, [fetchProjectsPage]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          pageRef.current += 1;
          fetchProjectsPage(pageRef.current, true);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, fetchProjectsPage]);

  const patchProjectLocal = useCallback((updated: Project) => {
    const normalized: Project = {
      ...updated,
      reportingTo: Array.isArray(updated.reportingTo)
        ? updated.reportingTo
        : updated.reportingTo
        ? [updated.reportingTo as UserLite]
        : [],
      assignees: updated.assignees ?? [],
    };
    setProjects((prev) =>
      prev.map((p) => (p._id === normalized._id ? normalized : p))
    );
  }, []);

  const hasFilters = Boolean(debouncedQuery) || statusFilter !== "all";

  async function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setReportingUsers([]);
    setAssigneeUsers([]);
    setFormErrors({});
    setFormAlert(null);
    setDialogOpen(true);
    try {
      const res = await fetch("/api/projects?peekId=1");
      const data = await res.json();
      if (res.ok) setNextId(data.nextId ?? "—");
    } catch {
      setNextId("—");
    }
  }

  function openEdit(p: Project) {
    const rtList = Array.isArray(p.reportingTo)
      ? p.reportingTo
      : p.reportingTo
      ? [p.reportingTo as UserLite]
      : [];
    setEditing(p);
    setNextId(p.projectId);
    setForm({
      name: p.name,
      description: p.description ?? "",
      status: p.status,
      reportingTo: rtList.map((u) => u._id),
      assignees: (p.assignees ?? []).map((a) => a._id),
    });
    setReportingUsers(rtList);
    setAssigneeUsers(p.assignees ?? []);
    setFormErrors({});
    setFormAlert(null);
    setDialogOpen(true);
  }

  function validateProjectForm(): FieldErrors {
    const errs: FieldErrors = {};
    if (form.name.trim().length < 2)
      errs.name = "Project name must be at least 2 characters";
    if (form.reportingTo.length === 0)
      errs.reportingTo = "Select at least one reporting person";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormAlert(null);

    const localErrs = validateProjectForm();
    if (Object.keys(localErrs).length > 0) {
      setFormErrors(localErrs);
      return;
    }
    setFormErrors({});

    setSubmitting(true);
    try {
      const isEdit = Boolean(editing);
      const url = isEdit ? `/api/projects/${editing!._id}` : "/api/projects";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        if (Object.keys(fieldErrors).length > 0) {
          setFormErrors(fieldErrors);
        } else {
          setFormAlert(message);
        }
        return;
      }
      toast.success(isEdit ? "Project updated" : "Project created");
      setDialogOpen(false);
      await loadProjects();
    } catch (err) {
      setFormAlert(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/projects/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("Project deleted");
      setDeleteTarget(null);
      await loadProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Projects
        </h1>
        {canEdit && (
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 size-4" /> Add project
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">All projects</h2>
          <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {loading ? "…" : `${total} total`}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <InputGroup className={`h-9 sm:w-72 ${controlClasses}`}>
            <InputGroupAddon>
              <Search className="text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search name or project id"
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
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className={`w-full sm:w-36 ${controlClasses}`}>
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 size-4" /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-border/40 md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/40 hover:bg-muted/40">
              <TableHead className="h-10 w-24 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">ID</TableHead>
              <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Name</TableHead>
              <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reporting to</TableHead>
              <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assignees</TableHead>
              <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created by</TableHead>
              {canEdit && (
                <TableHead className="h-10 w-[100px] px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border/40 hover:bg-transparent">
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-4 w-14" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-7 w-24 rounded-full" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  {canEdit && <TableCell className="px-3 py-2.5" />}
                </TableRow>
              ))
            ) : projects.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={canEdit ? 7 : 6} className="h-40">
                  <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
                </TableCell>
              </TableRow>
            ) : (
              projects.map((p) => (
                <TableRow key={p._id} className="border-border/40 hover:bg-transparent">
                  <TableCell className="px-3 py-2.5 font-mono text-xs">
                    {p.projectId}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-sm font-medium">
                    <Link
                      href={`/dashboard/projects/${p._id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <ReportingStack
                      project={p}
                      canEdit={canEdit}
                      onUpdated={patchProjectLocal}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <AssigneeStack
                      project={p}
                      canEdit={canEdit}
                      onUpdated={patchProjectLocal}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                    {p.createdBy?.name ?? "—"}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="px-3 py-2.5 text-right">
                      <RowActions
                        onEdit={() => openEdit(p)}
                        onDelete={() => setDeleteTarget(p)}
                      />
                    </TableCell>
                  )}
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
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border p-4">
            <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {projects.map((p) => (
              <li key={p._id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-muted-foreground">
                      {p.projectId}
                    </div>
                    <Link
                      href={`/dashboard/projects/${p._id}`}
                      className="font-medium truncate hover:text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                  </div>
                  {canEdit && (
                    <RowActions
                      onEdit={() => openEdit(p)}
                      onDelete={() => setDeleteTarget(p)}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={p.status} />
                  {p.reportingTo && p.reportingTo.length > 0 && (
                    <span>
                      Reports: {p.reportingTo.map((u) => u.name).join(", ")}
                    </span>
                  )}
                  <span>Created by: {p.createdBy?.name ?? "—"}</span>
                </div>
                <AssigneeStack
                  project={p}
                  canEdit={canEdit}
                  onUpdated={patchProjectLocal}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {projects.length > 0 && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-4 text-xs text-muted-foreground"
        >
          {loadingMore
            ? "Loading more…"
            : hasMore
            ? "Scroll for more"
            : `All ${total} projects loaded`}
        </div>
      )}

      {canEdit && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent
            className="sm:max-w-lg"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Edit project" : "Add project"}
                </DialogTitle>
                <DialogDescription>
                  {editing
                    ? "Update project details, reporting person, and assignees."
                    : "Create a new project. Project ID is auto-generated."}
                </DialogDescription>
              </DialogHeader>

              <FormAlert message={formAlert} />

              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[1fr_2fr]">
                <div className="grid gap-1.5">
                  <Label htmlFor="projectId">Project ID</Label>
                  <Input
                    id="projectId"
                    value={nextId}
                    disabled
                    readOnly
                    className={`${controlClasses} font-mono`}
                  />
                  <FieldError reserve message="" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="name">
                    Project name
                    <RequiredMark />
                  </Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      if (formErrors.name)
                        setFormErrors((p) => ({ ...p, name: "" }));
                    }}
                    placeholder="Apollo launch"
                    aria-invalid={formErrors.name ? true : undefined}
                    className={controlClasses}
                    autoFocus={!editing}
                  />
                  <FieldError reserve message={formErrors.name} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>Description</Label>
                <RichTextEditor
                  value={form.description}
                  onChange={(v) => setForm({ ...form, description: v })}
                  placeholder="Short overview — goals, scope, links…"
                  minHeight="min-h-24"
                />
                <FieldError reserve message="" />
              </div>

              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        status: v as "active" | "inactive",
                      })
                    }
                  >
                    <SelectTrigger className={`w-full ${controlClasses}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError reserve message="" />
                </div>
                <div className="grid gap-1.5">
                  <Label>
                    Reporting to
                    <RequiredMark />
                  </Label>
                  <AssigneesPicker
                    selected={reportingUsers}
                    onChange={(list) => {
                      setReportingUsers(list);
                      setForm((f) => ({
                        ...f,
                        reportingTo: list.map((u) => u._id),
                      }));
                      if (formErrors.reportingTo)
                        setFormErrors((p) => ({ ...p, reportingTo: "" }));
                    }}
                  />
                  <FieldError reserve message={formErrors.reportingTo} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>Assignees</Label>
                <AssigneesPicker
                  selected={assigneeUsers}
                  onChange={(list) => {
                    setAssigneeUsers(list);
                    setForm((f) => ({
                      ...f,
                      assignees: list.map((u) => u._id),
                    }));
                    if (formErrors.assignees)
                      setFormErrors((p) => ({ ...p, assignees: "" }));
                  }}
                  excludeIds={reportingUsers.map((u) => u._id)}
                />
                {formErrors.assignees ? (
                  <FieldError message={formErrors.assignees} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Assigned users will see this project in their list.
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? "Saving…"
                    : editing
                    ? "Save changes"
                    : "Create project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" (${deleteTarget.projectId}) will be permanently removed.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

function PersonChip({ user }: { user: UserLite | null }) {
  if (!user) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2">
      <UserInitialsAvatar name={user.name} role={user.role} className="size-6 text-[10px]" />
      <span className="text-sm">{user.name}</span>
    </div>
  );
}

function AssigneeStack({
  project,
  canEdit,
  onUpdated,
}: {
  project: Project;
  canEdit: boolean;
  onUpdated: (next: Project) => void;
}) {
  const list = project.assignees ?? [];
  const shown = list.slice(0, 4);
  const extra = list.length - shown.length;
  const excludeIds = [
    ...list.map((u) => u._id),
    ...(project.reportingTo ?? []).map((u) => u._id),
  ];

  async function addMember(u: UserLite) {
    const next = [...list.map((x) => x._id), u._id];
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignees: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add");
      onUpdated(data.project);
      toast.success(`${u.name} added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center -space-x-2">
        {shown.map((a) => (
          <Tooltip key={a._id}>
            <TooltipTrigger asChild>
              <div className="relative z-0 rounded-full ring-2 ring-background transition-transform hover:z-10 hover:scale-110">
                <UserInitialsAvatar
                  name={a.name}
                  role={a.role}
                  className="size-7 text-[10px]"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>{a.name}</TooltipContent>
          </Tooltip>
        ))}
        {extra > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/dashboard/projects/${project._id}`}
                aria-label={`${extra} more assignees`}
                className="relative z-0 flex size-7 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background text-muted-foreground transition-all hover:z-10 hover:scale-110 hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
              >
                <span className="text-[10px] font-semibold">+{extra}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="text-xs">
                {list.slice(shown.length).slice(0, 8).map((u) => (
                  <div key={u._id} className="text-muted-foreground">
                    {u.name}
                  </div>
                ))}
                {list.slice(shown.length).length > 8 && (
                  <div className="text-muted-foreground">…and more</div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
        {canEdit && (
          <InlineAddPopover
            excludeIds={excludeIds}
            onPick={addMember}
            ariaLabel="Add assignee"
          />
        )}
      </div>
    </TooltipProvider>
  );
}

function ReportingStack({
  project,
  canEdit,
  onUpdated,
}: {
  project: Project;
  canEdit: boolean;
  onUpdated: (next: Project) => void;
}) {
  const list = Array.isArray(project.reportingTo) ? project.reportingTo : [];
  const shown = list.slice(0, 4);
  const extra = list.length - shown.length;
  const excludeIds = [
    ...list.map((u) => u._id),
    ...(project.assignees ?? []).map((u) => u._id),
  ];

  async function addMember(u: UserLite) {
    const next = [...list.map((x) => x._id), u._id];
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportingTo: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add");
      onUpdated(data.project);
      toast.success(`${u.name} added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center -space-x-2">
        {list.length === 0 && (
          <span className="mr-2 text-sm text-muted-foreground">—</span>
        )}
        {shown.map((u) => (
          <Tooltip key={u._id}>
            <TooltipTrigger asChild>
              <div className="relative z-0 rounded-full ring-2 ring-background transition-transform hover:z-10 hover:scale-110">
                <UserInitialsAvatar
                  name={u.name}
                  role={u.role}
                  className="size-7 text-[10px]"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>{u.name}</TooltipContent>
          </Tooltip>
        ))}
        {extra > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/dashboard/projects/${project._id}`}
                aria-label={`${extra} more reporting persons`}
                className="relative z-0 flex size-7 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background text-muted-foreground transition-all hover:z-10 hover:scale-110 hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
              >
                <span className="text-[10px] font-semibold">+{extra}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="text-xs">
                {list.slice(shown.length).slice(0, 8).map((u) => (
                  <div key={u._id} className="text-muted-foreground">
                    {u.name}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
        {canEdit && (
          <InlineAddPopover
            excludeIds={excludeIds}
            onPick={addMember}
            ariaLabel="Add reporting person"
          />
        )}
      </div>
    </TooltipProvider>
  );
}

function InlineAddPopover({
  excludeIds,
  onPick,
  ariaLabel,
}: {
  excludeIds: string[];
  onPick: (u: UserLite) => void | Promise<void>;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const { query, setQuery, results, loading, error } = useUserSearch(open);
  const excludeSet = new Set(excludeIds);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="relative z-0 flex size-7 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background text-muted-foreground transition-all hover:z-10 hover:scale-110 hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
        >
          <UserPlus className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="border-b p-2">
          <InputGroup className={`h-8 ${controlClasses}`}>
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
        <UserSearchList
          loading={loading}
          error={error}
          results={results}
          isSelected={(id) => excludeSet.has(id)}
          onPick={async (u) => {
            if (excludeSet.has(u._id)) return;
            await onPick(u);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function useUserSearch(open: boolean) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: "active",
        limit: "20",
      });
      if (q) params.set("q", q);
      const res = await fetch(`/api/users?${params.toString()}`, {
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.users ?? []);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      run(query.trim());
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, run]);

  useEffect(() => {
    if (open && results.length === 0 && !loading && !query) {
      run("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  return { query, setQuery, results, loading, error };
}

function UserSearchList({
  loading,
  error,
  results,
  isSelected,
  onPick,
}: {
  loading: boolean;
  error: string | null;
  results: UserLite[];
  isSelected: (id: string) => boolean;
  onPick: (u: UserLite) => void;
}) {
  return (
    <div className="max-h-60 overflow-auto py-1">
      {loading ? (
        <div className="space-y-1 px-2 py-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-36" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="px-3 py-3 text-xs text-destructive">{error}</div>
      ) : results.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted-foreground">
          No users found.
        </div>
      ) : (
        results.map((u) => {
          const sel = isSelected(u._id);
          return (
            <button
              type="button"
              key={u._id}
              onClick={() => onPick(u)}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent",
                sel && "bg-primary/5"
              )}
            >
              <UserInitialsAvatar
                name={u.name}
                role={u.role}
                className="size-6 text-[10px]"
              />
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate font-medium">{u.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {u.email}
                </div>
              </div>
              <Check
                className={cn(
                  "size-4 text-primary",
                  sel ? "opacity-100" : "opacity-0"
                )}
              />
            </button>
          );
        })
      )}
    </div>
  );
}

function ReportingPicker({
  selected,
  onChange,
}: {
  selected: UserLite | null;
  onChange: (u: UserLite | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { query, setQuery, results, loading, error } = useUserSearch(open);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-3 text-left text-sm",
            "focus:border-primary/60 focus:ring-2 focus:ring-primary/30 focus:outline-none",
            controlClasses
          )}
        >
          {selected ? (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <UserInitialsAvatar
                name={selected.name}
                role={selected.role}
                className="size-5 shrink-0 text-[9px]"
              />
              <span className="min-w-0 flex-shrink truncate">
                {selected.name}
              </span>
              <span className="min-w-0 flex-shrink truncate text-xs text-muted-foreground">
                {selected.email}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select person</span>
          )}
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
      >
        <div className="border-b p-2">
          <InputGroup className={`h-8 ${controlClasses}`}>
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
        <UserSearchList
          loading={loading}
          error={error}
          results={results}
          isSelected={(id) => selected?._id === id}
          onPick={(u) => {
            onChange(u);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function AssigneesPicker({
  selected,
  onChange,
  excludeIds,
}: {
  selected: UserLite[];
  onChange: (list: UserLite[]) => void;
  excludeIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const { query, setQuery, results, loading, error } = useUserSearch(open);
  const excludeSet = new Set(excludeIds ?? []);
  const visibleResults = excludeSet.size
    ? results.filter((u) => !excludeSet.has(u._id))
    : results;

  function toggle(u: UserLite) {
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
            "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1.5 text-left text-sm",
            "focus:border-primary/60 focus:ring-2 focus:ring-primary/30 focus:outline-none",
            controlClasses
          )}
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground px-1">Select assignees</span>
          ) : (
            selected.map((u) => (
              <span
                key={u._id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 pl-1 pr-1.5 py-0.5 text-xs font-medium text-primary"
              >
                <UserInitialsAvatar
                  name={u.name}
                  role={u.role}
                  className="size-4 text-[9px]"
                />
                {u.name}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${u.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(u);
                  }}
                  className="ml-0.5 cursor-pointer rounded-full hover:bg-primary/20"
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
          <InputGroup className={`h-8 ${controlClasses}`}>
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
        <UserSearchList
          loading={loading}
          error={error}
          results={visibleResults}
          isSelected={(id) => selected.some((s) => s._id === id)}
          onPick={(u) => toggle(u)}
        />
      </PopoverContent>
    </Popover>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:bg-primary/10 hover:text-primary"
              onClick={onEdit}
              aria-label="Edit project"
            >
              <Pencil className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
              aria-label="Delete project"
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <FolderKanban className="size-6 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium">
        {hasFilters ? "No projects match your filters" : "No projects yet"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {hasFilters
          ? "Try a different search term or clear filters."
          : "Create your first project to get started."}
      </p>
      {hasFilters && (
        <Button variant="outline" size="sm" onClick={onClear} className="mt-4">
          <X className="mr-1 size-4" /> Clear filters
        </Button>
      )}
    </div>
  );
}

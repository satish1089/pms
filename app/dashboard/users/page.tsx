"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users as UsersIcon,
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
  RoleBadge,
  StatusBadge,
  UserInitialsAvatar,
} from "@/components/role-status-badge";
import { FieldError, FormAlert, RequiredMark } from "@/components/form-error";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/roles";
import { type FieldErrors, parseApiError } from "@/lib/form-errors";

type User = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "inactive";
  createdAt?: string;
};

type FormState = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: "active" | "inactive";
};

const emptyForm: FormState = {
  name: "",
  email: "",
  password: "",
  role: "user",
  status: "active",
};

type RoleFilter = "all" | UserRole;
type StatusFilter = "all" | "active" | "inactive";


const controlClasses =
  "shadow-none border-border bg-background focus-visible:ring-primary/30 focus-visible:border-primary/60";

export default function UsersPage() {
  usePageTitle("Users");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 25;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formAlert, setFormAlert] = useState<string | null>(null);

  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwErrors, setPwErrors] = useState<FieldErrors>({});
  const [pwAlert, setPwAlert] = useState<string | null>(null);

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

  const fetchUsersPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(PAGE_SIZE),
        });
        if (debouncedQuery) params.set("q", debouncedQuery);
        if (roleFilter !== "all") params.set("role", roleFilter);
        if (statusFilter !== "all") params.set("status", statusFilter);

        const res = await fetch(`/api/users?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load users");
        const fetched: User[] = data.users ?? [];
        setUsers((prev) => (append ? [...prev, ...fetched] : fetched));
        setTotal(data.total ?? 0);
        const totalPages = Math.max(
          1,
          Math.ceil((data.total ?? 0) / PAGE_SIZE)
        );
        setHasMore(pageNum < totalPages);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, roleFilter, statusFilter]
  );

  const loadUsers = useCallback(() => {
    pageRef.current = 1;
    return fetchUsersPage(1, false);
  }, [fetchUsersPage]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          pageRef.current += 1;
          fetchUsersPage(pageRef.current, true);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, fetchUsersPage]);
  const hasFilters =
    Boolean(debouncedQuery) || roleFilter !== "all" || statusFilter !== "all";

  function resetFormErrors() {
    setFormErrors({});
    setFormAlert(null);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowPassword(false);
    resetFormErrors();
    setDialogOpen(true);
  }

  function openEdit(user: User) {
    setEditingId(user._id);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      status: user.status,
    });
    setShowPassword(false);
    resetFormErrors();
    setDialogOpen(true);
  }

  function validateUserForm(): FieldErrors {
    const errs: FieldErrors = {};
    if (form.name.trim().length < 2) errs.name = "Name must be at least 2 characters";
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(form.email.trim())) errs.email = "Enter a valid email";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetFormErrors();

    const localErrs = validateUserForm();
    if (Object.keys(localErrs).length > 0) {
      setFormErrors(localErrs);
      return;
    }

    setSubmitting(true);
    try {
      const isEdit = Boolean(editingId);
      const url = isEdit ? `/api/users/${editingId}` : "/api/users";
      const method = isEdit ? "PATCH" : "POST";

      const payload: Partial<FormState> = { ...form };
      delete payload.password;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        if (Object.keys(fieldErrors).length > 0) {
          setFormErrors(fieldErrors);
          setFormAlert(null);
        } else {
          setFormAlert(message);
        }
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (isEdit) {
        toast.success("User updated");
      } else if (data?.warning) {
        toast.warning(data.warning);
      } else {
        toast.success(`Invite email sent to ${form.email}`);
      }
      setDialogOpen(false);
      await loadUsers();
    } catch (err) {
      setFormAlert(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("User deleted");
      setDeleteId(null);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function clearFilters() {
    setQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
  }

  function openChangePassword(user: User) {
    setPasswordUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPwErrors({});
    setPwAlert(null);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordUser) return;

    const errs: FieldErrors = {};
    if (newPassword.length < 6) {
      errs.password = "Password must be at least 6 characters";
    }
    if (newPassword !== confirmPassword) {
      errs.confirm = "Passwords do not match";
    }
    setPwErrors(errs);
    setPwAlert(null);
    if (Object.keys(errs).length > 0) return;

    setChangingPassword(true);
    try {
      const res = await fetch(`/api/users/${passwordUser._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        const mapped: FieldErrors = {};
        if (fieldErrors.password) mapped.password = fieldErrors.password;
        if (Object.keys(mapped).length > 0) setPwErrors(mapped);
        else setPwAlert(message);
        return;
      }

      toast.success(`Password updated for ${passwordUser.name}`);
      setPasswordUser(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwAlert(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Team members
        </h1>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="mr-2 size-4" /> Invite user
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">All users</h2>
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
              placeholder="Search name or email"
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
            value={roleFilter}
            onValueChange={(v) => setRoleFilter(v as RoleFilter)}
          >
            <SelectTrigger className={`w-full sm:w-40 ${controlClasses}`}>
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {USER_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
              <TableHead className="h-10 w-[45%] px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">User</TableHead>
              <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Role</TableHead>
              <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="h-10 w-[120px] px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border/40 hover:bg-transparent">
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5" />
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="h-40">
                  <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u._id} className="border-border/40 hover:bg-transparent">
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <UserInitialsAvatar name={u.name} role={u.role} className="size-8 text-[11px]" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <RoleBadge role={u.role} />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <StatusBadge status={u.status} />
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right">
                    <RowActions
                      onEdit={() => openEdit(u)}
                      onChangePassword={() => openChangePassword(u)}
                      onDelete={() => setDeleteId(u._id)}
                    />
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
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-lg border p-4">
            <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {users.map((u) => (
              <li key={u._id} className="flex items-start gap-3 p-4">
                <UserInitialsAvatar name={u.name} role={u.role} className="size-10" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {u.email}
                      </div>
                    </div>
                    <RowActions
                      onEdit={() => openEdit(u)}
                      onChangePassword={() => openChangePassword(u)}
                      onDelete={() => setDeleteId(u._id)}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <RoleBadge role={u.role} />
                    <StatusBadge status={u.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {users.length > 0 && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-4 text-xs text-muted-foreground"
        >
          {loadingMore
            ? "Loading more…"
            : hasMore
            ? "Scroll for more"
            : `All ${total} users loaded`}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit user" : "Invite new user"}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Update name, email, role, and status. Use the key icon on a row to change the password."
                  : "Send an invite email. The user sets their own password via a secure link."}
              </DialogDescription>
            </DialogHeader>

            <FormAlert message={formAlert} />

            <div className="grid gap-1.5">
              <Label htmlFor="name">
                Full name
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
                placeholder="Jane Doe"
                aria-invalid={formErrors.name ? true : undefined}
                aria-describedby={formErrors.name ? "name-err" : undefined}
                className={controlClasses}
              />
              <FieldError reserve id="name-err" message={formErrors.name} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="email">
                Email
                <RequiredMark />
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  if (formErrors.email)
                    setFormErrors((p) => ({ ...p, email: "" }));
                }}
                placeholder="jane@company.com"
                aria-invalid={formErrors.email ? true : undefined}
                aria-describedby={formErrors.email ? "email-err" : undefined}
                className={controlClasses}
              />
              <FieldError reserve id="email-err" message={formErrors.email} />
            </div>

            {!editingId && (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                An invite email with a password setup link will be sent to this
                address. The user activates their account from the link.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as UserRole })}
                >
                  <SelectTrigger className={`w-full ${controlClasses}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as "active" | "inactive" })
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
              </div>
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
                {submitting ? "Saving…" : editingId ? "Save changes" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(passwordUser)}
        onOpenChange={(open) => !open && setPasswordUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Change password</DialogTitle>
              <DialogDescription>
                {passwordUser
                  ? `Set a new password for ${passwordUser.name} (${passwordUser.email}).`
                  : ""}
              </DialogDescription>
            </DialogHeader>

            <FormAlert message={pwAlert} />

            <div className="grid gap-1.5">
              <Label htmlFor="new-password">
                New password
                <RequiredMark />
              </Label>
              <InputGroup
                className={controlClasses}
                aria-invalid={pwErrors.password ? true : undefined}
              >
                <InputGroupInput
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (pwErrors.password)
                      setPwErrors((p) => ({ ...p, password: "" }));
                  }}
                  placeholder="Minimum 6 characters"
                  autoFocus
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-sm"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowNewPassword((v) => !v)}
                  >
                    {showNewPassword ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldError reserve message={pwErrors.password} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="confirm-password">
                Confirm password
                <RequiredMark />
              </Label>
              <InputGroup
                className={controlClasses}
                aria-invalid={pwErrors.confirm ? true : undefined}
              >
                <InputGroupInput
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (pwErrors.confirm)
                      setPwErrors((p) => ({ ...p, confirm: "" }));
                  }}
                  placeholder="Re-enter the new password"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-sm"
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowConfirmPassword((v) => !v)}
                  >
                    {showConfirmPassword ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              {pwErrors.confirm ? (
                <FieldError message={pwErrors.confirm} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  User will need to sign in again with this new password.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordUser(null)}
                disabled={changingPassword}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  changingPassword ||
                  newPassword.length < 6 ||
                  newPassword !== confirmPassword
                }
              >
                {changingPassword ? "Updating…" : "Update password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The user will be permanently
              removed from the workspace.
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

function RowActions({
  onEdit,
  onChangePassword,
  onDelete,
}: {
  onEdit: () => void;
  onChangePassword: () => void;
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
              aria-label="Edit user"
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
              className="size-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
              onClick={onChangePassword}
              aria-label="Change password"
            >
              <KeyRound className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Change password</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
              aria-label="Delete user"
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
        <UsersIcon className="size-6 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium">
        {hasFilters ? "No users match your filters" : "No users yet"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {hasFilters
          ? "Try a different search term or clear filters."
          : 'Click "Add user" to invite your first team member.'}
      </p>
      {hasFilters && (
        <Button variant="outline" size="sm" onClick={onClear} className="mt-4">
          <X className="mr-1 size-4" /> Clear filters
        </Button>
      )}
    </div>
  );
}

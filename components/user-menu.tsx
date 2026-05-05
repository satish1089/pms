"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Monitor,
  Moon,
  Palette,
  Sun,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ROLE_LABELS, type UserRole } from "@/lib/roles";
import { UserInitialsAvatar } from "@/components/role-status-badge";

type SessionUser = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { theme } = useTheme();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Failed to log out");
      toast.success("Logged out");
      router.push("/login");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log out");
    } finally {
      setLoggingOut(false);
      setConfirmOpen(false);
    }
  }

  const themeIcon =
    theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const ThemeIcon = themeIcon;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full size-9 p-0"
            aria-label="Open user menu"
          >
            <UserInitialsAvatar name={user.name} role={user.role} className="size-9" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="w-64 p-1.5"
        >
          <div className="flex items-center gap-2.5 px-2 py-2">
            <UserInitialsAvatar
              name={user.name}
              role={user.role}
              className="size-9 text-xs"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">
                  {user.name}
                </span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {user.email}
              </div>
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="gap-2.5 px-2 py-2 text-sm"
            onClick={() => router.push("/dashboard/settings#general")}
          >
            <UserIcon className="size-4 text-muted-foreground" />
            Profile
          </DropdownMenuItem>

          <DropdownMenuItem
            className="gap-2.5 px-2 py-2 text-sm"
            onClick={() => router.push("/dashboard/settings#general")}
          >
            <ThemeIcon className="size-4 text-muted-foreground" />
            Theme
            <span className="ml-auto text-xs capitalize text-muted-foreground">
              {theme ?? "system"}
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="gap-2.5 px-2 py-2 text-sm"
            onClick={() => router.push("/dashboard/settings#notifications")}
          >
            <Palette className="size-4 text-muted-foreground" />
            Preferences
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            className="gap-2.5 px-2 py-2 text-sm"
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <LogOut className="size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out of Projectly?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll need to sign in again to access your dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? "Logging out…" : "Log out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

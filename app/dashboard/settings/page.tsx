"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Monitor,
  Moon,
  Slack,
  Sun,
  Unplug,
} from "lucide-react";

import { usePageTitle } from "@/hooks/use-page-title";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { ROLE_LABELS, type UserRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

type ThemePref = "light" | "dark" | "system";

type SettingsPayload = {
  theme: ThemePref;
  slack: {
    workspaceConfigured: boolean;
    connected: boolean;
    slackHandle: string;
    notifyOnAssign: boolean;
    notifyOnComment: boolean;
    notifyOnStatusChange: boolean;
    connectedAt: string | null;
  };
};

type SessionUser = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

const THEME_OPTIONS: {
  value: ThemePref;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function SettingsPage() {
  usePageTitle("Settings");

  const { setTheme } = useTheme();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTheme, setSavingTheme] = useState<ThemePref | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [savingPref, setSavingPref] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [meRes, settingsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/users/me/settings", { cache: "no-store" }),
      ]);
      const meBody = await meRes.json();
      const sBody = await settingsRes.json();
      if (meRes.ok) setSession(meBody.user);
      if (settingsRes.ok) {
        const s = sBody.settings as SettingsPayload;
        setSettings(s);
        setTheme(s.theme);
      } else {
        toast.error(sBody?.error ?? "Failed to load settings");
      }
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [setTheme]);

  useEffect(() => {
    load();
  }, [load]);

  async function patchSettings(body: Record<string, unknown>) {
    const res = await fetch("/api/users/me/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Request failed");
    return data.settings as SettingsPayload;
  }

  async function handleThemeChange(value: ThemePref) {
    setSavingTheme(value);
    setTheme(value);
    try {
      const next = await patchSettings({ theme: value });
      setSettings(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save theme");
    } finally {
      setSavingTheme(null);
    }
  }

  async function handleSlackConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/users/me/settings/slack/connect", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to connect Slack");
      toast.success(
        data?.slack?.slackHandle
          ? `Slack connected as ${data.slack.slackHandle}`
          : "Slack connected"
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect Slack");
    } finally {
      setConnecting(false);
    }
  }

  async function handleSlackDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/users/me/settings/slack/disconnect", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.error ?? "Failed to disconnect Slack");
      toast.success("Slack disconnected");
      await load();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to disconnect Slack"
      );
    } finally {
      setDisconnecting(false);
      setConfirmDisconnect(false);
    }
  }

  async function handlePrefToggle(
    key: "notifyOnAssign" | "notifyOnComment" | "notifyOnStatusChange",
    value: boolean
  ) {
    setSavingPref(key);
    setSettings((prev) =>
      prev ? { ...prev, slack: { ...prev.slack, [key]: value } } : prev
    );
    try {
      const next = await patchSettings({ slack: { [key]: value } });
      setSettings(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
      setSettings((prev) =>
        prev ? { ...prev, slack: { ...prev.slack, [key]: !value } } : prev
      );
    } finally {
      setSavingPref(null);
    }
  }

  const role = session?.role;
  const slackConnected = !!settings?.slack.connected;
  const slackConfigured = !!settings?.slack.workspaceConfigured;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Settings
        </h1>
        <p className="text-xs text-muted-foreground">
          Manage your appearance and integrations
          {role ? ` · Signed in as ${ROLE_LABELS[role]}` : ""}
        </p>
      </header>

      <Card
        title="Appearance"
        description="Choose how Projectly looks on this device."
      >
        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = settings?.theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleThemeChange(opt.value)}
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-1.5 rounded-lg border bg-background p-3 text-sm transition-all hover:border-primary/40 hover:bg-muted/50",
                    active && "border-primary/50 bg-primary/5 text-primary"
                  )}
                  disabled={savingTheme !== null}
                >
                  <Icon className="size-5" />
                  <span className="font-medium">{opt.label}</span>
                  {active && (
                    <CheckCircle2 className="absolute right-2 top-2 size-3.5 text-primary" />
                  )}
                  {savingTheme === opt.value && (
                    <Loader2 className="absolute right-2 top-2 size-3.5 animate-spin text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        title="Slack notifications"
        description="Receive direct messages in Slack for activity that involves you."
        right={
          slackConnected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-muted-foreground/50" />
              Not connected
            </span>
          )
        }
      >
        {loading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : !slackConfigured ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="flex-1">
              <div className="font-medium">
                Slack is not set up for this workspace
              </div>
              <p className="mt-0.5 text-amber-700/80 dark:text-amber-400/80">
                An admin must install a Slack app and add{" "}
                <code className="rounded bg-amber-500/10 px-1 py-0.5">
                  SLACK_BOT_TOKEN
                </code>{" "}
                to the server environment.
              </p>
            </div>
          </div>
        ) : slackConnected ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Slack className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  Direct messages active
                  {settings?.slack.slackHandle
                    ? ` · @${settings.slack.slackHandle}`
                    : ""}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  We&apos;ll DM your Slack account
                  {session?.email ? ` (${session.email})` : ""}
                  {settings?.slack.connectedAt
                    ? ` · since ${new Date(settings.slack.connectedAt).toLocaleDateString()}`
                    : ""}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDisconnect(true)}
                disabled={disconnecting}
                className="text-destructive hover:text-destructive"
              >
                {disconnecting ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Unplug className="mr-1.5 size-3.5" />
                )}
                Disconnect
              </Button>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notify me on
              </div>
              <PrefToggle
                label="Task assigned to me"
                checked={settings?.slack.notifyOnAssign ?? true}
                onChange={(v) => handlePrefToggle("notifyOnAssign", v)}
                saving={savingPref === "notifyOnAssign"}
              />
              <PrefToggle
                label="New comments mentioning me"
                checked={settings?.slack.notifyOnComment ?? true}
                onChange={(v) => handlePrefToggle("notifyOnComment", v)}
                saving={savingPref === "notifyOnComment"}
              />
              <PrefToggle
                label="Status changes on my tasks"
                checked={settings?.slack.notifyOnStatusChange ?? true}
                onChange={(v) => handlePrefToggle("notifyOnStatusChange", v)}
                saving={savingPref === "notifyOnStatusChange"}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Slack className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    Connect your Slack account
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Your account email
                    {session?.email ? (
                      <>
                        {" "}
                        (<strong>{session.email}</strong>)
                      </>
                    ) : null}{" "}
                    must match a member of the connected Slack workspace.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button onClick={handleSlackConnect} disabled={connecting}>
                  {connecting ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Slack className="mr-1.5 size-3.5" />
                  )}
                  Connect Slack
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {role === "admin" && (
        <Card
          title="Admin"
          description="Workspace configuration."
        >
          <div className="rounded-lg border bg-muted/30 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                Slack workspace integration
              </span>
              {slackConfigured ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  SLACK_BOT_TOKEN set
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                  Not configured
                </span>
              )}
            </div>
            <p className="mt-2 text-muted-foreground">
              You are signed in as{" "}
              <strong className="text-foreground">Admin</strong>. Workspace-wide
              integrations are configured via server environment variables.
            </p>
          </div>
        </Card>
      )}

      <AlertDialog
        open={confirmDisconnect}
        onOpenChange={(o) => !disconnecting && setConfirmDisconnect(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Slack?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll stop receiving direct messages for assignments,
              mentions, and status changes. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSlackDisconnect();
              }}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Unplug className="mr-1.5 size-3.5" />
              )}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Card({
  title,
  description,
  right,
  children,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border/40 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function PrefToggle({
  label,
  checked,
  onChange,
  saving,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  saving: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-1 py-1.5 hover:bg-muted/40">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-2">
        {saving && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        )}
        <Switch
          checked={checked}
          onCheckedChange={onChange}
          disabled={saving}
        />
      </span>
    </label>
  );
}

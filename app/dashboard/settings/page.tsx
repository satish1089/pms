"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  Monitor,
  Moon,
  Pencil,
  ShieldCheck,
  Slack,
  Sun,
  UserRound,
  X,
} from "lucide-react";

import { usePageTitle } from "@/hooks/use-page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleBadge } from "@/components/role-status-badge";
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

type NavItem = { id: string; label: string; icon: React.ComponentType<{ className?: string }> };

export default function SettingsPage() {
  usePageTitle("Settings");

  const { setTheme } = useTheme();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTheme, setSavingTheme] = useState<ThemePref | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [savingPref, setSavingPref] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<string>("general");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  function startEditName() {
    setNameDraft(session?.name ?? "");
    setEditingName(true);
  }

  async function saveName() {
    const next = nameDraft.trim();
    if (next.length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    if (next === session?.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to update name");
      setSession((prev) => (prev ? { ...prev, name: data.user.name } : prev));
      setEditingName(false);
      toast.success("Name updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update name");
    } finally {
      setSavingName(false);
    }
  }

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

  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { id: "general", label: "General", icon: UserRound },
      { id: "notifications", label: "Notifications", icon: Slack },
    ];
    if (role === "admin")
      items.push({ id: "admin", label: "Admin", icon: ShieldCheck });
    return items;
  }, [role]);

  function scrollToSection(id: string) {
    const el = sectionRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [navItems]);

  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    if (!navItems.some((n) => n.id === hash)) return;
    const el = sectionRefs.current[hash];
    if (!el) return;
    el.scrollIntoView({ behavior: "auto", block: "start" });
    setActiveSection(hash);
  }, [loading, navItems]);

  const initials = (session?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your appearance and integrations
          {role ? ` · Signed in as ${ROLE_LABELS[role]}` : ""}
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        <aside className="lg:sticky lg:top-6 lg:h-fit lg:w-56 lg:shrink-0">
          <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-12">
          <Section
            id="general"
            innerRef={(el) => {
              sectionRefs.current.general = el;
            }}
          >
            <SectionHeader title="Profile" />
            <Row label="Avatar">
              <div className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {loading ? <Skeleton className="size-9 rounded-full" /> : initials}
              </div>
            </Row>
            <Row label="Full name">
              {loading ? (
                <Skeleton className="h-4 w-32" />
              ) : editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    disabled={savingName}
                    className="h-8 w-56"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={saveName}
                    disabled={savingName}
                    aria-label="Save name"
                  >
                    {savingName ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4 text-emerald-600" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => setEditingName(false)}
                    disabled={savingName}
                    aria-label="Cancel"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm">{session?.name ?? "—"}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={startEditName}
                    aria-label="Edit name"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </div>
              )}
            </Row>
            <Row label="Email">
              <span className="text-sm">
                {loading ? (
                  <Skeleton className="h-4 w-48" />
                ) : (
                  session?.email ?? "—"
                )}
              </span>
            </Row>
            <Row label="Role" last>
              {loading ? (
                <Skeleton className="h-5 w-20" />
              ) : role ? (
                <RoleBadge role={role} />
              ) : (
                <span className="text-sm">—</span>
              )}
            </Row>

            <SectionHeader title="Appearance" className="mt-10" />
            <Row label="Theme" last>
              {loading ? (
                <Skeleton className="h-9 w-44" />
              ) : (
                <div className="inline-flex items-center gap-1 rounded-md border bg-background p-1">
                  {THEME_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = settings?.theme === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleThemeChange(opt.value)}
                        title={opt.label}
                        disabled={savingTheme !== null}
                        className={cn(
                          "flex size-8 items-center justify-center rounded transition-colors",
                          active
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        {savingTheme === opt.value ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Icon className="size-4" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </Row>
          </Section>

          <Section
            id="notifications"
            innerRef={(el) => {
              sectionRefs.current.notifications = el;
            }}
          >
            <SectionHeader
              title="Slack notifications"
              description="Receive direct messages in Slack for activity that involves you."
            />
            {loading ? (
              <Skeleton className="h-24 w-full" />
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
            ) : (
              <>
                <Row label="Slack account">
                  {slackConnected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Connected
                      {settings?.slack.slackHandle
                        ? ` · @${settings.slack.slackHandle}`
                        : ""}
                    </span>
                  ) : (
                    <Button onClick={handleSlackConnect} disabled={connecting} size="sm">
                      {connecting ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      ) : (
                        <Slack className="mr-1.5 size-3.5" />
                      )}
                      Connect Slack
                    </Button>
                  )}
                </Row>
                <SectionHeader title="Notify me on" subtle className="mt-10" />
                <Row
                  label="Task assigned to me"
                  description="When someone adds you as an assignee."
                >
                  <PrefSwitch
                    checked={settings?.slack.notifyOnAssign ?? true}
                    onChange={(v) => handlePrefToggle("notifyOnAssign", v)}
                    saving={savingPref === "notifyOnAssign"}
                    disabled={!slackConnected}
                  />
                </Row>
                <Row
                  label="New comments mentioning me"
                  description="When you're @-mentioned in a project or task thread."
                >
                  <PrefSwitch
                    checked={settings?.slack.notifyOnComment ?? true}
                    onChange={(v) => handlePrefToggle("notifyOnComment", v)}
                    saving={savingPref === "notifyOnComment"}
                    disabled={!slackConnected}
                  />
                </Row>
                <Row
                  label="Status changes on my tasks"
                  description="When the status of a task you're assigned to changes."
                  last
                >
                  <PrefSwitch
                    checked={settings?.slack.notifyOnStatusChange ?? true}
                    onChange={(v) =>
                      handlePrefToggle("notifyOnStatusChange", v)
                    }
                    saving={savingPref === "notifyOnStatusChange"}
                    disabled={!slackConnected}
                  />
                </Row>
              </>
            )}
          </Section>

          {role === "admin" && (
            <Section
              id="admin"
              innerRef={(el) => {
                sectionRefs.current.admin = el;
              }}
            >
              <SectionHeader
                title="Admin"
                description="Workspace configuration."
              />
              <Row label="Slack workspace integration" last>
                {slackConfigured ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3" />
                    SLACK_BOT_TOKEN set
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                    Not configured
                  </span>
                )}
              </Row>
            </Section>
          )}
        </div>
      </div>

    </div>
  );
}

function Section({
  id,
  innerRef,
  children,
}: {
  id: string;
  innerRef: (el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <section id={id} ref={innerRef} className="scroll-mt-6">
      {children}
    </section>
  );
}

function SectionHeader({
  title,
  description,
  subtle,
  className,
}: {
  title: string;
  description?: string;
  subtle?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mb-2", className)}>
      <h2
        className={cn(
          "font-semibold tracking-tight",
          subtle ? "text-xs uppercase text-muted-foreground" : "text-base"
        )}
      >
        {title}
      </h2>
      {description && (
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function Row({
  label,
  description,
  last,
  children,
}: {
  label: string;
  description?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-6 py-4",
        !last && "border-b border-border/40"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end">{children}</div>
    </div>
  );
}

function PrefSwitch({
  checked,
  onChange,
  saving,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  saving: boolean;
  disabled?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      {saving && (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      )}
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={saving || disabled}
      />
    </span>
  );
}

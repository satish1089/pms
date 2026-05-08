import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  FolderKanban,
  Github,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  LogIn,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Project management for teams",
};

export default async function Page() {
  const session = await getSession();
  const isStaff =
    session?.role === "admin" || session?.role === "project_manager";

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <BackgroundDecor />

      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
            <Image
              src="/logo.png"
              alt="Projectly"
              width={28}
              height={28}
              priority
              className="size-7 rounded-md"
            />
            <span className="text-sm font-semibold tracking-tight">Projectly</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#workflow" className="hover:text-foreground">Workflow</a>
            <a href="#roles" className="hover:text-foreground">Roles</a>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <Button asChild size="sm">
                <Link href="/dashboard">
                  Dashboard <ArrowRight className="ml-1.5 size-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/login?redirect=%2Fdashboard">
                    Get started <ArrowRight className="ml-1.5 size-3.5" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="size-3.5 text-primary" />
              Built for teams that ship
            </div>
            <h1 className="max-w-4xl text-balance text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
              Project management that{" "}
              <span className="bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
                just works.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
              Plan projects, break them into tasks, and ship together. Role-based
              access for admins, project managers, and users — no setup tax.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              {session ? (
                <>
                  <Button asChild size="lg">
                    <Link href="/dashboard">
                      Open dashboard <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                  {isStaff && (
                    <Button asChild size="lg" variant="outline">
                      <Link href="/dashboard/users">Manage users</Link>
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/login?redirect=%2Fdashboard">
                      Start for free <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/login">
                      <LogIn className="mr-2 size-4" /> Sign in
                    </Link>
                  </Button>
                </>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" /> Free to start
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" /> Role-based access
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" /> Rich-text comments
              </span>
            </div>
          </div>

          <AppPreview />
        </div>
      </section>

      <section id="features" className="relative border-t border-border/50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Features
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need. Nothing you don&apos;t.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={FolderKanban}
              title="Projects"
              description="Group work into projects with owners, members, and progress at a glance."
            />
            <Feature
              icon={ListChecks}
              title="Tasks & subtasks"
              description="Break work down, assign owners, set priorities, and track status."
            />
            <Feature
              icon={KanbanSquare}
              title="Board & list views"
              description="Drag across columns or power through a filtered list — same data, your choice."
            />
            <Feature
              icon={MessageSquare}
              title="Rich-text comments"
              description="Mention teammates with @, link tasks with #, paste media that just embeds."
            />
            <Feature
              icon={ShieldCheck}
              title="Role-based access"
              description="Admins, project managers, and users — clear boundaries, zero friction."
            />
            <Feature
              icon={Zap}
              title="Fast by default"
              description="Built on Next.js App Router. Optimistic UI, instant feedback."
            />
          </div>
        </div>
      </section>

      <section id="workflow" className="relative border-t border-border/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Workflow
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              From idea to shipped — in one place.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Capture the work, decide who owns it, and move it across the board.
              Comments, mentions, and task refs keep the context stitched in.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Create a project, invite the team",
                "Add tasks with priorities, due dates, and assignees",
                "Discuss in threaded comments — @mention people, #link tasks",
                "Drag tasks across the board as they progress",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <MiniBoard />
        </div>
      </section>

      <section id="roles" className="relative border-t border-border/50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Roles
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Access that matches responsibility.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <RoleCard
              title="Admin"
              tagline="Runs the show."
              perks={["Manage users & roles", "All projects access", "Organization settings"]}
            />
            <RoleCard
              title="Project Manager"
              tagline="Owns delivery."
              perks={["Create & edit projects", "Assign tasks", "Manage team members"]}
              highlight
            />
            <RoleCard
              title="User"
              tagline="Does the work."
              perks={["Work on assigned tasks", "Comment & collaborate", "Track own progress"]}
            />
          </div>
        </div>
      </section>

      <section className="relative border-t border-border/50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-accent/10 px-8 py-14 text-center sm:px-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_60%)]" />
            <div className="relative">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to get organized?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                Spin up your first project in under a minute. No credit card, no
                setup friction.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                {session ? (
                  <Button asChild size="lg">
                    <Link href="/dashboard">
                      <LayoutDashboard className="mr-2 size-4" /> Open dashboard
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="lg">
                      <Link href="/login?redirect=%2Fdashboard">
                        Start for free <ArrowRight className="ml-2 size-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline">
                      <Link href="/login">Sign in</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-border/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Projectly"
              width={24}
              height={24}
              className="size-6 rounded-md"
            />
            <span>Projectly © {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#workflow" className="hover:text-foreground">Workflow</a>
            <a href="#roles" className="hover:text-foreground">Roles</a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Github className="size-4" /> GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function BackgroundDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.25)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.25)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur transition hover:border-primary/40 hover:bg-card/70">
      <div className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
        <Icon className="size-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function RoleCard({
  title,
  tagline,
  perks,
  highlight,
}: {
  title: string;
  tagline: string;
  perks: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-6 backdrop-blur ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border/60 bg-card/40"
      }`}
    >
      {highlight && (
        <span className="absolute right-4 top-4 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          Most used
        </span>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{tagline}</p>
      <ul className="mt-5 space-y-2 text-sm">
        {perks.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AppPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      <div className="absolute -inset-x-8 -inset-y-6 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-accent/10 to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-2xl shadow-primary/10 backdrop-blur">
        <div className="flex items-center gap-1.5 border-b border-border/50 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 text-xs text-muted-foreground">
            projectly · Website redesign
          </span>
        </div>
        <div className="grid gap-0 md:grid-cols-[200px_1fr]">
          <aside className="hidden border-r border-border/50 p-4 md:block">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Projects
            </p>
            <ul className="space-y-1 text-sm">
              {[
                { name: "Website redesign", active: true },
                { name: "Mobile app v2" },
                { name: "Q2 marketing" },
                { name: "Internal tools" },
              ].map((p) => (
                <li
                  key={p.name}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                    p.active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <FolderKanban className="size-3.5" />
                  <span className="truncate">{p.name}</span>
                </li>
              ))}
            </ul>
          </aside>
          <div className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Board</h3>
              <div className="flex items-center gap-1.5">
                <span className="rounded-md border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                  Filter
                </span>
                <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                  + New task
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <PreviewColumn
                title="To do"
                dot="bg-slate-400"
                cards={[
                  { title: "Wire up landing hero", priority: "High" },
                  { title: "Audit mobile nav", priority: "Med" },
                ]}
              />
              <PreviewColumn
                title="In progress"
                dot="bg-amber-400"
                cards={[
                  { title: "Feature cards redesign", priority: "High" },
                ]}
              />
              <PreviewColumn
                title="Done"
                dot="bg-emerald-400"
                cards={[{ title: "Install fonts", priority: "Low" }]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewColumn({
  title,
  dot,
  cards,
}: {
  title: string;
  dot: string;
  cards: { title: string; priority: string }[];
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-2.5">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <span className={`size-2 rounded-full ${dot}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {cards.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {cards.map((c, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/60 bg-card/70 p-2 text-[11px]"
          >
            <div className="truncate font-medium">{c.title}</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                {c.priority}
              </span>
              <div className="flex -space-x-1">
                <span className="size-4 rounded-full border border-background bg-primary/40" />
                <span className="size-4 rounded-full border border-background bg-accent/40" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniBoard() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/15 to-accent/10 blur-2xl" />
      <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">4 members</span>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
            On track
          </span>
        </div>
        <div className="space-y-2">
          {[
            { t: "Design auth flow", s: "done", a: "RP" },
            { t: "Build task composer", s: "doing", a: "AK" },
            { t: "Ship mention picker", s: "doing", a: "RP" },
            { t: "Write onboarding copy", s: "todo", a: "MS" },
          ].map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm"
            >
              <span
                className={`size-2 rounded-full ${
                  r.s === "done"
                    ? "bg-emerald-500"
                    : r.s === "doing"
                    ? "bg-amber-400"
                    : "bg-slate-400"
                }`}
              />
              <span className="flex-1 truncate">{r.t}</span>
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                {r.a}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

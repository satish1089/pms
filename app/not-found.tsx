import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Page not found",
};

export default async function NotFound() {
  const session = await getSession();
  const target = session ? "/dashboard" : "/";
  const targetLabel = session ? "Back to dashboard" : "Back to home";

  return (
    <main className="relative flex min-h-screen flex-col bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <header className="border-b border-border/50 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-90"
          >
            <Image
              src="/logo.png"
              alt="Projectly"
              width={28}
              height={28}
              className="size-7 rounded-md"
            />
            <span className="text-sm font-semibold tracking-tight">
              Projectly
            </span>
          </Link>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/60 p-8 text-center shadow-sm backdrop-blur">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
            <Compass className="size-6" />
          </div>
          <p className="mt-5 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Error 404
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Page not found
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The page you're looking for doesn't exist, was moved, or you don't
            have access to it.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button asChild size="sm">
              <Link href={target}>
                <Home className="mr-1.5 size-3.5" /> {targetLabel}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/projects">
                <ArrowLeft className="mr-1.5 size-3.5" /> Browse projects
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

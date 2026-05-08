"use client";

import Link from "next/link";
import { ExternalLink, Square, Timer } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  formatElapsed,
  useActiveTimer,
} from "@/hooks/use-active-timer";
import { TimerNoteDialog } from "@/components/timer-note-dialog";

export function RunningTimerCard() {
  const { timer, elapsedMs, stop } = useActiveTimer();
  const [stopping, setStopping] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!timer) return null;

  async function handleConfirm(note: string) {
    if (stopping) return;
    setStopping(true);
    await stop(note);
    setStopping(false);
    setDialogOpen(false);
  }

  const taskHref =
    timer.project && timer.task
      ? `/dashboard/projects/${timer.project._id}?task=${timer.task._id}`
      : "/dashboard";

  const startedAt = new Date(timer.startedAt);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Timer className="size-5 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              Tracking now
            </div>
            <Link
              href={taskHref}
              className="group flex items-center gap-1.5 truncate text-sm font-semibold hover:text-emerald-700 dark:hover:text-emerald-400"
            >
              <span className="truncate">
                {timer.task?.title ?? "Project (general)"}
              </span>
              <ExternalLink className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {timer.project?.name ?? "—"}
              {" · started "}
              {startedAt.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {timer.note ? ` · "${timer.note}"` : ""}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatElapsed(elapsedMs)}
          </div>
          <Button
            size="sm"
            variant="default"
            onClick={() => setDialogOpen(true)}
            disabled={stopping}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Square className="size-3.5 fill-current" />
            Stop
          </Button>
        </div>
      </div>
      <TimerNoteDialog
        open={dialogOpen}
        mode="stop"
        taskTitle={timer.task?.title ?? undefined}
        elapsedMs={elapsedMs}
        busy={stopping}
        onCancel={() => setDialogOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { Square, Timer } from "lucide-react";
import { useState } from "react";

import {
  formatElapsed,
  useActiveTimer,
} from "@/hooks/use-active-timer";
import { Button } from "@/components/ui/button";
import { TimerNoteDialog } from "@/components/timer-note-dialog";
import { cn } from "@/lib/utils";

export function RunningTimerBar() {
  const { timer, elapsedMs, stop } = useActiveTimer();
  const [stopping, setStopping] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!timer) return null;

  const taskHref =
    timer.project && timer.task
      ? `/dashboard/projects/${timer.project._id}?task=${timer.task._id}`
      : "/dashboard";

  async function handleConfirm(note: string) {
    if (stopping) return;
    setStopping(true);
    await stop(note);
    setStopping(false);
    setDialogOpen(false);
  }

  return (
    <>
      <div className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 sm:flex">
        <Timer className="size-3.5 animate-pulse text-emerald-600 dark:text-emerald-400" />
        <Link
          href={taskHref}
          className="flex min-w-0 items-center gap-2 text-xs"
          title={timer.task?.title ?? "Active timer"}
        >
          <span className="hidden max-w-[180px] truncate font-medium md:inline">
            {timer.task?.title ?? "Project (general)"}
          </span>
          <span
            className={cn(
              "font-mono tabular-nums text-emerald-700 dark:text-emerald-400"
            )}
          >
            {formatElapsed(elapsedMs)}
          </span>
        </Link>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => setDialogOpen(true)}
          disabled={stopping}
        >
          <Square className="size-3 fill-current" />
          <span className="sr-only">Stop</span>
        </Button>
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

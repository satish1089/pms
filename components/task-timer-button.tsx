"use client";

import { Play, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  formatElapsed,
  useActiveTimer,
} from "@/hooks/use-active-timer";
import { TimerNoteDialog } from "@/components/timer-note-dialog";
import { cn } from "@/lib/utils";

type Props = {
  taskId: string;
  taskTitle?: string;
  className?: string;
};

export function TaskTimerButton({ taskId, taskTitle, className }: Props) {
  const { timer, elapsedMs, start, stop, loading } = useActiveTimer();
  const [busy, setBusy] = useState(false);
  const [dialogMode, setDialogMode] = useState<"start" | "stop" | null>(null);

  const isThisTask = timer?.task?._id === taskId;
  const isOtherTask = !!timer && !isThisTask;

  async function handleConfirm(note: string) {
    if (busy || !dialogMode) return;
    setBusy(true);
    if (dialogMode === "start") {
      const res = await start(taskId, note);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to start timer");
      } else {
        toast.success(`Tracking ${taskTitle ?? "task"}`);
      }
    } else {
      await stop(note);
    }
    setBusy(false);
    setDialogMode(null);
  }

  if (loading) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        className={cn("h-8", className)}
      >
        <Play className="size-3.5" /> Start
      </Button>
    );
  }

  if (isThisTask) {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialogMode("stop")}
          disabled={busy}
          className={cn(
            "h-8 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400",
            className
          )}
        >
          <Square className="size-3.5 fill-current" />
          <span className="font-mono tabular-nums">
            {formatElapsed(elapsedMs)}
          </span>
          <span className="hidden sm:inline">Stop</span>
        </Button>
        <TimerNoteDialog
          open={dialogMode === "stop"}
          mode="stop"
          taskTitle={taskTitle}
          elapsedMs={elapsedMs}
          busy={busy}
          onCancel={() => setDialogMode(null)}
          onConfirm={handleConfirm}
        />
      </>
    );
  }

  if (isOtherTask) {
    const otherName = timer?.task?.title ?? "another task";
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        className={cn("h-8", className)}
        title={`Already tracking ${otherName}. Stop it first.`}
      >
        <Play className="size-3.5" /> Start
      </Button>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="default"
        onClick={() => setDialogMode("start")}
        disabled={busy}
        className={cn("h-8", className)}
      >
        <Play className="size-3.5" /> Start
      </Button>
      <TimerNoteDialog
        open={dialogMode === "start"}
        mode="start"
        taskTitle={taskTitle}
        busy={busy}
        onCancel={() => setDialogMode(null)}
        onConfirm={handleConfirm}
      />
    </>
  );
}

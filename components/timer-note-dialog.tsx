"use client";

import { useEffect, useState } from "react";
import { Play, Square } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatElapsed } from "@/hooks/use-active-timer";

type Mode = "start" | "stop";

type Props = {
  open: boolean;
  mode: Mode;
  taskTitle?: string;
  elapsedMs?: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void | Promise<void>;
};

export function TimerNoteDialog({
  open,
  mode,
  taskTitle,
  elapsedMs,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const isStart = mode === "start";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isStart ? "Start timer?" : "Stop timer?"}
          </DialogTitle>
          <DialogDescription>
            {isStart
              ? `Start tracking time on ${taskTitle ?? "this task"}. Add an optional note about what you'll work on.`
              : `Stop tracking ${taskTitle ?? "this task"} and save a time log${
                  typeof elapsedMs === "number"
                    ? ` (${formatElapsed(elapsedMs)})`
                    : ""
                }. Add an optional note about what you worked on.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="timer-note" className="text-xs">
            Note <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="timer-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              isStart
                ? "What are you starting on?"
                : "What did you work on?"
            }
            rows={3}
            disabled={busy}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(note.trim())}
            disabled={busy}
            className={
              isStart
                ? ""
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }
          >
            {isStart ? (
              <Play className="size-3.5" />
            ) : (
              <Square className="size-3.5 fill-current" />
            )}
            {busy
              ? isStart
                ? "Starting…"
                : "Stopping…"
              : isStart
              ? "Start"
              : "Stop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

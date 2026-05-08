"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

export type ActiveTimer = {
  _id: string;
  startedAt: string;
  note?: string;
  project: { _id: string; name: string; projectId: string } | null;
  task: { _id: string; title: string; taskId?: string | null } | null;
};

type TimerContextValue = {
  timer: ActiveTimer | null;
  elapsedMs: number;
  loading: boolean;
  refresh: () => Promise<void>;
  start: (
    taskId: string,
    note?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  stop: (note?: string) => Promise<{ ok: boolean; error?: string }>;
};

const TimerContext = createContext<TimerContextValue | null>(null);

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export function ActiveTimerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [timer, setTimer] = useState<ActiveTimer | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/timer/active", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setTimer(data.timer ?? null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  useEffect(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (!timer) {
      setElapsedMs(0);
      return;
    }
    const startMs = new Date(timer.startedAt).getTime();
    const update = () => setElapsedMs(Math.max(0, Date.now() - startMs));
    update();
    tickRef.current = setInterval(update, 1000);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [timer]);

  useEffect(() => {
    if (!timer) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [timer]);

  const start = useCallback(
    async (taskId: string, note?: string) => {
      try {
        const res = await fetch("/api/timer/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, note: note ?? "" }),
        });
        const data = await res.json();
        if (!res.ok) {
          return {
            ok: false,
            error: data.error || "Failed to start timer",
          };
        }
        setTimer(data.timer ?? null);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Failed to start timer",
        };
      }
    },
    []
  );

  const stop = useCallback(
    async (note?: string) => {
      const now = new Date();
      const clientDate = now.toISOString();
      const clientEndTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
      let clientStartTime: string | undefined;
      if (timer) {
        const s = new Date(timer.startedAt);
        clientStartTime = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
      }

      try {
        const res = await fetch("/api/timer/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: note ?? "",
            clientDate,
            clientStartTime,
            clientEndTime,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error || "Failed to stop timer" };
        }
        setTimer(null);
        toast.success(
          `Logged ${(data.hours ?? 0).toString()}h${data.log?.task?.title ? ` on ${data.log.task.title}` : ""}`
        );
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Failed to stop timer",
        };
      }
    },
    [timer]
  );

  return (
    <TimerContext.Provider
      value={{ timer, elapsedMs, loading, refresh, start, stop }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useActiveTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error("useActiveTimer must be used within ActiveTimerProvider");
  }
  return ctx;
}

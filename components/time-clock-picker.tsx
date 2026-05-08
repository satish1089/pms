"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SIZE = 224;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 92;

function pos(angleDeg: number, r: number) {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function to12h(hour24: number): { hour12: number; period: "AM" | "PM" } {
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, period };
}

function to24h(hour12: number, period: "AM" | "PM"): number {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

export function TimeClockPicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"hour" | "minute">("hour");

  const [hStr, mStr] = (value || "00:00").split(":");
  const hour24 = Math.max(0, Math.min(23, parseInt(hStr || "0", 10) || 0));
  const minute = Math.max(0, Math.min(59, parseInt(mStr || "0", 10) || 0));
  const { hour12, period } = to12h(hour24);

  const [hourDraft, setHourDraft] = useState(String(hour12).padStart(2, "0"));
  const [minDraft, setMinDraft] = useState(String(minute).padStart(2, "0"));

  useEffect(() => {
    setHourDraft(String(hour12).padStart(2, "0"));
  }, [hour12]);
  useEffect(() => {
    setMinDraft(String(minute).padStart(2, "0"));
  }, [minute]);

  function emit(nextHour24: number, nextMin: number) {
    onChange(
      `${String(nextHour24).padStart(2, "0")}:${String(nextMin).padStart(2, "0")}`
    );
  }
  function pickHour(h12: number) {
    emit(to24h(h12, period), minute);
    setMode("minute");
  }
  function pickMinute(m: number) {
    emit(hour24, m);
  }
  function togglePeriod() {
    emit(to24h(hour12, period === "AM" ? "PM" : "AM"), minute);
  }
  function commitHour() {
    const n = parseInt(hourDraft, 10);
    if (Number.isNaN(n)) {
      setHourDraft(String(hour12).padStart(2, "0"));
      return;
    }
    const clamped = Math.max(1, Math.min(12, n));
    emit(to24h(clamped, period), minute);
  }
  function commitMinute() {
    const n = parseInt(minDraft, 10);
    if (Number.isNaN(n)) {
      setMinDraft(String(minute).padStart(2, "0"));
      return;
    }
    const clamped = Math.max(0, Math.min(59, n));
    emit(hour24, clamped);
  }

  const handAngle = mode === "hour" ? (hour12 % 12) * 30 : minute * 6;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTimeout(() => setMode("hour"), 200);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? "Pick time"}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border bg-background px-2 font-mono text-sm shadow-none transition-colors hover:bg-accent"
        >
          <Clock className="size-3.5 text-muted-foreground" />
          <span className="tabular-nums">
            {String(hour12).padStart(2, "0")}:{String(minute).padStart(2, "0")}
          </span>
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            {period}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="mb-3 flex items-center justify-center gap-2">
          <DigitInput
            value={hourDraft}
            onValue={setHourDraft}
            onCommit={commitHour}
            onFocus={() => setMode("hour")}
            active={mode === "hour"}
            min={1}
            max={12}
          />
          <span className="font-mono text-2xl text-muted-foreground">:</span>
          <DigitInput
            value={minDraft}
            onValue={setMinDraft}
            onCommit={commitMinute}
            onFocus={() => setMode("minute")}
            active={mode === "minute"}
            min={0}
            max={59}
          />
          <button
            type="button"
            onClick={togglePeriod}
            aria-label={`Switch to ${period === "AM" ? "PM" : "AM"}`}
            className="ml-1 rounded-md border bg-primary px-2.5 py-1.5 text-xs font-bold uppercase text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {period}
          </button>
        </div>

        <div
          className="relative rounded-full bg-muted/40"
          style={{ width: SIZE, height: SIZE }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 origin-bottom bg-primary/70"
            style={{
              width: 2,
              height: R,
              marginLeft: -1,
              marginTop: -R,
              transform: `rotate(${handAngle}deg)`,
              transformOrigin: "bottom center",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
          />

          {mode === "hour"
            ? Array.from({ length: 12 }, (_, i) => {
                const v = i === 0 ? 12 : i;
                const { x, y } = pos(i * 30, R);
                const selected = hour12 === v;
                return (
                  <ClockNum
                    key={`h-${i}`}
                    x={x}
                    y={y}
                    onClick={() => pickHour(v)}
                    selected={selected}
                  >
                    {v}
                  </ClockNum>
                );
              })
            : Array.from({ length: 12 }, (_, i) => {
                const v = i * 5;
                const { x, y } = pos(i * 30, R);
                const selected = minute === v;
                return (
                  <ClockNum
                    key={`m-${i}`}
                    x={x}
                    y={y}
                    onClick={() => pickMinute(v)}
                    selected={selected}
                  >
                    {String(v).padStart(2, "0")}
                  </ClockNum>
                );
              })}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMode(mode === "hour" ? "minute" : "hour")}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {mode === "hour" ? "Pick minutes" : "Pick hour"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setTimeout(() => setMode("hour"), 200);
            }}
            className="rounded-md px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10"
          >
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DigitInput({
  value,
  onValue,
  onCommit,
  onFocus,
  active,
  min,
  max,
}: {
  value: string;
  onValue: (v: string) => void;
  onCommit: () => void;
  onFocus: () => void;
  active: boolean;
  min: number;
  max: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      onChange={(e) => {
        const next = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
        onValue(next);
      }}
      onFocus={(e) => {
        onFocus();
        e.currentTarget.select();
      }}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit();
          ref.current?.blur();
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const cur = parseInt(value || "0", 10) || 0;
          const step = e.key === "ArrowUp" ? 1 : -1;
          const next = Math.max(min, Math.min(max, cur + step));
          onValue(String(next).padStart(2, "0"));
          setTimeout(onCommit, 0);
        }
      }}
      aria-label={min === 1 ? "Hour" : "Minute"}
      className={cn(
        "w-14 rounded px-1.5 py-0.5 text-center font-mono text-2xl tabular-nums outline-none transition-colors",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent focus:bg-primary/15 focus:text-primary"
      )}
    />
  );
}

function ClockNum({
  x,
  y,
  children,
  selected,
  onClick,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-xs tabular-nums transition-colors",
        selected
          ? "bg-primary text-primary-foreground"
          : "text-foreground/80 hover:bg-accent"
      )}
      style={{ left: x, top: y }}
    >
      {children}
    </button>
  );
}

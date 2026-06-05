export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import TimeLog from "@/models/TimeLog";
import Task from "@/models/Task";
import { getSession } from "@/lib/auth";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",");
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const fmtDate = (d: Date) =>
  `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q")?.trim() ?? "";
    const projectId = searchParams.get("project") ?? "all";
    const userId = searchParams.get("user") ?? "all";
    const dateFrom = searchParams.get("dateFrom") ?? "";
    const dateTo = searchParams.get("dateTo") ?? "";

    const isManager =
      session.role === "admin" || session.role === "project_manager";

    const filter: Record<string, unknown> = {};

    if (!isManager) {
      filter.user = new mongoose.Types.ObjectId(session.sub);
    } else if (userId !== "all" && mongoose.Types.ObjectId.isValid(userId)) {
      filter.user = new mongoose.Types.ObjectId(userId);
    }

    if (projectId !== "all" && mongoose.Types.ObjectId.isValid(projectId)) {
      filter.project = new mongoose.Types.ObjectId(projectId);
    }

    if (dateFrom || dateTo) {
      const range: Record<string, Date> = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        if (!Number.isNaN(d.getTime())) {
          range.$gte = d;
        }
      }
      if (dateTo) {
        const d = new Date(dateTo);
        if (!Number.isNaN(d.getTime())) {
          // dateTo is the selected day's start instant; include the whole day.
          d.setTime(d.getTime() + 24 * 60 * 60 * 1000);
          range.$lt = d;
        }
      }
      if (Object.keys(range).length > 0) filter.date = range;
    }

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      const matchedTasks = await Task.find({ title: rx })
        .select("_id")
        .lean();
      const taskIds = matchedTasks.map((t) => t._id);
      filter.$or = [
        { note: rx },
        { manualTaskTitle: rx },
        ...(taskIds.length > 0 ? [{ task: { $in: taskIds } }] : []),
      ];
    }

    const logs = await TimeLog.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .populate("user", "name")
      .populate("project", "name projectId")
      .populate("task", "title taskId")
      .lean();

    const header = [
      "Date",
      "User",
      "Project",
      "Task",
      "Start",
      "End",
      "Hours",
      "Note",
    ];

    type PopulatedUser = { name?: string };
    type PopulatedProject = { name?: string; projectId?: string };
    type PopulatedTask = { title?: string; taskId?: string | null };

    const rows = logs.map((l) => {
      const u = (l.user ?? null) as PopulatedUser | null;
      const p = (l.project ?? null) as PopulatedProject | null;
      const t = (l.task ?? null) as PopulatedTask | null;
      const d = l.date instanceof Date ? l.date : new Date(l.date as string);
      const dateStr = Number.isNaN(d.getTime()) ? "" : fmtDate(d);
      const projectLabel = p
        ? p.projectId
          ? `${p.projectId} ${p.name ?? ""}`.trim()
          : p.name ?? ""
        : "";
      const taskLabel = t
        ? t.taskId
          ? `${t.taskId} ${t.title ?? ""}`.trim()
          : t.title ?? ""
        : (l as { manualTaskTitle?: string }).manualTaskTitle?.trim() ||
          "Project (general)";
      return [
        dateStr,
        u?.name ?? "",
        projectLabel,
        taskLabel,
        l.startTime ?? "",
        l.endTime ?? "",
        l.hours ?? 0,
        l.note ?? "",
      ];
    });

    const csv = [toCsvRow(header), ...rows.map(toCsvRow)].join("\r\n");
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `time-logs-${stamp}.csv`;

    return new NextResponse("﻿" + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

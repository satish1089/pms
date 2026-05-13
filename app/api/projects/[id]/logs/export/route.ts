export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import TimeLog from "@/models/TimeLog";
import Task from "@/models/Task";
import { getSession } from "@/lib/auth";
import { getProjectForSession, canManageProject } from "@/lib/project-access";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await connectDB();
    const project = await getProjectForSession(id, session);
    if (!project)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const userParam = url.searchParams.get("userId");
    const startParam = url.searchParams.get("startDate");
    const endParam = url.searchParams.get("endDate");
    const q = url.searchParams.get("q")?.trim() ?? "";
    const isManager = canManageProject(session);
    const filter: Record<string, unknown> = { project: project._id };

    if (isManager) {
      if (userParam && userParam !== "all") {
        if (!mongoose.Types.ObjectId.isValid(userParam))
          return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
        filter.user = new mongoose.Types.ObjectId(userParam);
      }
    } else {
      filter.user = new mongoose.Types.ObjectId(session.sub);
    }

    if (startParam || endParam) {
      const range: Record<string, Date> = {};
      if (startParam) {
        const d = new Date(startParam);
        if (Number.isNaN(d.getTime()))
          return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
        d.setHours(0, 0, 0, 0);
        range.$gte = d;
      }
      if (endParam) {
        const d = new Date(endParam);
        if (Number.isNaN(d.getTime()))
          return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
      filter.date = range;
    }

    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(safe, "i");
      const matched = await Task.find({ project: project._id, title: rx })
        .select("_id")
        .lean();
      const taskIds = matched.map((t) => t._id);
      filter.$or = [
        { note: rx },
        { manualTaskTitle: rx },
        ...(taskIds.length > 0 ? [{ task: { $in: taskIds } }] : []),
      ];
    }

    const logs = await TimeLog.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .populate("user", "name email")
      .populate("task", "title taskId")
      .lean();

    const header = [
      "Date",
      "User",
      "Task",
      "Start",
      "End",
      "Hours",
      "Note",
    ];

    const MONTHS = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const fmtDate = (d: Date) =>
      `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

    type PopulatedUser = { name?: string };
    type PopulatedTask = { title?: string; taskId?: string | null };

    const rows = logs.map((l) => {
      const u = (l.user ?? null) as PopulatedUser | null;
      const t = (l.task ?? null) as PopulatedTask | null;
      const d = l.date instanceof Date ? l.date : new Date(l.date as string);
      const dateStr = Number.isNaN(d.getTime()) ? "" : fmtDate(d);
      const taskLabel = t
        ? t.taskId
          ? `${t.taskId} ${t.title ?? ""}`.trim()
          : t.title ?? ""
        : (l as { manualTaskTitle?: string }).manualTaskTitle?.trim() ||
          "Project (general)";
      return [
        dateStr,
        u?.name ?? "",
        taskLabel,
        l.startTime ?? "",
        l.endTime ?? "",
        l.hours ?? 0,
        l.note ?? "",
      ];
    });

    const csv = [toCsvRow(header), ...rows.map(toCsvRow)].join("\r\n");
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `time-logs-${project.projectId ?? project._id}-${stamp}.csv`;

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

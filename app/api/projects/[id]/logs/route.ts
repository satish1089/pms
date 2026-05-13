export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import TimeLog from "@/models/TimeLog";
import Task from "@/models/Task";
import { getSession } from "@/lib/auth";
import { getProjectForSession, canManageProject } from "@/lib/project-access";
import { validationResponse } from "@/lib/api-errors";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const createSchema = z.object({
  task: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? null : v)),
  manualTaskTitle: z.string().max(200).optional().default(""),
  date: z.string().min(1),
  startTime: z.string().regex(TIME_RE, "Invalid start time"),
  endTime: z.string().regex(TIME_RE, "Invalid end time"),
  note: z.string().max(500).default(""),
});

function toMinutes(t: string) {
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
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
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10)
    );
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

    const total = await TimeLog.countDocuments(filter);
    const logs = await TimeLog.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name email role")
      .populate("task", "title taskId")
      .lean();

    const totalHoursAgg = await TimeLog.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$hours" } } },
    ]);
    const totalHours = totalHoursAgg[0]?.total ?? 0;

    return NextResponse.json({
      logs,
      page,
      limit,
      total,
      totalHours,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    await connectDB();
    const project = await getProjectForSession(id, session);
    if (!project)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const date = new Date(parsed.data.date);
    if (Number.isNaN(date.getTime()))
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });

    const startMin = toMinutes(parsed.data.startTime);
    const endMin = toMinutes(parsed.data.endTime);
    if (endMin <= startMin)
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    const hours = +(((endMin - startMin) / 60).toFixed(2));

    let taskRef: mongoose.Types.ObjectId | null = null;
    if (parsed.data.task && parsed.data.task !== "project") {
      if (!mongoose.Types.ObjectId.isValid(parsed.data.task))
        return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
      const task = await Task.findOne({
        _id: parsed.data.task,
        project: project._id,
      })
        .select("_id")
        .lean();
      if (!task)
        return NextResponse.json({ error: "Task not found" }, { status: 400 });
      taskRef = task._id;
    }

    const created = await TimeLog.create({
      project: project._id,
      user: new mongoose.Types.ObjectId(session.sub),
      task: taskRef,
      manualTaskTitle: taskRef ? "" : parsed.data.manualTaskTitle.trim(),
      date,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      hours,
      note: parsed.data.note.trim(),
    });

    const populated = await TimeLog.findById(created._id)
      .populate("user", "name email role")
      .populate("task", "title taskId")
      .lean();

    return NextResponse.json({ log: populated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

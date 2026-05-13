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
    const taskId = searchParams.get("task") ?? "all";
    const dateFrom = searchParams.get("dateFrom") ?? "";
    const dateTo = searchParams.get("dateTo") ?? "";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit") ?? "10") || 10)
    );

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

    if (taskId === "none") {
      filter.task = null;
    } else if (taskId !== "all" && mongoose.Types.ObjectId.isValid(taskId)) {
      filter.task = new mongoose.Types.ObjectId(taskId);
    }

    if (dateFrom || dateTo) {
      const range: Record<string, Date> = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        if (!Number.isNaN(d.getTime())) range.$gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo);
        if (!Number.isNaN(d.getTime())) range.$lte = d;
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

    const [logs, total, totalHoursAgg] = await Promise.all([
      TimeLog.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name email role")
        .populate("project", "name projectId")
        .populate("task", "title taskId")
        .lean(),
      TimeLog.countDocuments(filter),
      TimeLog.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: "$hours" } } },
      ]),
    ]);

    const totalHours = totalHoursAgg[0]?.total ?? 0;

    return NextResponse.json({
      logs,
      total,
      totalHours,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

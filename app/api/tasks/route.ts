export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Task, { TASK_STATUSES, TASK_TYPES } from "@/models/Task";
import { TASK_PRIORITIES } from "@/lib/task-priority";
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
    const projectId = searchParams.get("project") ?? "";
    const status = searchParams.get("status") ?? "all";
    const priority = searchParams.get("priority") ?? "all";
    const type = searchParams.get("type") ?? "all";
    const tag = searchParams.get("tag") ?? "";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit") ?? "10") || 10)
    );

    const filter: Record<string, unknown> = {};

    if (session.role === "user") {
      filter.assignees = new mongoose.Types.ObjectId(session.sub);
    }

    if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
      filter.project = new mongoose.Types.ObjectId(projectId);
    }

    if ((TASK_STATUSES as readonly string[]).includes(status)) {
      filter.status = status;
    }

    if ((TASK_PRIORITIES as readonly string[]).includes(priority)) {
      filter.priority = priority;
    }

    if ((TASK_TYPES as readonly string[]).includes(type)) {
      filter.type = type;
    }

    if (tag.trim()) {
      filter.tags = tag.trim();
    }

    if (q) {
      filter.title = new RegExp(escapeRegex(q), "i");
    }

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("createdBy", "name email role")
        .populate("assignees", "name email role")
        .populate("reportingPersons", "name email role")
        .populate({ path: "project", select: "name projectId" })
        .lean(),
      Task.countDocuments(filter),
    ]);

    return NextResponse.json({
      tasks,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

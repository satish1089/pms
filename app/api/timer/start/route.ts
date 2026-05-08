export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import ActiveTimer from "@/models/ActiveTimer";
import Task from "@/models/Task";
import { getSession } from "@/lib/auth";
import { getProjectForSession } from "@/lib/project-access";
import { validationResponse } from "@/lib/api-errors";

const startSchema = z.object({
  taskId: z.string().min(1),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const { taskId } = parsed.data;
    if (!mongoose.Types.ObjectId.isValid(taskId))
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });

    await connectDB();

    const userObjId = new mongoose.Types.ObjectId(session.sub);

    const existing = await ActiveTimer.findOne({ user: userObjId })
      .populate("task", "title taskId")
      .populate("project", "name projectId")
      .lean();
    if (existing) {
      return NextResponse.json(
        {
          error: "A timer is already running. Stop it before starting another.",
          timer: existing,
        },
        { status: 409 }
      );
    }

    const task = await Task.findById(taskId).select("_id project").lean();
    if (!task)
      return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const project = await getProjectForSession(String(task.project), session);
    if (!project)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const created = await ActiveTimer.create({
      user: userObjId,
      project: project._id,
      task: task._id,
      startedAt: new Date(),
      note: (parsed.data.note ?? "").trim(),
    });

    const populated = await ActiveTimer.findById(created._id)
      .populate("project", "name projectId")
      .populate("task", "title taskId")
      .lean();

    return NextResponse.json({ timer: populated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import TimeLog from "@/models/TimeLog";
import Task from "@/models/Task";
import { getSession } from "@/lib/auth";
import { canManageProject } from "@/lib/project-access";
import { validationResponse } from "@/lib/api-errors";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const updateSchema = z.object({
  task: z.string().nullable().optional(),
  manualTaskTitle: z.string().max(200).optional(),
  date: z.string().min(1).optional(),
  startTime: z.string().regex(TIME_RE, "Invalid start time").optional(),
  endTime: z.string().regex(TIME_RE, "Invalid end time").optional(),
  note: z.string().optional(),
});

function toMinutes(t: string) {
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function loadLog(logId: string, session: Awaited<ReturnType<typeof getSession>>) {
  if (!session || !isValidId(logId)) return null;
  await connectDB();
  const log = await TimeLog.findById(logId);
  if (!log) return null;
  const isOwner = String(log.user) === session.sub;
  const isManager = canManageProject(session);
  if (!isOwner && !isManager) return null;
  return { log, isOwner, isManager };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const access = await loadLog(id, session);
    if (!access)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { log } = access;
    const update: Record<string, unknown> = {};

    if (parsed.data.date !== undefined) {
      const d = new Date(parsed.data.date);
      if (Number.isNaN(d.getTime()))
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      update.date = d;
    }

    const nextStart = parsed.data.startTime ?? log.startTime;
    const nextEnd = parsed.data.endTime ?? log.endTime;
    if (
      parsed.data.startTime !== undefined ||
      parsed.data.endTime !== undefined
    ) {
      const startMin = toMinutes(nextStart);
      const endMin = toMinutes(nextEnd);
      if (endMin <= startMin)
        return NextResponse.json(
          { error: "End time must be after start time" },
          { status: 400 }
        );
      update.startTime = nextStart;
      update.endTime = nextEnd;
      update.hours = +(((endMin - startMin) / 60).toFixed(2));
    }

    if (parsed.data.task !== undefined) {
      if (parsed.data.task === null || parsed.data.task === "project") {
        update.task = null;
      } else {
        if (!isValidId(parsed.data.task))
          return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
        const task = await Task.findOne({
          _id: parsed.data.task,
          project: log.project,
        })
          .select("_id")
          .lean();
        if (!task)
          return NextResponse.json({ error: "Task not found" }, { status: 400 });
        update.task = task._id;
        update.manualTaskTitle = "";
      }
    }

    if (parsed.data.manualTaskTitle !== undefined) {
      const trimmed = parsed.data.manualTaskTitle.trim();
      const willHaveTask =
        update.task !== undefined ? update.task !== null : Boolean(log.task);
      update.manualTaskTitle = willHaveTask ? "" : trimmed;
    }

    if (parsed.data.note !== undefined) update.note = parsed.data.note.trim();

    const updated = await TimeLog.findByIdAndUpdate(id, update, { new: true })
      .populate("user", "name email role")
      .populate("task", "title taskId")
      .lean();

    return NextResponse.json({ log: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const access = await loadLog(id, session);
    if (!access)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await TimeLog.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

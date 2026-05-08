export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import ActiveTimer from "@/models/ActiveTimer";
import TimeLog from "@/models/TimeLog";
import { getSession } from "@/lib/auth";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const stopSchema = z.object({
  note: z.string().max(500).optional(),
  clientDate: z.string().optional(),
  clientStartTime: z.string().regex(TIME_RE).optional(),
  clientEndTime: z.string().regex(TIME_RE).optional(),
});

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function hhmm(d: Date) {
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = stopSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    await connectDB();

    const userObjId = new mongoose.Types.ObjectId(session.sub);
    const timer = await ActiveTimer.findOne({ user: userObjId });
    if (!timer)
      return NextResponse.json({ error: "No active timer" }, { status: 404 });

    const startedAt = timer.startedAt;
    const endedAt = new Date();
    const elapsedMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
    const hours = +(elapsedMs / 3_600_000).toFixed(2);

    const date = parsed.data.clientDate
      ? new Date(parsed.data.clientDate)
      : startedAt;
    const startTime = parsed.data.clientStartTime ?? hhmm(startedAt);
    const endTime = parsed.data.clientEndTime ?? hhmm(endedAt);

    const startNote = (timer.note ?? "").trim();
    const stopNote = (parsed.data.note ?? "").trim();
    const noteParts = ["[Tracked via Start/Stop]"];
    if (startNote) noteParts.push(`Start: ${startNote}`);
    if (stopNote) noteParts.push(`Stop: ${stopNote}`);
    const note = noteParts.join(" · ");

    const log = await TimeLog.create({
      project: timer.project,
      user: userObjId,
      task: timer.task,
      date: Number.isNaN(date.getTime()) ? startedAt : date,
      startTime,
      endTime,
      hours,
      note,
    });

    await ActiveTimer.deleteOne({ _id: timer._id });

    const populated = await TimeLog.findById(log._id)
      .populate("user", "name email role")
      .populate("project", "name projectId")
      .populate("task", "title taskId")
      .lean();

    return NextResponse.json({ log: populated, hours, elapsedMs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

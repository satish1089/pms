export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import ActiveTimer from "@/models/ActiveTimer";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const timer = await ActiveTimer.findOne({
      user: new mongoose.Types.ObjectId(session.sub),
    })
      .populate("project", "name projectId")
      .populate("task", "title taskId")
      .lean();

    return NextResponse.json({ timer: timer ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

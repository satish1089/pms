export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Task from "@/models/Task";
import { getSession } from "@/lib/auth";
import { getProjectForSession } from "@/lib/project-access";

export async function GET(
  _req: NextRequest,
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

    const tags = (await Task.distinct("tags", {
      project: project._id,
    })) as string[];

    return NextResponse.json({
      tags: tags.filter(Boolean).sort((a, b) => a.localeCompare(b)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

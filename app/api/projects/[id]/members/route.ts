export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { getSession } from "@/lib/auth";
import { getProjectForSession } from "@/lib/project-access";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    const q = url.searchParams.get("q")?.trim() ?? "";
    const limitParam = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const limit = Math.min(50, Math.max(1, Number.isFinite(limitParam) ? limitParam : 20));

    const ids = new Set<string>();
    for (const u of project.assignees ?? []) ids.add(String(u));
    for (const u of project.reportingTo ?? []) ids.add(String(u));
    if (project.createdBy) ids.add(String(project.createdBy));

    const filter: Record<string, unknown> = {
      _id: { $in: Array.from(ids) },
    };
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const users = await User.find(filter)
      .select("name email role")
      .sort({ name: 1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ users });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

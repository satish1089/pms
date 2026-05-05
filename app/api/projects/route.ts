export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Project from "@/models/Project";
import { nextSeq, peekSeq } from "@/models/Counter";
import { getSession } from "@/lib/auth";
import { fieldError, validationResponse } from "@/lib/api-errors";
import { sanitizeRichHtml } from "@/lib/sanitize";
import {
  getAppUrl,
  sendProjectAssignedEmail,
} from "@/lib/mailer";
import { createNotifications, type NotifyInput } from "@/lib/notify";
import { notifyProjectAssignmentSlack } from "@/lib/slack-notify";

const createSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  reportingTo: z
    .array(z.string())
    .min(1, "Select at least one reporting person"),
  assignees: z.array(z.string()).default([]),
});

function pad4(n: number) {
  return String(n).padStart(4, "0");
}

function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q")?.trim() ?? "";
    const status = searchParams.get("status") ?? "all";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit") ?? "10") || 10)
    );
    const peek = searchParams.get("peekId") === "1";

    if (peek) {
      const n = await peekSeq("projectId");
      return NextResponse.json({ nextId: pad4(n) });
    }

    const filter: Record<string, unknown> = {};
    const and: Record<string, unknown>[] = [];

    if (session.role === "user") {
      const uid = new mongoose.Types.ObjectId(session.sub);
      and.push({ $or: [{ assignees: uid }, { reportingTo: uid }] });
    }

    if (status === "active" || status === "inactive") {
      filter.status = status;
    }

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      and.push({ $or: [{ name: rx }, { projectId: rx }] });
    }

    if (and.length > 0) filter.$and = and;

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("createdBy", "name email role")
        .populate("reportingTo", "name email role")
        .populate("assignees", "name email role")
        .lean(),
      Project.countDocuments(filter),
    ]);

    return NextResponse.json({
      projects,
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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin" && session.role !== "project_manager") {
    return NextResponse.json(
      { error: "Only admins and project managers can create projects" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    for (const id of parsed.data.reportingTo) {
      if (!isValidId(id)) {
        return fieldError("reportingTo", "Invalid reporting person");
      }
    }
    for (const id of parsed.data.assignees) {
      if (!isValidId(id)) {
        return fieldError("assignees", "Invalid assignee");
      }
    }

    await connectDB();

    const seq = await nextSeq("projectId");
    const projectId = pad4(seq);

    const created = await Project.create({
      projectId,
      name: parsed.data.name,
      description: sanitizeRichHtml(parsed.data.description ?? ""),
      status: parsed.data.status,
      createdBy: new mongoose.Types.ObjectId(session.sub),
      reportingTo: parsed.data.reportingTo.map(
        (id) => new mongoose.Types.ObjectId(id)
      ),
      assignees: parsed.data.assignees.map(
        (id) => new mongoose.Types.ObjectId(id)
      ),
    });

    const populated = await Project.findById(created._id)
      .populate("createdBy", "name email role")
      .populate("reportingTo", "name email role")
      .populate("assignees", "name email role")
      .lean();

    if (populated) {
      const projectUrl = `${getAppUrl()}/dashboard/projects/${String(
        populated._id
      )}`;
      const actorName = session.name;
      type P = { _id: unknown; name: string; email: string };
      const recipients: { user: P; role: "assignee" | "reportingTo" }[] = [];
      const slackTargets: {
        userId: string;
        role: "assignee" | "reportingTo";
      }[] = [];
      for (const a of (populated.assignees ?? []) as unknown as P[]) {
        if (!a) continue;
        if (String(a._id) !== session.sub) {
          recipients.push({ user: a, role: "assignee" });
        }
        slackTargets.push({ userId: String(a._id), role: "assignee" });
      }
      for (const rt of (populated.reportingTo ?? []) as unknown as P[]) {
        if (!rt) continue;
        if (String(rt._id) !== session.sub) {
          recipients.push({ user: rt, role: "reportingTo" });
        }
        slackTargets.push({ userId: String(rt._id), role: "reportingTo" });
      }

      Promise.allSettled(
        recipients.map((r) =>
          sendProjectAssignedEmail({
            to: r.user.email,
            recipientName: r.user.name,
            actorName,
            project: {
              name: populated.name,
              projectId: populated.projectId,
              status: populated.status,
            },
            projectUrl,
            role: r.role,
          })
        )
      ).catch(() => {});

      const notifyItems: NotifyInput[] = recipients.map((r) => ({
        recipient: String(r.user._id),
        actor: session.sub,
        type: "project_assigned",
        project: String(populated._id),
        message: `${actorName} assigned you to project "${populated.name}" as ${
          r.role === "assignee" ? "assignee" : "reporting"
        }`,
        data: { role: r.role, projectId: populated.projectId },
      }));
      createNotifications(notifyItems);

      notifyProjectAssignmentSlack(
        slackTargets.map((t) => ({
          userId: t.userId,
          kind: "assigned" as const,
          role: t.role,
        })),
        {
          actorName,
          actorId: session.sub,
          project: {
            id: String(populated._id),
            projectId: populated.projectId,
            name: populated.name,
          },
          projectUrl,
        }
      ).catch(() => {});
    }

    return NextResponse.json({ project: populated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

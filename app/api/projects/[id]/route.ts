export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Project from "@/models/Project";
import User from "@/models/User";
import { getSession } from "@/lib/auth";
import { fieldError, validationResponse } from "@/lib/api-errors";
import { sanitizeRichHtml } from "@/lib/sanitize";
import {
  getAppUrl,
  sendProjectAssignedEmail,
  sendProjectUnassignedEmail,
} from "@/lib/mailer";
import { createNotifications, type NotifyInput } from "@/lib/notify";
import { notifyProjectAssignmentSlack } from "@/lib/slack-notify";

const updateSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters").optional(),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  reportingTo: z.array(z.string()).min(1).optional(),
  assignees: z.array(z.string()).optional(),
});

function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }
  try {
    await connectDB();
    const project = await Project.findById(id)
      .populate("createdBy", "name email role")
      .populate("reportingTo", "name email role")
      .populate("assignees", "name email role")
      .lean();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (session.role === "user") {
      const assigneeIds = (project.assignees ?? []).map((a) =>
        String((a as unknown as { _id: unknown })._id ?? a)
      );
      const reportingIds = Array.isArray(project.reportingTo)
        ? project.reportingTo.map((r) =>
            typeof r === "object" && r !== null && "_id" in r
              ? String((r as { _id: unknown })._id)
              : String(r)
          )
        : [];
      const isAssignee = assigneeIds.includes(session.sub);
      const isReportingTo = reportingIds.includes(session.sub);
      if (!isAssignee && !isReportingTo) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin" && session.role !== "project_manager") {
    return NextResponse.json(
      { error: "Only admins and project managers can edit projects" },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    if (parsed.data.reportingTo) {
      for (const id of parsed.data.reportingTo) {
        if (!isValidId(id)) {
          return fieldError("reportingTo", "Invalid reporting person");
        }
      }
    }
    if (parsed.data.assignees) {
      for (const a of parsed.data.assignees) {
        if (!isValidId(a)) return fieldError("assignees", "Invalid assignee");
      }
    }

    await connectDB();

    const prev = await Project.findById(id).lean();
    if (!prev) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.description !== undefined)
      update.description = sanitizeRichHtml(parsed.data.description);
    if (parsed.data.status !== undefined) update.status = parsed.data.status;
    if (parsed.data.reportingTo !== undefined)
      update.reportingTo = parsed.data.reportingTo.map(
        (x) => new mongoose.Types.ObjectId(x)
      );
    if (parsed.data.assignees !== undefined)
      update.assignees = parsed.data.assignees.map(
        (x) => new mongoose.Types.ObjectId(x)
      );

    const project = await Project.findByIdAndUpdate(id, update, { new: true })
      .populate("createdBy", "name email role")
      .populate("reportingTo", "name email role")
      .populate("assignees", "name email role")
      .lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Diff assignees + reportingTo, email recipients.
    try {
      const prevAssignees = new Set(
        (prev.assignees ?? []).map((a) => String(a))
      );
      const nextAssigneesArr = parsed.data.assignees ?? null;
      const nextAssignees = nextAssigneesArr
        ? new Set(nextAssigneesArr)
        : prevAssignees;

      const addedAssignees: string[] = [];
      const removedAssignees: string[] = [];
      if (nextAssigneesArr) {
        for (const id of nextAssignees)
          if (!prevAssignees.has(id)) addedAssignees.push(id);
        for (const id of prevAssignees)
          if (!nextAssignees.has(id)) removedAssignees.push(id);
      }

      const prevRtIds = new Set(
        (Array.isArray(prev.reportingTo)
          ? prev.reportingTo
          : prev.reportingTo
          ? [prev.reportingTo]
          : []
        ).map((r) => String(r))
      );
      const nextRtArr = parsed.data.reportingTo ?? null;
      const nextRtIds = nextRtArr ? new Set(nextRtArr) : prevRtIds;

      const addedRt: string[] = [];
      const removedRt: string[] = [];
      if (nextRtArr) {
        for (const id of nextRtIds)
          if (!prevRtIds.has(id)) addedRt.push(id);
        for (const id of prevRtIds)
          if (!nextRtIds.has(id)) removedRt.push(id);
      }

      const ids = Array.from(
        new Set(
          [
            ...addedAssignees,
            ...removedAssignees,
            ...addedRt,
            ...removedRt,
          ].filter(Boolean) as string[]
        )
      );

      if (ids.length > 0) {
        const users = await User.find({ _id: { $in: ids } })
          .select("name email")
          .lean();
        const byId = new Map(users.map((u) => [String(u._id), u]));

        const projectUrl = `${getAppUrl()}/dashboard/projects/${String(
          project._id
        )}`;
        const projectMeta = {
          name: project.name,
          projectId: project.projectId,
          status: project.status,
        };
        const actorName = session.name;

        const tasks: Promise<unknown>[] = [];

        for (const uid of addedAssignees) {
          if (uid === session.sub) continue;
          const u = byId.get(uid);
          if (!u) continue;
          tasks.push(
            sendProjectAssignedEmail({
              to: u.email,
              recipientName: u.name,
              actorName,
              project: projectMeta,
              projectUrl,
              role: "assignee",
            })
          );
        }
        for (const uid of removedAssignees) {
          if (uid === session.sub) continue;
          const u = byId.get(uid);
          if (!u) continue;
          tasks.push(
            sendProjectUnassignedEmail({
              to: u.email,
              recipientName: u.name,
              actorName,
              project: projectMeta,
              projectUrl,
              role: "assignee",
            })
          );
        }
        for (const uid of addedRt) {
          if (uid === session.sub) continue;
          const u = byId.get(uid);
          if (!u) continue;
          tasks.push(
            sendProjectAssignedEmail({
              to: u.email,
              recipientName: u.name,
              actorName,
              project: projectMeta,
              projectUrl,
              role: "reportingTo",
            })
          );
        }
        for (const uid of removedRt) {
          if (uid === session.sub) continue;
          const u = byId.get(uid);
          if (!u) continue;
          tasks.push(
            sendProjectUnassignedEmail({
              to: u.email,
              recipientName: u.name,
              actorName,
              project: projectMeta,
              projectUrl,
              role: "reportingTo",
            })
          );
        }

        Promise.allSettled(tasks).catch(() => {});

        const notifyItems: NotifyInput[] = [];
        const add = (
          uid: string,
          role: "assignee" | "reportingTo",
          kind: "project_assigned" | "project_unassigned"
        ) => {
          if (uid === session.sub) return;
          if (!byId.get(uid)) return;
          notifyItems.push({
            recipient: uid,
            actor: session.sub,
            type: kind,
            project: String(project._id),
            message:
              kind === "project_assigned"
                ? `${session.name} assigned you to project "${project.name}" as ${
                    role === "assignee" ? "assignee" : "reporting"
                  }`
                : `${session.name} removed you from project "${project.name}" (${
                    role === "assignee" ? "assignee" : "reporting"
                  })`,
            data: { role, projectId: project.projectId },
          });
        };
        addedAssignees.forEach((u) => add(u, "assignee", "project_assigned"));
        removedAssignees.forEach((u) =>
          add(u, "assignee", "project_unassigned")
        );
        addedRt.forEach((u) => add(u, "reportingTo", "project_assigned"));
        removedRt.forEach((u) => add(u, "reportingTo", "project_unassigned"));
        createNotifications(notifyItems);

        const slackChanges = [
          ...addedAssignees.map(
            (uid) =>
              ({ userId: uid, kind: "assigned", role: "assignee" }) as const
          ),
          ...removedAssignees.map(
            (uid) =>
              ({ userId: uid, kind: "unassigned", role: "assignee" }) as const
          ),
          ...addedRt.map(
            (uid) =>
              ({ userId: uid, kind: "assigned", role: "reportingTo" }) as const
          ),
          ...removedRt.map(
            (uid) =>
              ({
                userId: uid,
                kind: "unassigned",
                role: "reportingTo",
              }) as const
          ),
        ];
        notifyProjectAssignmentSlack(slackChanges, {
          actorName: session.name,
          actorId: session.sub,
          project: {
            id: String(project._id),
            projectId: project.projectId,
            name: project.name,
          },
          projectUrl,
        }).catch(() => {});
      }
    } catch {
      // swallow mail diff errors
    }

    return NextResponse.json({ project });
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
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin" && session.role !== "project_manager") {
    return NextResponse.json(
      { error: "Only admins and project managers can delete projects" },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }
  try {
    await connectDB();
    const deleted = await Project.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

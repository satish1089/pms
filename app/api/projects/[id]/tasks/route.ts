export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Task, {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from "@/models/Task";
import { nextSeq } from "@/models/Counter";
import { getSession } from "@/lib/auth";
import { getProjectForSession } from "@/lib/project-access";
import { fieldError, validationResponse } from "@/lib/api-errors";
import {
  extractMentionIds,
  sanitizeRichHtml,
  stripHtml,
} from "@/lib/sanitize";
import { getAppUrl, sendTaskAssignedEmail } from "@/lib/mailer";
import { createNotifications, type NotifyInput } from "@/lib/notify";
import {
  notifyMentionSlack,
  notifyTaskAssignmentSlack,
} from "@/lib/slack-notify";
import User from "@/models/User";

const isoDate = z
  .union([z.string().datetime(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v as string) : null));

const createSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().default(""),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  assignedDate: isoDate,
  dueDate: isoDate,
  assignees: z.array(z.string()).default([]),
  reportingPersons: z.array(z.string()).default([]),
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
  try {
    await connectDB();
    const project = await getProjectForSession(id, session);
    if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const missing = await Task.collection
      .find(
        {
          project: project._id,
          $or: [
            { taskId: { $exists: false } },
            { taskId: null },
            { taskId: "" },
          ],
        },
        { projection: { _id: 1 }, sort: { createdAt: 1 } }
      )
      .toArray();

    for (const m of missing) {
      const seq = await nextSeq(`task:${String(project._id)}`);
      const tid = `${String(seq).padStart(4, "0")}-${project.projectId}`;
      await Task.collection.updateOne(
        { _id: m._id },
        { $set: { taskId: tid } }
      );
    }

    const tasks = await Task.find({ project: project._id })
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email role")
      .populate("assignees", "name email role")
      .populate("reportingPersons", "name email role")
      .lean();

    return NextResponse.json({ tasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    for (const uid of [...parsed.data.assignees, ...parsed.data.reportingPersons]) {
      if (!isValidId(uid)) return fieldError("assignees", "Invalid user id");
    }

    await connectDB();
    const project = await getProjectForSession(id, session);
    if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const description = sanitizeRichHtml(parsed.data.description);

    const taskSeq = await nextSeq(`task:${String(project._id)}`);
    const taskIdStr = `${String(taskSeq).padStart(4, "0")}-${project.projectId}`;

    const task = await Task.create({
      project: project._id,
      taskId: taskIdStr,
      title: parsed.data.title,
      description,
      status: parsed.data.status,
      priority: parsed.data.priority,
      assignedDate: parsed.data.assignedDate,
      dueDate: parsed.data.dueDate,
      createdBy: new mongoose.Types.ObjectId(session.sub),
      assignees: parsed.data.assignees.map(
        (x) => new mongoose.Types.ObjectId(x)
      ),
      reportingPersons: parsed.data.reportingPersons.map(
        (x) => new mongoose.Types.ObjectId(x)
      ),
    });

    // Guard: if mongoose model cache stripped taskId, write it directly.
    await Task.collection.updateOne(
      { _id: task._id },
      { $set: { taskId: taskIdStr } }
    );

    const populated = await Task.findById(task._id)
      .populate("createdBy", "name email role")
      .populate("assignees", "name email role")
      .populate("reportingPersons", "name email role")
      .lean();

    if (populated) {
      try {
        const taskUrl = `${getAppUrl()}/dashboard/projects/${String(
          project._id
        )}?task=${String(populated._id)}`;
        const projectMeta = {
          _id: String(project._id),
          name: project.name,
          projectId: project.projectId,
        };
        const taskMeta = {
          title: populated.title,
          status: TASK_STATUS_LABELS[populated.status] ?? populated.status,
        };
        type U = { _id: unknown; name: string; email: string };
        const recipients: {
          user: U;
          role: "assignee" | "reportingPerson";
        }[] = [];
        const slackTargets: {
          userId: string;
          role: "assignee" | "reportingPerson";
        }[] = [];
        for (const u of (populated.assignees ?? []) as unknown as U[]) {
          if (!u) continue;
          if (String(u._id) !== session.sub) {
            recipients.push({ user: u, role: "assignee" });
          }
          slackTargets.push({ userId: String(u._id), role: "assignee" });
        }
        for (const u of (populated.reportingPersons ??
          []) as unknown as U[]) {
          if (!u) continue;
          if (String(u._id) !== session.sub) {
            recipients.push({ user: u, role: "reportingPerson" });
          }
          slackTargets.push({
            userId: String(u._id),
            role: "reportingPerson",
          });
        }

        Promise.allSettled(
          recipients.map((r) =>
            sendTaskAssignedEmail({
              to: r.user.email,
              recipientName: r.user.name,
              actorName: session.name,
              task: taskMeta,
              project: projectMeta,
              taskUrl,
              role: r.role,
            })
          )
        ).catch(() => {});

        const notifyItems: NotifyInput[] = recipients.map((r) => ({
          recipient: String(r.user._id),
          actor: session.sub,
          type: "task_assigned",
          project: projectMeta._id,
          task: String(populated._id),
          message: `${session.name} assigned you to task "${populated.title}" as ${
            r.role === "assignee" ? "assignee" : "reporting"
          }`,
          data: {
            role: r.role,
            taskId: populated.taskId,
            projectId: projectMeta.projectId,
          },
        }));
        createNotifications(notifyItems);

        notifyTaskAssignmentSlack(
          slackTargets.map((t) => ({
            userId: t.userId,
            kind: "assigned" as const,
            role: t.role,
          })),
          {
            actorName: session.name,
            project: {
              id: projectMeta._id,
              projectId: projectMeta.projectId,
              name: projectMeta.name,
            },
            task: {
              id: String(populated._id),
              taskId: populated.taskId ?? "",
              title: populated.title,
            },
            taskUrl,
          }
        ).catch(() => {});

        // Mentions inside task description
        try {
          const mentionIds = extractMentionIds(description).filter((mid) =>
            mongoose.Types.ObjectId.isValid(mid)
          );
          if (mentionIds.length > 0) {
            const allowed = new Set<string>([
              ...(project.assignees ?? []).map((a) => String(a)),
              ...slackTargets.map((t) => t.userId),
            ]);
            for (const r of project.reportingTo ?? []) allowed.add(String(r));
            if (project.createdBy) allowed.add(String(project.createdBy));
            allowed.add(session.sub);

            const recipientIds = mentionIds.filter((mid) =>
              allowed.has(mid)
            );
            if (recipientIds.length > 0) {
              const users = await User.find({ _id: { $in: recipientIds } })
                .select("name email")
                .lean();
              const snippet = stripHtml(description).slice(0, 140);

              const inAppNotifyItems: NotifyInput[] = users
                .filter((u) => String(u._id) !== session.sub)
                .map((u) => ({
                  recipient: String(u._id),
                  actor: session.sub,
                  type: "mention_task",
                  project: projectMeta._id,
                  task: String(populated._id),
                  message: `${session.name} mentioned you in task "${populated.title}"`,
                  data: {
                    snippet,
                    taskId: populated.taskId,
                    projectId: projectMeta.projectId,
                  },
                }));
              if (inAppNotifyItems.length > 0)
                createNotifications(inAppNotifyItems);

              notifyMentionSlack(recipientIds, {
                actorName: session.name,
                project: {
                  id: projectMeta._id,
                  projectId: projectMeta.projectId,
                  name: projectMeta.name,
                },
                task: {
                  id: String(populated._id),
                  taskId: populated.taskId ?? "",
                  title: populated.title,
                },
                snippet,
                url: taskUrl,
              }).catch(() => {});
            }
          }
        } catch {
          // swallow mention errors
        }
      } catch {
        // swallow mail errors
      }
    }

    return NextResponse.json({ task: populated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


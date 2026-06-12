export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Task, {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TYPES,
} from "@/models/Task";
import User from "@/models/User";
import Comment from "@/models/Comment";
import { getSession } from "@/lib/auth";
import { getProjectForSession, canManageProject } from "@/lib/project-access";
import { fieldError, validationResponse } from "@/lib/api-errors";
import {
  extractMentionIds,
  sanitizeRichHtml,
  stripHtml,
} from "@/lib/sanitize";
import {
  getAppUrl,
  sendTaskAssignedEmail,
  sendTaskUnassignedEmail,
} from "@/lib/mailer";
import { createNotifications, type NotifyInput } from "@/lib/notify";
import {
  notifyMentionSlack,
  notifyTaskAssignmentSlack,
  notifyTaskStatusChangeSlack,
} from "@/lib/slack-notify";

const subtaskSchema = z.object({
  _id: z.string().optional(),
  title: z.string().min(1, "Subtask title required"),
  completed: z.boolean().default(false),
  completedbydeveloper: z.string().optional(),
  assignee: z.string().nullable().optional(),
});

const isoDate = z
  .union([z.string().datetime(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v ? new Date(v as string) : null));

const updateSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").optional(),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  type: z.enum(TASK_TYPES).optional(),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .optional()
    .transform((arr) =>
      arr === undefined
        ? undefined
        : Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)))
    ),
  assignedDate: isoDate,
  dueDate: isoDate,
  assignees: z.array(z.string()).optional(),
  reportingPersons: z.array(z.string()).optional(),
  subtasks: z.array(subtaskSchema).optional(),
  subtaskMention: z
    .object({
      title: z.string().min(1),
      mentionIds: z.array(z.string()),
    })
    .optional(),
});

function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function loadTaskWithAccess(taskId: string, session: Awaited<ReturnType<typeof getSession>>) {
  if (!session || !isValidId(taskId)) return null;
  await connectDB();
  const task = await Task.findById(taskId);
  if (!task) return null;
  const project = await getProjectForSession(String(task.project), session);
  if (!project) return null;
  return { task, project };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const access = await loadTaskWithAccess(id, session);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const populated = await Task.findById(id)
      .populate("createdBy", "name email role")
      .populate("assignees", "name email role")
      .populate("reportingPersons", "name email role")
      .populate({
        path: "subtasks.assignee",
        select: "name email role",
        strictPopulate: false,
      })
      .populate({ path: "project", select: "name projectId" })
      .lean();

    return NextResponse.json({ task: populated });
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

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    if (parsed.data.assignees) {
      for (const uid of parsed.data.assignees) {
        if (!isValidId(uid)) return fieldError("assignees", "Invalid user id");
      }
    }
    if (parsed.data.reportingPersons) {
      for (const uid of parsed.data.reportingPersons) {
        if (!isValidId(uid)) return fieldError("reportingPersons", "Invalid user id");
      }
    }

    const access = await loadTaskWithAccess(id, session);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { task } = access;
    const isCreator = String(task.createdBy) === session.sub;
    const isAssignee = (task.assignees ?? []).some(
      (a) => String(a) === session.sub
    );
    const isReporting = (task.reportingPersons ?? []).some(
      (a) => String(a) === session.sub
    );

    const requested = Object.keys(parsed.data);
    const collaborativeOnly = requested.every(
      (k) => k === "subtasks" || k === "status"
    );
    const canCollaborate =
      isAssignee || isReporting || isCreator || canManageProject(session);

    if (collaborativeOnly) {
      if (!canCollaborate) {
        return NextResponse.json(
          { error: "You do not have access to this task" },
          { status: 403 }
        );
      }
    } else if (!isCreator && !canManageProject(session)) {
      return NextResponse.json(
        { error: "Only the task creator, admins, or project managers can edit" },
        { status: 403 }
      );
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) update.title = parsed.data.title;
    if (parsed.data.description !== undefined) {
      update.description = sanitizeRichHtml(parsed.data.description);
    }
    if (parsed.data.priority !== undefined) update.priority = parsed.data.priority;
    if (parsed.data.type !== undefined) update.type = parsed.data.type;
    if (parsed.data.tags !== undefined) update.tags = parsed.data.tags;
    if (parsed.data.assignedDate !== undefined)
      update.assignedDate = parsed.data.assignedDate;
    if (parsed.data.dueDate !== undefined) update.dueDate = parsed.data.dueDate;

    const nextSubtasks =
      parsed.data.subtasks !== undefined
        ? parsed.data.subtasks
        : ((task.subtasks ?? []) as Array<{ title: string; completed: boolean }>);

    if (parsed.data.subtasks !== undefined) {
      update.subtasks = parsed.data.subtasks.map((s) => ({
        ...(s._id && isValidId(s._id)
          ? { _id: new mongoose.Types.ObjectId(s._id) }
          : {}),
        title: s.title,
        completed: s.completed,
        completedbydeveloper: s.completedbydeveloper ?? "New",
        assignee:
          s.assignee && isValidId(s.assignee)
            ? new mongoose.Types.ObjectId(s.assignee)
            : null,
      }));
    }

    if (parsed.data.status !== undefined) {
      if (parsed.data.status === "done" && nextSubtasks.length > 0) {
        const allDone = nextSubtasks.every((s) => s.completed);
        if (!allDone) {
          return NextResponse.json(
            { error: "Complete all subtasks before marking task done" },
            { status: 400 }
          );
        }
      }
      update.status = parsed.data.status;
    }

    if (parsed.data.assignees !== undefined) {
      update.assignees = parsed.data.assignees.map(
        (x) => new mongoose.Types.ObjectId(x)
      );
    }
    if (parsed.data.reportingPersons !== undefined) {
      update.reportingPersons = parsed.data.reportingPersons.map(
        (x) => new mongoose.Types.ObjectId(x)
      );
    }

    const prevAssignees = new Set(
      (task.assignees ?? []).map((x) => String(x))
    );
    const prevReporting = new Set(
      (task.reportingPersons ?? []).map((x) => String(x))
    );
    const prevStatus = task.status;
    const prevPriority = task.priority;

    const updated = await Task.findByIdAndUpdate(id, update, { new: true })
      .populate("createdBy", "name email role")
      .populate("assignees", "name email role")
      .populate("reportingPersons", "name email role")
      .populate({
        path: "subtasks.assignee",
        select: "name email role",
        strictPopulate: false,
      })
      .populate({ path: "project", select: "name projectId" })
      .lean();

    // Diff assignees + reporting, email recipients.
    if (updated) {
      try {
        type U = { _id: unknown; name: string; email: string };

        const addedAss: string[] = [];
        const removedAss: string[] = [];
        if (parsed.data.assignees !== undefined) {
          const next = new Set(parsed.data.assignees);
          for (const u of next)
            if (!prevAssignees.has(u)) addedAss.push(u);
          for (const u of prevAssignees)
            if (!next.has(u)) removedAss.push(u);
        }

        const addedRep: string[] = [];
        const removedRep: string[] = [];
        if (parsed.data.reportingPersons !== undefined) {
          const next = new Set(parsed.data.reportingPersons);
          for (const u of next)
            if (!prevReporting.has(u)) addedRep.push(u);
          for (const u of prevReporting)
            if (!next.has(u)) removedRep.push(u);
        }

        const allIds = Array.from(
          new Set(
            [...addedAss, ...removedAss, ...addedRep, ...removedRep].filter(
              Boolean
            )
          )
        );

        if (allIds.length > 0) {
          const users = await User.find({ _id: { $in: allIds } })
            .select("name email")
            .lean();
          const byId = new Map(users.map((u) => [String(u._id), u]));

          const proj = updated.project as unknown as {
            _id: unknown;
            name: string;
            projectId: string;
          } | null;
          if (proj) {
            const taskUrl = `${getAppUrl()}/dashboard/projects/${String(
              proj._id
            )}?task=${String(updated._id)}`;
            const taskMeta = {
              title: updated.title,
              status:
                TASK_STATUS_LABELS[updated.status] ?? updated.status,
            };
            const projectMeta = {
              _id: String(proj._id),
              name: proj.name,
              projectId: proj.projectId,
            };

            const tasks: Promise<unknown>[] = [];
            const pushAssigned = (
              uid: string,
              role: "assignee" | "reportingPerson"
            ) => {
              if (uid === session.sub) return;
              const u = byId.get(uid) as U | undefined;
              if (!u) return;
              tasks.push(
                sendTaskAssignedEmail({
                  to: u.email,
                  recipientName: u.name,
                  actorName: session.name,
                  task: taskMeta,
                  project: projectMeta,
                  taskUrl,
                  role,
                })
              );
            };
            const pushUnassigned = (
              uid: string,
              role: "assignee" | "reportingPerson"
            ) => {
              if (uid === session.sub) return;
              const u = byId.get(uid) as U | undefined;
              if (!u) return;
              tasks.push(
                sendTaskUnassignedEmail({
                  to: u.email,
                  recipientName: u.name,
                  actorName: session.name,
                  task: taskMeta,
                  project: projectMeta,
                  taskUrl,
                  role,
                })
              );
            };
            addedAss.forEach((u) => pushAssigned(u, "assignee"));
            removedAss.forEach((u) => pushUnassigned(u, "assignee"));
            addedRep.forEach((u) => pushAssigned(u, "reportingPerson"));
            removedRep.forEach((u) =>
              pushUnassigned(u, "reportingPerson")
            );

            Promise.allSettled(tasks).catch(() => {});

            const notifyItems: NotifyInput[] = [];
            const addNotify = (
              uid: string,
              role: "assignee" | "reportingPerson",
              kind: "task_assigned" | "task_unassigned"
            ) => {
              if (uid === session.sub) return;
              if (!byId.get(uid)) return;
              notifyItems.push({
                recipient: uid,
                actor: session.sub,
                type: kind,
                project: projectMeta._id,
                task: String(updated._id),
                message:
                  kind === "task_assigned"
                    ? `${session.name} assigned you to task "${updated.title}" as ${
                        role === "assignee" ? "assignee" : "reporting"
                      }`
                    : `${session.name} removed you from task "${updated.title}" (${
                        role === "assignee" ? "assignee" : "reporting"
                      })`,
                data: {
                  role,
                  taskId: updated.taskId,
                  projectId: projectMeta.projectId,
                },
              });
            };
            addedAss.forEach((u) => addNotify(u, "assignee", "task_assigned"));
            removedAss.forEach((u) =>
              addNotify(u, "assignee", "task_unassigned")
            );
            addedRep.forEach((u) =>
              addNotify(u, "reportingPerson", "task_assigned")
            );
            removedRep.forEach((u) =>
              addNotify(u, "reportingPerson", "task_unassigned")
            );
            createNotifications(notifyItems);

            const slackChanges = [
              ...addedAss.map(
                (uid) =>
                  ({
                    userId: uid,
                    kind: "assigned",
                    role: "assignee",
                  }) as const
              ),
              ...removedAss.map(
                (uid) =>
                  ({
                    userId: uid,
                    kind: "unassigned",
                    role: "assignee",
                  }) as const
              ),
              ...addedRep.map(
                (uid) =>
                  ({
                    userId: uid,
                    kind: "assigned",
                    role: "reportingPerson",
                  }) as const
              ),
              ...removedRep.map(
                (uid) =>
                  ({
                    userId: uid,
                    kind: "unassigned",
                    role: "reportingPerson",
                  }) as const
              ),
            ];
            notifyTaskAssignmentSlack(slackChanges, {
              actorName: session.name,
              project: {
                id: projectMeta._id,
                projectId: projectMeta.projectId,
                name: projectMeta.name,
              },
              task: {
                id: String(updated._id),
                taskId: updated.taskId ?? "",
                title: updated.title,
              },
              taskUrl,
            }).catch(() => {});
          }
        }
      } catch {
        // swallow
      }

      // System activity logs: status, priority, assignee, reporting changes.
      try {
        const logs: Array<{
          body: string;
          system: {
            type:
              | "status"
              | "priority"
              | "assignee_added"
              | "assignee_removed"
              | "reporting_added"
              | "reporting_removed";
            from?: string;
            to?: string;
            userIds?: mongoose.Types.ObjectId[];
          };
        }> = [];

        if (
          parsed.data.status !== undefined &&
          parsed.data.status !== prevStatus
        ) {
          const from = TASK_STATUS_LABELS[prevStatus] ?? prevStatus;
          const to =
            TASK_STATUS_LABELS[parsed.data.status] ?? parsed.data.status;
          logs.push({
            body: `changed status from ${from} to ${to}`,
            system: { type: "status", from, to },
          });
        }
        if (
          parsed.data.priority !== undefined &&
          parsed.data.priority !== prevPriority
        ) {
          const from = TASK_PRIORITY_LABELS[prevPriority] ?? prevPriority;
          const to =
            TASK_PRIORITY_LABELS[parsed.data.priority] ?? parsed.data.priority;
          logs.push({
            body: `changed priority from ${from} to ${to}`,
            system: { type: "priority", from, to },
          });
        }

        const addedAssLog: string[] = [];
        const removedAssLog: string[] = [];
        if (parsed.data.assignees !== undefined) {
          const next = new Set(parsed.data.assignees);
          for (const u of next)
            if (!prevAssignees.has(u)) addedAssLog.push(u);
          for (const u of prevAssignees)
            if (!next.has(u)) removedAssLog.push(u);
        }
        const addedRepLog: string[] = [];
        const removedRepLog: string[] = [];
        if (parsed.data.reportingPersons !== undefined) {
          const next = new Set(parsed.data.reportingPersons);
          for (const u of next)
            if (!prevReporting.has(u)) addedRepLog.push(u);
          for (const u of prevReporting)
            if (!next.has(u)) removedRepLog.push(u);
        }

        const allLogIds = Array.from(
          new Set([
            ...addedAssLog,
            ...removedAssLog,
            ...addedRepLog,
            ...removedRepLog,
          ])
        );
        const nameById = new Map<string, string>();
        if (allLogIds.length > 0) {
          const users = await User.find({ _id: { $in: allLogIds } })
            .select("name")
            .lean();
          for (const u of users) {
            nameById.set(String(u._id), (u as { name: string }).name);
          }
        }
        const namesOf = (ids: string[]) =>
          ids.map((x) => nameById.get(x) ?? "someone").join(", ");

        if (addedAssLog.length > 0) {
          logs.push({
            body: `added ${namesOf(addedAssLog)} as assignee${
              addedAssLog.length > 1 ? "s" : ""
            }`,
            system: {
              type: "assignee_added",
              userIds: addedAssLog.map(
                (x) => new mongoose.Types.ObjectId(x)
              ),
            },
          });
        }
        if (removedAssLog.length > 0) {
          logs.push({
            body: `removed ${namesOf(removedAssLog)} from assignees`,
            system: {
              type: "assignee_removed",
              userIds: removedAssLog.map(
                (x) => new mongoose.Types.ObjectId(x)
              ),
            },
          });
        }
        if (addedRepLog.length > 0) {
          logs.push({
            body: `added ${namesOf(addedRepLog)} as reporting person${
              addedRepLog.length > 1 ? "s" : ""
            }`,
            system: {
              type: "reporting_added",
              userIds: addedRepLog.map(
                (x) => new mongoose.Types.ObjectId(x)
              ),
            },
          });
        }
        if (removedRepLog.length > 0) {
          logs.push({
            body: `removed ${namesOf(removedRepLog)} from reporting persons`,
            system: {
              type: "reporting_removed",
              userIds: removedRepLog.map(
                (x) => new mongoose.Types.ObjectId(x)
              ),
            },
          });
        }

        if (logs.length > 0) {
          await Comment.insertMany(
            logs.map((l) => ({
              task: new mongoose.Types.ObjectId(id),
              author: new mongoose.Types.ObjectId(session.sub),
              authorName: session.name,
              authorEmail: session.email,
              authorRole: session.role,
              body: l.body,
              kind: "system",
              system: l.system,
            }))
          );
        }

        // Task status change notifications to stakeholders
        if (
          parsed.data.status !== undefined &&
          parsed.data.status !== prevStatus
        ) {
          const from = TASK_STATUS_LABELS[prevStatus] ?? prevStatus;
          const to =
            TASK_STATUS_LABELS[parsed.data.status] ?? parsed.data.status;
          const taskTitle = updated.title;
          const proj = updated.project as unknown as {
            _id: unknown;
            projectId: string;
          } | null;

          const stakeholderIds = new Set<string>();
          (updated.assignees ?? []).forEach((a) =>
            stakeholderIds.add(String((a as unknown as { _id: unknown })._id ?? a))
          );
          (updated.reportingPersons ?? []).forEach((a) =>
            stakeholderIds.add(String((a as unknown as { _id: unknown })._id ?? a))
          );
          if (updated.createdBy) {
            stakeholderIds.add(
              String(
                (updated.createdBy as unknown as { _id: unknown })._id ??
                  updated.createdBy
              )
            );
          }
          const slackStakeholderIds = Array.from(stakeholderIds);
          stakeholderIds.delete(session.sub);

          const statusNotify: NotifyInput[] = Array.from(stakeholderIds).map(
            (uid) => ({
              recipient: uid,
              actor: session.sub,
              type: "task_status_changed",
              project: proj ? String(proj._id) : null,
              task: String(updated._id),
              message: `${session.name} changed status of "${taskTitle}" from ${from} to ${to}`,
              data: {
                from,
                to,
                taskId: updated.taskId,
                projectId: proj?.projectId,
              },
            })
          );
          createNotifications(statusNotify);

          if (proj) {
            const taskUrl = `${getAppUrl()}/dashboard/projects/${String(
              proj._id
            )}?task=${String(updated._id)}`;
            notifyTaskStatusChangeSlack(slackStakeholderIds, {
              actorName: session.name,
              project: {
                id: String(proj._id),
                projectId: proj.projectId,
                name: (proj as unknown as { name: string }).name ?? "",
              },
              task: {
                id: String(updated._id),
                taskId: updated.taskId ?? "",
                title: taskTitle,
              },
              from,
              to,
              taskUrl,
            }).catch(() => {});
          }
        }
      } catch {
        // swallow — logging failure shouldn't break update
      }

      // Description mentions — DM newly-mentioned users
      try {
        if (parsed.data.description !== undefined) {
          const prevDescription = (access.task.description as string) ?? "";
          const nextDescription =
            (update.description as string | undefined) ?? "";
          const prevMentions = new Set(extractMentionIds(prevDescription));
          const nextMentionsArr = extractMentionIds(nextDescription).filter(
            (mid) => mongoose.Types.ObjectId.isValid(mid)
          );
          const addedMentions = nextMentionsArr.filter(
            (mid) => !prevMentions.has(mid)
          );
          if (addedMentions.length > 0) {
            const project = access.project;
            const allowed = new Set<string>([
              ...(project.assignees ?? []).map((a) => String(a)),
              ...(access.task.assignees ?? []).map((a) => String(a)),
              ...(access.task.reportingPersons ?? []).map((a) => String(a)),
            ]);
            for (const r of project.reportingTo ?? [])
              allowed.add(String(r));
            if (project.createdBy) allowed.add(String(project.createdBy));
            if (access.task.createdBy)
              allowed.add(String(access.task.createdBy));
            allowed.add(session.sub);

            const recipientIds = addedMentions.filter((x) => allowed.has(x));
            if (recipientIds.length > 0) {
              const proj = updated.project as unknown as {
                _id: unknown;
                name: string;
                projectId: string;
              } | null;
              const snippet = stripHtml(nextDescription).slice(0, 140);

              const inAppNotifyItems: NotifyInput[] = recipientIds
                .filter((uid) => uid !== session.sub)
                .map((uid) => ({
                  recipient: uid,
                  actor: session.sub,
                  type: "mention_task",
                  project: proj ? String(proj._id) : null,
                  task: String(updated._id),
                  message: `${session.name} mentioned you in task "${updated.title}"`,
                  data: {
                    snippet,
                    taskId: updated.taskId,
                    projectId: proj?.projectId,
                  },
                }));
              if (inAppNotifyItems.length > 0)
                createNotifications(inAppNotifyItems);

              if (proj) {
                const taskUrl = `${getAppUrl()}/dashboard/projects/${String(
                  proj._id
                )}?task=${String(updated._id)}`;
                notifyMentionSlack(recipientIds, {
                  actorName: session.name,
                  project: {
                    id: String(proj._id),
                    projectId: proj.projectId,
                    name: proj.name ?? "",
                  },
                  task: {
                    id: String(updated._id),
                    taskId: updated.taskId ?? "",
                    title: updated.title,
                  },
                  snippet,
                  url: taskUrl,
                }).catch(() => {});
              }
            }
          }
        }
      } catch {
        // swallow description mention errors
      }

      // Subtask mention email
      try {
        const sm = parsed.data.subtaskMention;
        if (sm && sm.mentionIds.length > 0) {
          const ids = sm.mentionIds.filter(
            (x) => isValidId(x) && x !== session.sub
          );
          if (ids.length > 0) {
            const project = access.project;
            const allowed = new Set<string>([
              ...(project.assignees ?? []).map((a) => String(a)),
              ...(access.task.assignees ?? []).map((a) => String(a)),
              ...(access.task.reportingPersons ?? []).map((a) => String(a)),
            ]);
            for (const r of project.reportingTo ?? [])
              allowed.add(String(r));
            if (project.createdBy) allowed.add(String(project.createdBy));
            if (access.task.createdBy)
              allowed.add(String(access.task.createdBy));
            const recipientIds = ids.filter((x) => allowed.has(x));
            if (recipientIds.length > 0) {
              const users = await User.find({ _id: { $in: recipientIds } })
                .select("name email")
                .lean();

              const notifyItems: NotifyInput[] = users.map((u) => ({
                recipient: String(u._id),
                actor: session.sub,
                type: "mention_subtask",
                project: String(project._id),
                task: String(access.task._id),
                message: `${session.name} mentioned you in subtask "${sm.title}"`,
                data: {
                  subtaskTitle: sm.title,
                  projectId: project.projectId,
                },
              }));
              createNotifications(notifyItems);
            }
          }
        }
      } catch {
        // swallow subtask mention email errors
      }
    }

    return NextResponse.json({ task: updated });
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

  const { id } = await params;
  try {
    const access = await loadTaskWithAccess(id, session);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { task } = access;
    const isCreator = String(task.createdBy) === session.sub;
    if (!isCreator && !canManageProject(session)) {
      return NextResponse.json(
        { error: "Only the task creator, admins, or project managers can delete" },
        { status: 403 }
      );
    }

    await Task.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

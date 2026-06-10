import { Types } from "mongoose";
import User from "@/models/User";
import {
  isSlackConfigured,
  lookupSlackUserByEmail,
  sendSlackDM,
  SlackError400,
} from "@/lib/slack";

type AssignmentChange = {
  userId: string;
  kind: "assigned" | "unassigned";
  role: "assignee" | "reportingTo";
};

type TaskAssignmentChange = {
  userId: string;
  kind: "assigned" | "unassigned";
  role: "assignee" | "reportingPerson";
};

type ProjectMeta = {
  id: string;
  projectId: string;
  name: string;
};

type TaskMeta = {
  id: string;
  taskId: string;
  title: string;
};

type RecipientLean = {
  _id: Types.ObjectId;
  email?: string;
  settings?: {
    slack?: {
      connected?: boolean;
      slackUserId?: string;
      notifyOnAssign?: boolean;
      notifyOnComment?: boolean;
      notifyOnStatusChange?: boolean;
    };
  };
};

const ROLE_LABEL = {
  assignee: "assignee",
  reportingTo: "reporting person",
} as const;

async function loadRecipients(
  ids: string[]
): Promise<Map<string, RecipientLean>> {
  const users = await User.find({ _id: { $in: ids } })
    .select("email settings.slack")
    .lean();
  return new Map(users.map((u) => [String(u._id), u as RecipientLean]));
}

// Returns the Slack user id for a recipient. Users who never clicked
// "Connect Slack" are auto-connected by workspace email lookup so every
// user with a workspace account receives notifications; the resolved id
// is persisted to avoid repeat lookups.
async function resolveSlackUserId(
  u: RecipientLean | undefined
): Promise<string | null> {
  if (!u) return null;
  const slack = u.settings?.slack;
  if (slack?.connected && slack.slackUserId) return slack.slackUserId;
  if (!u.email) return null;
  try {
    const slackUser = await lookupSlackUserByEmail(u.email);
    const handle =
      slackUser.profile?.display_name ||
      slackUser.profile?.real_name ||
      slackUser.real_name ||
      slackUser.name ||
      "";
    await User.updateOne(
      { _id: u._id },
      {
        $set: {
          "settings.slack.connected": true,
          "settings.slack.slackUserId": slackUser.id,
          "settings.slack.slackTeamId": slackUser.team_id ?? "",
          "settings.slack.slackHandle": handle,
          "settings.slack.connectedAt": new Date(),
        },
      }
    );
    return slackUser.id;
  } catch (err) {
    const notInWorkspace =
      err instanceof SlackError400 && err.code === "users_not_found";
    if (!notInWorkspace) {
      console.error(
        `Slack auto-connect failed for ${u.email}:`,
        err instanceof Error ? err.message : err
      );
    }
    return null;
  }
}

async function resolveSlackIds(
  byId: Map<string, RecipientLean>
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for (const [id, u] of byId) {
    out.set(id, await resolveSlackUserId(u));
  }
  return out;
}

function logSendError(err: unknown): void {
  console.error(
    "Slack DM failed:",
    err instanceof Error ? err.message : err
  );
}

function buildAssignText(
  actorName: string,
  change: AssignmentChange,
  project: ProjectMeta,
  projectUrl: string
): string {
  const role = ROLE_LABEL[change.role];
  if (change.kind === "assigned") {
    return `:bust_in_silhouette: *${actorName}* added you to project <${projectUrl}|${project.name}> (${project.projectId}) as *${role}*.`;
  }
  return `:no_entry_sign: *${actorName}* removed you from project <${projectUrl}|${project.name}> (${project.projectId}) (${role}).`;
}

export async function notifyProjectAssignmentSlack(
  changes: AssignmentChange[],
  ctx: {
    actorName: string;
    actorId: string;
    project: ProjectMeta;
    projectUrl: string;
  }
): Promise<void> {
  if (!isSlackConfigured()) return;
  const filtered = changes.filter((c) => c.userId);
  if (filtered.length === 0) return;

  const ids = Array.from(new Set(filtered.map((c) => c.userId)));
  const byId = await loadRecipients(ids);
  const slackIds = await resolveSlackIds(byId);

  const sends: Promise<unknown>[] = [];
  for (const change of filtered) {
    const u = byId.get(change.userId);
    if (u?.settings?.slack?.notifyOnAssign === false) continue;
    const slackUserId = slackIds.get(change.userId);
    if (!slackUserId) continue;

    const text = buildAssignText(
      ctx.actorName,
      change,
      ctx.project,
      ctx.projectUrl
    );
    sends.push(sendSlackDM(slackUserId, text).catch(logSendError));
  }
  await Promise.allSettled(sends);
}

function buildTaskAssignText(
  actorName: string,
  change: TaskAssignmentChange,
  project: ProjectMeta,
  task: TaskMeta,
  taskUrl: string
): string {
  const role =
    change.role === "assignee" ? "assignee" : "reporting person";
  if (change.kind === "assigned") {
    return `:bust_in_silhouette: *${actorName}* added you to task <${taskUrl}|${task.title}> (${task.taskId}) in ${project.name} as *${role}*.`;
  }
  return `:no_entry_sign: *${actorName}* removed you from task <${taskUrl}|${task.title}> (${task.taskId}) in ${project.name} (${role}).`;
}

export async function notifyTaskAssignmentSlack(
  changes: TaskAssignmentChange[],
  ctx: {
    actorName: string;
    project: ProjectMeta;
    task: TaskMeta;
    taskUrl: string;
  }
): Promise<void> {
  if (!isSlackConfigured()) return;
  const filtered = changes.filter((c) => c.userId);
  if (filtered.length === 0) return;

  const ids = Array.from(new Set(filtered.map((c) => c.userId)));
  const byId = await loadRecipients(ids);
  const slackIds = await resolveSlackIds(byId);

  const sends: Promise<unknown>[] = [];
  for (const change of filtered) {
    const u = byId.get(change.userId);
    if (u?.settings?.slack?.notifyOnAssign === false) continue;
    const slackUserId = slackIds.get(change.userId);
    if (!slackUserId) continue;
    const text = buildTaskAssignText(
      ctx.actorName,
      change,
      ctx.project,
      ctx.task,
      ctx.taskUrl
    );
    sends.push(sendSlackDM(slackUserId, text).catch(logSendError));
  }
  await Promise.allSettled(sends);
}

export async function notifyTaskStatusChangeSlack(
  recipientIds: string[],
  ctx: {
    actorName: string;
    project: ProjectMeta;
    task: TaskMeta;
    from: string;
    to: string;
    taskUrl: string;
  }
): Promise<void> {
  if (!isSlackConfigured()) return;
  const ids = Array.from(new Set(recipientIds.filter(Boolean)));
  if (ids.length === 0) return;

  const byId = await loadRecipients(ids);
  const slackIds = await resolveSlackIds(byId);

  const sends: Promise<unknown>[] = [];
  for (const uid of ids) {
    const u = byId.get(uid);
    if (u?.settings?.slack?.notifyOnStatusChange === false) continue;
    const slackUserId = slackIds.get(uid);
    if (!slackUserId) continue;
    const text = `:arrows_counterclockwise: *${ctx.actorName}* changed status of <${ctx.taskUrl}|${ctx.task.title}> (${ctx.task.taskId}) in ${ctx.project.name} from *${ctx.from}* → *${ctx.to}*.`;
    sends.push(sendSlackDM(slackUserId, text).catch(logSendError));
  }
  await Promise.allSettled(sends);
}

export async function notifyMentionSlack(
  recipientIds: string[],
  ctx: {
    actorName: string;
    project: ProjectMeta;
    task?: TaskMeta;
    snippet: string;
    url: string;
  }
): Promise<void> {
  if (!isSlackConfigured()) return;
  const ids = Array.from(new Set(recipientIds.filter(Boolean)));
  if (ids.length === 0) return;

  const byId = await loadRecipients(ids);
  const slackIds = await resolveSlackIds(byId);

  const where = ctx.task
    ? `task <${ctx.url}|${ctx.task.title}> (${ctx.task.taskId})`
    : `project <${ctx.url}|${ctx.project.name}> (${ctx.project.projectId})`;

  const snippet = ctx.snippet.trim();
  const quoted = snippet ? `\n> ${snippet.replace(/\n/g, "\n> ")}` : "";

  const sends: Promise<unknown>[] = [];
  for (const uid of ids) {
    const u = byId.get(uid);
    if (u?.settings?.slack?.notifyOnComment === false) continue;
    const slackUserId = slackIds.get(uid);
    if (!slackUserId) continue;
    const text = `:speech_balloon: *${ctx.actorName}* mentioned you in ${where}.${quoted}`;
    sends.push(sendSlackDM(slackUserId, text).catch(logSendError));
  }
  await Promise.allSettled(sends);
}

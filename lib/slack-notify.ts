import User from "@/models/User";
import { isSlackConfigured, sendSlackDM } from "@/lib/slack";

type AssignmentChange = {
  userId: string;
  kind: "assigned" | "unassigned";
  role: "assignee" | "reportingTo";
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

const ROLE_LABEL = {
  assignee: "assignee",
  reportingTo: "reporting person",
} as const;

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
  const users = await User.find({ _id: { $in: ids } })
    .select("settings.slack")
    .lean();

  const byId = new Map<string, (typeof users)[number]>(
    users.map((u) => [String(u._id), u])
  );

  const sends: Promise<unknown>[] = [];
  for (const change of filtered) {
    const u = byId.get(change.userId);
    const slack = u?.settings?.slack;
    if (!slack?.connected) continue;
    if (!slack?.notifyOnAssign) continue;
    const slackUserId = slack.slackUserId;
    if (!slackUserId) continue;

    const text = buildAssignText(
      ctx.actorName,
      change,
      ctx.project,
      ctx.projectUrl
    );
    sends.push(sendSlackDM(slackUserId, text).catch(() => {}));
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

  const users = await User.find({ _id: { $in: ids } })
    .select("settings.slack")
    .lean();
  const byId = new Map<string, (typeof users)[number]>(
    users.map((u) => [String(u._id), u])
  );

  const sends: Promise<unknown>[] = [];
  for (const uid of ids) {
    const u = byId.get(uid);
    const slack = u?.settings?.slack;
    if (!slack?.connected) continue;
    if (!slack?.notifyOnStatusChange) continue;
    const slackUserId = slack.slackUserId;
    if (!slackUserId) continue;
    const text = `:arrows_counterclockwise: *${ctx.actorName}* changed status of <${ctx.taskUrl}|${ctx.task.title}> (${ctx.task.taskId}) in ${ctx.project.name} from *${ctx.from}* → *${ctx.to}*.`;
    sends.push(sendSlackDM(slackUserId, text).catch(() => {}));
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

  const users = await User.find({ _id: { $in: ids } })
    .select("settings.slack")
    .lean();

  const byId = new Map<string, (typeof users)[number]>(
    users.map((u) => [String(u._id), u])
  );

  const where = ctx.task
    ? `task <${ctx.url}|${ctx.task.title}> (${ctx.task.taskId})`
    : `project <${ctx.url}|${ctx.project.name}> (${ctx.project.projectId})`;

  const snippet = ctx.snippet.trim();
  const quoted = snippet ? `\n> ${snippet.replace(/\n/g, "\n> ")}` : "";

  const sends: Promise<unknown>[] = [];
  for (const uid of ids) {
    const u = byId.get(uid);
    const slack = u?.settings?.slack;
    if (!slack?.connected) continue;
    if (!slack?.notifyOnComment) continue;
    const slackUserId = slack.slackUserId;
    if (!slackUserId) continue;
    const text = `:speech_balloon: *${ctx.actorName}* mentioned you in ${where}.${quoted}`;
    sends.push(sendSlackDM(slackUserId, text).catch(() => {}));
  }
  await Promise.allSettled(sends);
}

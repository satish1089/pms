type SlackResponse<T> = { ok: true } & T;
type SlackError = { ok: false; error: string };

export class SlackError400 extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
    this.name = "SlackError";
  }
}

export function getSlackBotToken(): string | null {
  const t = process.env.SLACK_BOT_TOKEN?.trim();
  return t ? t : null;
}

export function isSlackConfigured(): boolean {
  return !!getSlackBotToken();
}

async function slackCallJson<T>(
  method: string,
  body: Record<string, unknown>
): Promise<SlackResponse<T>> {
  const token = getSlackBotToken();
  if (!token) {
    throw new SlackError400(
      "not_configured",
      "Slack is not configured for this workspace"
    );
  }
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as SlackResponse<T> | SlackError;
  if (!data.ok) {
    throw new SlackError400(data.error, slackErrorMessage(data.error));
  }
  return data;
}

async function slackCallForm<T>(
  method: string,
  params: Record<string, string>
): Promise<SlackResponse<T>> {
  const token = getSlackBotToken();
  if (!token) {
    throw new SlackError400(
      "not_configured",
      "Slack is not configured for this workspace"
    );
  }
  const body = new URLSearchParams(params);
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  const data = (await res.json()) as SlackResponse<T> | SlackError;
  if (!data.ok) {
    throw new SlackError400(data.error, slackErrorMessage(data.error));
  }
  return data;
}

function slackErrorMessage(code: string): string {
  switch (code) {
    case "users_not_found":
      return "Your account email is not registered in this Slack workspace.";
    case "invalid_auth":
    case "not_authed":
      return "Workspace Slack token is invalid. Ask the admin to update SLACK_BOT_TOKEN.";
    case "missing_scope":
      return "Slack app is missing required scopes (chat:write, users:read, users:read.email).";
    case "channel_not_found":
      return "Slack channel/user not found.";
    case "not_in_channel":
      return "The bot is not a member of that channel.";
    case "invalid_arguments":
    case "invalid_arg_name":
      return "Slack rejected the request arguments. Make sure your account email is set in Slack.";
    default:
      return `Slack error: ${code}`;
  }
}

export type SlackUser = {
  id: string;
  team_id?: string;
  name?: string;
  real_name?: string;
  profile?: { display_name?: string; real_name?: string; email?: string };
};

export async function lookupSlackUserByEmail(email: string): Promise<SlackUser> {
  const res = await slackCallForm<{ user: SlackUser }>(
    "users.lookupByEmail",
    { email }
  );
  return res.user;
}

export async function sendSlackDM(
  slackUserId: string,
  text: string
): Promise<void> {
  await slackCallJson<{ ts: string; channel: string }>("chat.postMessage", {
    channel: slackUserId,
    text,
  });
}

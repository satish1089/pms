export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { getSession } from "@/lib/auth";
import { validationResponse } from "@/lib/api-errors";
import {
  isSlackConfigured,
  lookupSlackUserByEmail,
  SlackError400,
} from "@/lib/slack";

const updateSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  slack: z
    .object({
      notifyOnAssign: z.boolean().optional(),
      notifyOnComment: z.boolean().optional(),
      notifyOnStatusChange: z.boolean().optional(),
    })
    .optional(),
});

type SafeSettings = {
  theme: "light" | "dark" | "system";
  slack: {
    workspaceConfigured: boolean;
    connected: boolean;
    slackHandle: string;
    notifyOnAssign: boolean;
    notifyOnComment: boolean;
    notifyOnStatusChange: boolean;
    connectedAt: string | null;
  };
};

type RawSettings = {
  theme?: string;
  slack?: {
    connected?: boolean;
    slackUserId?: string;
    slackTeamId?: string;
    slackHandle?: string;
    notifyOnAssign?: boolean;
    notifyOnComment?: boolean;
    notifyOnStatusChange?: boolean;
    connectedAt?: Date | string | null;
  } | null;
} | null | undefined;

function safeSettings(u: { settings?: RawSettings }): SafeSettings {
  const s = u.settings ?? undefined;
  const slack = s?.slack ?? undefined;
  return {
    theme: (s?.theme as SafeSettings["theme"]) ?? "system",
    slack: {
      workspaceConfigured: isSlackConfigured(),
      connected: !!slack?.connected,
      slackHandle: slack?.slackHandle ?? "",
      notifyOnAssign: slack?.notifyOnAssign ?? true,
      notifyOnComment: slack?.notifyOnComment ?? true,
      notifyOnStatusChange: slack?.notifyOnStatusChange ?? false,
      connectedAt: slack?.connectedAt
        ? new Date(slack.connectedAt).toISOString()
        : null,
    },
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const user = await User.findById(session.sub);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Auto-connect: if Slack workspace is configured but this user is not yet
    // connected, attempt an email lookup. Silent on failure so the page still
    // loads cleanly for users not in the Slack workspace.
    if (isSlackConfigured() && !user.settings?.slack?.connected) {
      try {
        const slackUser = await lookupSlackUserByEmail(session.email);
        const handle =
          slackUser.profile?.display_name ||
          slackUser.profile?.real_name ||
          slackUser.real_name ||
          slackUser.name ||
          "";
        if (!user.settings) user.set("settings", {});
        if (!user.settings!.slack) user.set("settings.slack", {});
        user.set("settings.slack.connected", true);
        user.set("settings.slack.slackUserId", slackUser.id);
        user.set("settings.slack.slackTeamId", slackUser.team_id ?? "");
        user.set("settings.slack.slackHandle", handle);
        user.set("settings.slack.connectedAt", new Date());
        user.set("settings.slack.notifyOnAssign", true);
        user.set("settings.slack.notifyOnComment", true);
        user.set("settings.slack.notifyOnStatusChange", true);
        await user.save();
      } catch (e) {
        if (!(e instanceof SlackError400)) throw e;
        // SlackError400 = user not in workspace / scope issue; ignore silently
      }
    }

    return NextResponse.json({ settings: safeSettings(user.toObject()) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    await connectDB();
    const data = parsed.data;

    const user = await User.findById(session.sub);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!user.settings) user.set("settings", {});
    if (!user.settings!.slack) user.set("settings.slack", {});

    let touched = false;
    if (data.theme) {
      user.set("settings.theme", data.theme);
      touched = true;
    }
    if (data.slack) {
      if (typeof data.slack.notifyOnAssign === "boolean") {
        user.set("settings.slack.notifyOnAssign", data.slack.notifyOnAssign);
        touched = true;
      }
      if (typeof data.slack.notifyOnComment === "boolean") {
        user.set("settings.slack.notifyOnComment", data.slack.notifyOnComment);
        touched = true;
      }
      if (typeof data.slack.notifyOnStatusChange === "boolean") {
        user.set(
          "settings.slack.notifyOnStatusChange",
          data.slack.notifyOnStatusChange
        );
        touched = true;
      }
    }
    if (touched) await user.save();

    return NextResponse.json({ settings: safeSettings(user.toObject()) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { getSession } from "@/lib/auth";
import {
  isSlackConfigured,
  lookupSlackUserByEmail,
  SlackError400,
} from "@/lib/slack";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSlackConfigured()) {
    return NextResponse.json(
      {
        error:
          "Slack is not configured for this workspace. Ask the admin to set SLACK_BOT_TOKEN.",
      },
      { status: 400 }
    );
  }
  try {
    const slackUser = await lookupSlackUserByEmail(session.email);
    const handle =
      slackUser.profile?.display_name ||
      slackUser.profile?.real_name ||
      slackUser.real_name ||
      slackUser.name ||
      "";

    await connectDB();

    const user = await User.findById(session.sub);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

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

    return NextResponse.json({
      ok: true,
      slack: {
        connected: true,
        slackHandle: handle,
        slackUserId: slackUser.id,
      },
    });
  } catch (err) {
    if (err instanceof SlackError400) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

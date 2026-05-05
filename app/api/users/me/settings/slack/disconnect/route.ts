export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { getSession } from "@/lib/auth";

export async function POST() {
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
    if (!user.settings) user.set("settings", {});
    if (!user.settings!.slack) user.set("settings.slack", {});
    user.set("settings.slack.connected", false);
    user.set("settings.slack.slackUserId", "");
    user.set("settings.slack.slackTeamId", "");
    user.set("settings.slack.slackHandle", "");
    user.set("settings.slack.connectedAt", null);
    await user.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

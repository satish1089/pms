export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { getSession } from "@/lib/auth";
import { isSlackConfigured, sendSlackDM, SlackError400 } from "@/lib/slack";

const MAX_LEN = 2000;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSlackConfigured()) {
    return NextResponse.json(
      { error: "Slack is not configured for this workspace" },
      { status: 400 }
    );
  }
  try {
    let custom = "";
    try {
      const body = (await req.json()) as { text?: unknown };
      if (typeof body?.text === "string") custom = body.text.trim();
    } catch {}

    if (custom.length > MAX_LEN) {
      return NextResponse.json(
        { error: `Message too long (max ${MAX_LEN} characters)` },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findById(session.sub).lean();
    const slackUserId = user?.settings?.slack?.slackUserId;
    const connected = user?.settings?.slack?.connected;
    if (!connected || !slackUserId) {
      return NextResponse.json(
        { error: "Slack is not connected for your account" },
        { status: 400 }
      );
    }

    const text =
      custom ||
      `:white_check_mark: Test DM from Projectly — Slack is connected for ${session.name}.`;

    await sendSlackDM(slackUserId, text);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SlackError400) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

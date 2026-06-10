import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";

loadEnv({ path: ".env.local" });
loadEnv();

type SlackLookupResponse =
  | {
      ok: true;
      user: {
        id: string;
        team_id?: string;
        name?: string;
        real_name?: string;
        profile?: { display_name?: string; real_name?: string };
      };
    }
  | { ok: false; error: string };

// Connects Slack for users who never clicked "Connect Slack", by looking
// up their email in the workspace. Safe to re-run.
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI. Add it to .env.local before running.");
    process.exit(1);
  }
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error(
      "Missing SLACK_BOT_TOKEN. Add it to .env.local before running."
    );
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  if (!db) {
    console.error("No active mongoose connection database handle.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const coll = db.collection("users");
  const users = await coll
    .find(
      {
        $or: [
          { "settings.slack.connected": { $ne: true } },
          { "settings.slack.slackUserId": { $in: [null, ""] } },
        ],
      },
      { projection: { email: 1, name: 1 } }
    )
    .toArray();

  if (users.length === 0) {
    console.log("All users already connected.");
  }

  for (const u of users) {
    const res = await fetch("https://slack.com/api/users.lookupByEmail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `email=${encodeURIComponent(String(u.email))}`,
    });
    const data = (await res.json()) as SlackLookupResponse;
    if (!data.ok) {
      console.log(`${u.name} (${u.email}): skip — ${data.error}`);
      continue;
    }
    const su = data.user;
    const handle =
      su.profile?.display_name ||
      su.profile?.real_name ||
      su.real_name ||
      su.name ||
      "";
    await coll.updateOne(
      { _id: u._id },
      {
        $set: {
          "settings.slack.connected": true,
          "settings.slack.slackUserId": su.id,
          "settings.slack.slackTeamId": su.team_id ?? "",
          "settings.slack.slackHandle": handle,
          "settings.slack.connectedAt": new Date(),
          "settings.slack.notifyOnAssign": true,
          "settings.slack.notifyOnComment": true,
          "settings.slack.notifyOnStatusChange": true,
        },
      }
    );
    console.log(`${u.name} (${u.email}): connected as ${su.id}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

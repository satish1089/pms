export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Comment from "@/models/Comment";
import User from "@/models/User";
import { getSession } from "@/lib/auth";
import { getProjectForSession } from "@/lib/project-access";
import { validationResponse } from "@/lib/api-errors";
import { extractMentionIds, sanitizeRichHtml, stripHtml } from "@/lib/sanitize";
import { createNotifications, type NotifyInput } from "@/lib/notify";
import { notifyMentionSlack } from "@/lib/slack-notify";
import { getAppUrl } from "@/lib/mailer";

const createSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty"),
});

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

    const raw = await Comment.find({ project: project._id })
      .sort({ createdAt: 1 })
      .lean();

    const authorIds = Array.from(
      new Set(
        raw.map((c) => (c.author ? String(c.author) : null)).filter(Boolean)
      )
    ) as string[];
    const users = authorIds.length
      ? await User.find({ _id: { $in: authorIds } })
          .select("name email role")
          .lean()
      : [];
    const byId = new Map(users.map((u) => [String(u._id), u]));

    const comments = raw.map((c) => {
      const key = c.author ? String(c.author) : null;
      let author: unknown = key ? byId.get(key) ?? null : null;
      if (!author && key && key === session.sub) {
        author = {
          _id: session.sub,
          name: session.name,
          email: session.email,
          role: session.role,
        };
      }
      if (!author && key && (c.authorName || c.authorRole)) {
        author = {
          _id: key,
          name: c.authorName || "Unknown",
          email: c.authorEmail || "",
          role: c.authorRole || "user",
        };
      }
      return { ...c, author };
    });

    return NextResponse.json({ comments });
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

    const sanitized = sanitizeRichHtml(parsed.data.body);
    if (stripHtml(sanitized).length === 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          fieldErrors: { body: "Comment cannot be empty" },
        },
        { status: 400 }
      );
    }

    await connectDB();
    const project = await getProjectForSession(id, session);
    if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const comment = await Comment.create({
      project: project._id,
      author: new mongoose.Types.ObjectId(session.sub),
      authorName: session.name,
      authorEmail: session.email,
      authorRole: session.role,
      body: sanitized,
    });

    const rawNew = await Comment.findById(comment._id).lean();
    let authorDoc:
      | { _id: unknown; name: string; email: string; role: string }
      | null = null;
    if (rawNew?.author) {
      const u = await User.findById(rawNew.author)
        .select("name email role")
        .lean();
      if (u)
        authorDoc = {
          _id: (u as { _id: unknown })._id,
          name: (u as { name: string }).name,
          email: (u as { email: string }).email,
          role: (u as { role: string }).role,
        };
    }
    if (!authorDoc && rawNew?.author && String(rawNew.author) === session.sub) {
      authorDoc = {
        _id: session.sub,
        name: session.name,
        email: session.email,
        role: session.role,
      };
    }
    const populated = rawNew
      ? { ...rawNew, author: authorDoc ?? null }
      : null;

    try {
      const mentionIds = extractMentionIds(sanitized).filter((mid) =>
        mongoose.Types.ObjectId.isValid(mid)
      );
      if (mentionIds.length > 0) {
        const allowed = new Set<string>(
          (project.assignees ?? []).map((a) => String(a))
        );
        for (const r of project.reportingTo ?? []) allowed.add(String(r));
        if (project.createdBy) allowed.add(String(project.createdBy));
        const recipientIds = mentionIds.filter((mid) => allowed.has(mid));
        if (recipientIds.length > 0) {
          const users = await User.find({ _id: { $in: recipientIds } })
            .select("name email")
            .lean();

          const snippet = stripHtml(sanitized).slice(0, 140);
          const notifyItems: NotifyInput[] = users
            .filter((u) => String(u._id) !== session.sub)
            .map((u) => ({
              recipient: String(u._id),
              actor: session.sub,
              type: "mention_project",
              project: String(project._id),
              comment: String(comment._id),
              message: `${session.name} mentioned you in project "${project.name}"`,
              data: { snippet, projectId: project.projectId },
            }));
          if (notifyItems.length > 0) createNotifications(notifyItems);

          const projectUrl = `${getAppUrl()}/dashboard/projects/${String(project._id)}`;
          notifyMentionSlack(recipientIds, {
            actorName: session.name,
            project: {
              id: String(project._id),
              projectId: project.projectId,
              name: project.name,
            },
            snippet,
            url: projectUrl,
          }).catch(() => {});
        }
      }
    } catch {
      // swallow mention email errors
    }

    return NextResponse.json({ comment: populated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

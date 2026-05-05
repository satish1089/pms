export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { USER_ROLES } from "@/lib/roles";
import { fieldError, validationResponse } from "@/lib/api-errors";
import { getSession } from "@/lib/auth";
import { createInviteToken, INVITE_EXPIRES_HOURS } from "@/lib/invite-token";
import { getAppUrl, sendInviteEmail } from "@/lib/mailer";

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  role: z.enum(USER_ROLES).default("user"),
  status: z.enum(["active", "inactive"]).default("active"),
});

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q")?.trim() ?? "";
    const role = searchParams.get("role") ?? "all";
    const status = searchParams.get("status") ?? "all";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit") ?? "10") || 10)
    );

    const filter: Record<string, unknown> = {};
    if (role !== "all" && (USER_ROLES as readonly string[]).includes(role)) {
      filter.role = role;
    }
    if (status === "active" || status === "inactive") {
      filter.status = status;
    }
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-settings")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return NextResponse.json({
      users,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "admin" && session.role !== "project_manager") {
      return NextResponse.json(
        { error: "Only admins and project managers can invite users" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    await connectDB();

    const existing = await User.findOne({ email: parsed.data.email });
    if (existing) {
      return fieldError(
        "email",
        "A user with this email already exists",
        409
      );
    }

    // Placeholder password — user sets their own via invite link.
    const placeholder = crypto.randomBytes(24).toString("hex");
    const user = await User.create({
      ...parsed.data,
      password: placeholder,
    });

    const safeUser = user.toObject();
    delete (safeUser as { password?: string }).password;

    try {
      const token = await createInviteToken({
        sub: user._id.toString(),
        email: user.email,
        name: user.name,
      });
      const inviteUrl = `${getAppUrl()}/accept-invite?token=${encodeURIComponent(
        token
      )}`;
      await sendInviteEmail({
        to: user.email,
        name: user.name,
        inviterName: session.name,
        inviteUrl,
        expiresHours: INVITE_EXPIRES_HOURS,
      });
    } catch (mailErr) {
      const message =
        mailErr instanceof Error ? mailErr.message : "Failed to send invite";
      return NextResponse.json(
        {
          user: safeUser,
          warning: `User created, but invite email failed: ${message}`,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { user: safeUser, invited: true },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

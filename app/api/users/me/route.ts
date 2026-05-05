export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { getSession } from "@/lib/auth";
import { validationResponse } from "@/lib/api-errors";

const updateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
});

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
    const user = await User.findById(session.sub);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    user.name = parsed.data.name.trim();
    await user.save();

    return NextResponse.json({
      user: {
        _id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

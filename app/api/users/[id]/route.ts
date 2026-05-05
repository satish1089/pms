import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { USER_ROLES } from "@/lib/roles";
import { fieldError, validationResponse } from "@/lib/api-errors";

const updateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }
  try {
    await connectDB();
    const user = await User.findById(id).select("-settings").lean();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }
  try {
    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    await connectDB();

    const user = await User.findById(id).select("+password");
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (parsed.data.email && parsed.data.email !== user.email) {
      const clash = await User.findOne({ email: parsed.data.email, _id: { $ne: id } });
      if (clash) {
        return fieldError("email", "A user with this email already exists", 409);
      }
    }

    Object.assign(user, parsed.data);
    await user.save();

    const safeUser = user.toObject();
    delete (safeUser as { password?: string }).password;

    return NextResponse.json({ user: safeUser });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }
  try {
    await connectDB();
    const deleted = await User.findByIdAndDelete(id).lean();
    if (!deleted) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

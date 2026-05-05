import mongoose, { Schema, Model, InferSchemaType } from "mongoose";
import bcrypt from "bcryptjs";
import { USER_ROLES } from "@/lib/roles";

const SlackSettingsSchema = new Schema(
  {
    connected: { type: Boolean, default: false },
    slackUserId: { type: String, default: "" },
    slackTeamId: { type: String, default: "" },
    slackHandle: { type: String, default: "" },
    notifyOnAssign: { type: Boolean, default: true },
    notifyOnComment: { type: Boolean, default: true },
    notifyOnStatusChange: { type: Boolean, default: true },
    connectedAt: { type: Date, default: null },
  },
  { _id: false }
);

const UserSettingsSchema = new Schema(
  {
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system",
    },
    slack: { type: SlackSettingsSchema, default: () => ({}) },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "user",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    settings: { type: UserSettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

type UserShape = InferSchemaType<typeof UserSchema>;

UserSchema.pre<mongoose.HydratedDocument<UserShape>>("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

export type UserDoc = UserShape & { _id: mongoose.Types.ObjectId };

if (process.env.NODE_ENV !== "production" && mongoose.models.User) {
  delete mongoose.models.User;
  delete (mongoose as unknown as { modelSchemas?: Record<string, unknown> })
    .modelSchemas?.User;
}

const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ||
  mongoose.model<UserDoc>("User", UserSchema);

export default User;

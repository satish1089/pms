import mongoose, { Schema, Model, InferSchemaType } from "mongoose";

const ActiveTimerSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    startedAt: { type: Date, required: true },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export type ActiveTimerShape = InferSchemaType<typeof ActiveTimerSchema>;
export type ActiveTimerDoc = ActiveTimerShape & {
  _id: mongoose.Types.ObjectId;
};

const ActiveTimer: Model<ActiveTimerDoc> =
  (mongoose.models.ActiveTimer as Model<ActiveTimerDoc>) ||
  mongoose.model<ActiveTimerDoc>("ActiveTimer", ActiveTimerSchema);

export default ActiveTimer;

import mongoose, { Schema, Model, InferSchemaType } from "mongoose";

const TimeLogSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    manualTaskTitle: { type: String, default: "" },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    hours: { type: Number, required: true, min: 0 },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

TimeLogSchema.index({ project: 1, date: -1 });

export type TimeLogShape = InferSchemaType<typeof TimeLogSchema>;
export type TimeLogDoc = TimeLogShape & { _id: mongoose.Types.ObjectId };

if (
  process.env.NODE_ENV !== "production" &&
  mongoose.models.TimeLog
) {
  mongoose.deleteModel("TimeLog");
}

const TimeLog: Model<TimeLogDoc> =
  (mongoose.models.TimeLog as Model<TimeLogDoc>) ||
  mongoose.model<TimeLogDoc>("TimeLog", TimeLogSchema);

export default TimeLog;

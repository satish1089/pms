import mongoose, { Schema, Model, InferSchemaType } from "mongoose";

export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "qa",
  "done",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  qa: "QA",
  done: "Done",
};

export const TASK_TYPES = ["new", "bug", "production_bug"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  new: "New",
  bug: "Bug",
  production_bug: "Production Bug",
};

export {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type TaskPriority,
} from "@/lib/task-priority";
import { TASK_PRIORITIES } from "@/lib/task-priority";

const SubtaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
    completedbydeveloper: { type: String, default: "New" },
    assignee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const TaskSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    taskId: {
      type: String,
      default: null,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: "todo",
      required: true,
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: "medium",
      required: true,
    },
    assignedDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    reportingPersons: [{ type: Schema.Types.ObjectId, ref: "User" }],
    subtasks: { type: [SubtaskSchema], default: [] },
    tags: { type: [String], default: [] },
    type: {
      type: String,
      enum: TASK_TYPES,
      default: "new",
      required: true,
    },
  },
  { timestamps: true }
);

export type TaskShape = InferSchemaType<typeof TaskSchema>;
export type TaskDoc = TaskShape & { _id: mongoose.Types.ObjectId };

if (
  process.env.NODE_ENV !== "production" &&
  mongoose.models.Task
) {
  mongoose.deleteModel("Task");
}

const Task: Model<TaskDoc> =
  (mongoose.models.Task as Model<TaskDoc>) ||
  mongoose.model<TaskDoc>("Task", TaskSchema);

export default Task;

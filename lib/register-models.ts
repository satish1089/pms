import User from "@/models/User";
import Project from "@/models/Project";
import Task from "@/models/Task";
import Comment from "@/models/Comment";
import Notification from "@/models/Notification";
import TimeLog from "@/models/TimeLog";
import ActiveTimer from "@/models/ActiveTimer";

export function registerModels() {
  return { User, Project, Task, Comment, Notification, TimeLog, ActiveTimer };
}

void User;
void Project;
void Task;
void Comment;
void Notification;
void TimeLog;
void ActiveTimer;

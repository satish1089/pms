export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Project from "@/models/Project";
import Task, { TASK_STATUSES } from "@/models/Task";
import User from "@/models/User";
import TimeLog from "@/models/TimeLog";
import { getSession } from "@/lib/auth";

function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // week starts Monday
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfDayMinusN(n: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function buildHoursByDay(
  rows: { _id: string; total: number }[],
  days: number
) {
  const map = new Map(rows.map((r) => [r._id, r.total] as const));
  const out: { day: string; label: string; hours: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push({
      day: iso,
      label: d.toLocaleDateString(undefined, {
        weekday: "short",
        timeZone: "UTC",
      }),
      hours: map.get(iso) ?? 0,
    });
  }
  return out;
}

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    const role = session.role;
    const userObjectId = new mongoose.Types.ObjectId(session.sub);

    const weekStart = startOfWeek();
    const trendStart = startOfDayMinusN(6); // 7 days incl. today

    if (role === "user") {
      const projectVisibility = {
        $or: [
          { assignees: userObjectId },
          { reportingTo: userObjectId },
        ],
      };

      const [
        projectsAssigned,
        tasksTotal,
        statusAgg,
        recentProjects,
        recentTasks,
        myLogsWeekAgg,
        myLogsTotalAgg,
        recentLogs,
        myHoursByDayAgg,
      ] = await Promise.all([
        Project.countDocuments(projectVisibility),
        Task.countDocuments({ assignees: userObjectId }),
        Task.aggregate([
          { $match: { assignees: userObjectId } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Project.find(projectVisibility)
          .sort({ updatedAt: -1 })
          .limit(5)
          .select("name projectId status updatedAt")
          .lean(),
        Task.find({ assignees: userObjectId })
          .sort({ updatedAt: -1 })
          .limit(8)
          .populate({ path: "project", select: "name projectId" })
          .select("title status project updatedAt")
          .lean(),
        TimeLog.aggregate([
          { $match: { user: userObjectId, date: { $gte: weekStart } } },
          { $group: { _id: null, total: { $sum: "$hours" } } },
        ]),
        TimeLog.aggregate([
          { $match: { user: userObjectId } },
          { $group: { _id: null, total: { $sum: "$hours" } } },
        ]),
        TimeLog.find({ user: userObjectId })
          .sort({ date: -1, createdAt: -1 })
          .limit(5)
          .populate({ path: "project", select: "name projectId" })
          .populate({ path: "task", select: "title taskId" })
          .lean(),
        TimeLog.aggregate([
          { $match: { user: userObjectId, date: { $gte: trendStart } } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$date" },
              },
              total: { $sum: "$hours" },
            },
          },
        ]),
      ]);

      const statusBreakdown = Object.fromEntries(
        TASK_STATUSES.map((s) => [s, 0])
      ) as Record<string, number>;
      for (const row of statusAgg) {
        statusBreakdown[row._id as string] = row.count as number;
      }

      const doneCount = statusBreakdown.done ?? 0;
      const openCount = tasksTotal - doneCount;

      return NextResponse.json({
        role,
        counts: {
          projects: projectsAssigned,
          tasks: tasksTotal,
          tasksOpen: openCount,
          tasksDone: doneCount,
          hoursWeek: myLogsWeekAgg[0]?.total ?? 0,
          hoursTotal: myLogsTotalAgg[0]?.total ?? 0,
        },
        statusBreakdown,
        recentProjects,
        recentTasks,
        recentLogs,
        hoursByDay: buildHoursByDay(
          (myHoursByDayAgg as { _id: string; total: number }[]) ?? [],
          7
        ),
      });
    }

    const [
      projectsTotal,
      projectsActive,
      tasksTotal,
      usersTotal,
      usersActive,
      statusAgg,
      roleAgg,
      recentProjects,
      recentTasks,
      recentUsers,
      hoursWeekAgg,
      hoursTotalAgg,
      topLoggersAgg,
      hoursByDayAgg,
    ] = await Promise.all([
      Project.countDocuments({}),
      Project.countDocuments({ status: "active" }),
      Task.countDocuments({}),
      User.countDocuments({}),
      User.countDocuments({ status: "active" }),
      Task.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      Project.find({})
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate("reportingTo", "name email role")
        .select("name projectId status updatedAt reportingTo assignees")
        .lean(),
      Task.find({})
        .sort({ updatedAt: -1 })
        .limit(8)
        .populate({ path: "project", select: "name projectId" })
        .populate("assignees", "name email role")
        .select("title status project updatedAt assignees")
        .lean(),
      User.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name email role status createdAt")
        .lean(),
      TimeLog.aggregate([
        { $match: { date: { $gte: weekStart } } },
        { $group: { _id: null, total: { $sum: "$hours" } } },
      ]),
      TimeLog.aggregate([
        { $group: { _id: null, total: { $sum: "$hours" } } },
      ]),
      TimeLog.aggregate([
        { $match: { date: { $gte: weekStart } } },
        { $group: { _id: "$user", total: { $sum: "$hours" } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            _id: 0,
            userId: "$_id",
            name: "$user.name",
            email: "$user.email",
            role: "$user.role",
            total: 1,
          },
        },
      ]),
      TimeLog.aggregate([
        { $match: { date: { $gte: trendStart } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            total: { $sum: "$hours" },
          },
        },
      ]),
    ]);

    const statusBreakdown = Object.fromEntries(
      TASK_STATUSES.map((s) => [s, 0])
    ) as Record<string, number>;
    for (const row of statusAgg) {
      statusBreakdown[row._id as string] = row.count as number;
    }

    const roleBreakdown: Record<string, number> = {
      admin: 0,
      project_manager: 0,
      user: 0,
    };
    for (const row of roleAgg) {
      roleBreakdown[row._id as string] = row.count as number;
    }

    return NextResponse.json({
      role,
      counts: {
        projects: projectsTotal,
        projectsActive,
        tasks: tasksTotal,
        users: usersTotal,
        usersActive,
        hoursWeek: hoursWeekAgg[0]?.total ?? 0,
        hoursTotal: hoursTotalAgg[0]?.total ?? 0,
      },
      statusBreakdown,
      roleBreakdown,
      recentProjects,
      recentTasks,
      recentUsers,
      topLoggers: topLoggersAgg,
      hoursByDay: buildHoursByDay(
        (hoursByDayAgg as { _id: string; total: number }[]) ?? [],
        7
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";
import { withCalculatedSummaries } from "@/lib/summary-utils";

// 批量获取日期范围内的每日日志
export const GET = withAuth(async (request) => {
  try {
    const userId = request.userId!;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate 和 endDate 参数是必需的" },
        { status: 400 }
      );
    }

    // 获取日期范围内的所有日志
    const dailyLogs = await prisma.dailyLog.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: "asc" },
    });

    // 批量获取所有相关的食物条目和运动条目
    const dates = dailyLogs.map((log) => log.date);

    const [allFoodEntries, allExerciseEntries] = await Promise.all([
      prisma.foodEntry.findMany({
        where: {
          userId,
          logId: { in: dates },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.exerciseEntry.findMany({
        where: {
          userId,
          logId: { in: dates },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // 按日期分组条目
    const foodEntriesByDate = allFoodEntries.reduce((acc, entry) => {
      if (!acc[entry.logId]) acc[entry.logId] = [];
      acc[entry.logId].push(entry);
      return acc;
    }, {} as Record<string, any[]>);

    const exerciseEntriesByDate = allExerciseEntries.reduce((acc, entry) => {
      if (!acc[entry.logId]) acc[entry.logId] = [];
      acc[entry.logId].push(entry);
      return acc;
    }, {} as Record<string, any[]>);

    // 组装完整的日志数据
    const logsWithEntries = dailyLogs.map((log) => ({
      ...log,
      foodEntries: foodEntriesByDate[log.date] || [],
      exerciseEntries: exerciseEntriesByDate[log.date] || [],
    }));

    // 为所有日志动态计算summary
    const logsWithSummaries = withCalculatedSummaries(logsWithEntries);

    return NextResponse.json({ dailyLogs: logsWithSummaries });
  } catch (error) {
    console.error("Batch get daily logs error:", error);
    return NextResponse.json(
      { error: "批量获取每日日志失败" },
      { status: 500 }
    );
  }
});

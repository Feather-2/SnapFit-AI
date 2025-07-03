import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";

// 获取食物记录
export const GET = withAuth(async (request) => {
  try {
    const userId = request.userId!;
    const { searchParams } = new URL(request.url);
    const logId = searchParams.get("logId");

    if (logId) {
      // 获取特定日志的食物记录
      const foodEntries = await prisma.foodEntry.findMany({
        where: {
          logId,
          userId,
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json({ foodEntries });
    } else {
      // 获取用户所有食物记录
      const foodEntries = await prisma.foodEntry.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ foodEntries });
    }
  } catch (error) {
    console.error("Get food entries error:", error);
    return NextResponse.json({ error: "获取食物记录失败" }, { status: 500 });
  }
});

// 创建食物记录
export const POST = withAuth(async (request) => {
  try {
    const userId = request.userId!;
    const data = await request.json();

    // 验证必填字段
    const requiredFields = [
      "logId",
      "foodName",
      "consumedGrams",
      "mealType",
      "nutritionalInfoPer100g",
      "totalNutritionalInfoConsumed",
      "isEstimated",
    ];
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        return NextResponse.json(
          { error: `${field} 是必填字段` },
          { status: 400 }
        );
      }
    }

    const foodEntry = await prisma.foodEntry.create({
      data: {
        logId: data.logId,
        userId,
        foodName: data.foodName,
        consumedGrams: data.consumedGrams,
        mealType: data.mealType,
        timePeriod: data.timePeriod,
        nutritionalInfoPer100g: JSON.stringify(data.nutritionalInfoPer100g),
        totalNutritionalInfoConsumed: JSON.stringify(
          data.totalNutritionalInfoConsumed
        ),
        isEstimated: data.isEstimated,
        timestamp: data.timestamp,
      },
    });

    return NextResponse.json({ foodEntry });
  } catch (error) {
    console.error("Create food entry error:", error);
    return NextResponse.json({ error: "创建食物记录失败" }, { status: 500 });
  }
});

// 批量创建食物记录
export const PUT = withAuth(async (request) => {
  try {
    const userId = request.userId!;
    const { entries } = await request.json();

    if (!Array.isArray(entries)) {
      return NextResponse.json(
        { error: "entries 必须是数组" },
        { status: 400 }
      );
    }

    // 验证每个条目的必填字段
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const requiredFields = [
        "logId",
        "foodName",
        "consumedGrams",
        "mealType",
        "nutritionalInfoPer100g",
        "totalNutritionalInfoConsumed",
        "isEstimated",
      ];

      for (const field of requiredFields) {
        if (entry[field] === undefined || entry[field] === null) {
          return NextResponse.json(
            { error: `条目 ${i + 1}: ${field} 是必填字段` },
            { status: 400 }
          );
        }
      }
    }

    const mappedEntries = entries.map((entry: any, index: number) => {
      try {
        return {
          logId: entry.logId,
          userId,
          foodName: entry.foodName,
          consumedGrams: Number(entry.consumedGrams),
          mealType: entry.mealType,
          timePeriod: entry.timePeriod || null,
          nutritionalInfoPer100g: JSON.stringify(entry.nutritionalInfoPer100g),
          totalNutritionalInfoConsumed: JSON.stringify(
            entry.totalNutritionalInfoConsumed
          ),
          isEstimated: Boolean(entry.isEstimated),
          timestamp: entry.timestamp || null,
        };
      } catch (err) {
        throw new Error(`条目 ${index + 1} 数据格式错误`);
      }
    });

    const foodEntries = await prisma.foodEntry.createMany({
      data: mappedEntries,
    });

    return NextResponse.json({ count: foodEntries.count });
  } catch (error) {
    console.error("Batch create food entries error:", error);
    return NextResponse.json(
      {
        error: `批量创建食物记录失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`,
      },
      { status: 500 }
    );
  }
});

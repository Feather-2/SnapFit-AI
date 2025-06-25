import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const date = searchParams.get('date')

    if (!userId || !date) {
      return NextResponse.json(
        { error: 'Missing userId or date parameter' },
        { status: 400 }
      )
    }

    const dailyLog = await DatabaseService.getDailyLog(userId, date)
    
    if (!dailyLog) {
      return NextResponse.json(
        { error: 'Daily log not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(dailyLog)
  } catch (error) {
    console.error('Error fetching daily log:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, date, ...logData } = body

    if (!userId || !date) {
      return NextResponse.json(
        { error: 'Missing userId or date' },
        { status: 400 }
      )
    }

    const dailyLog = await DatabaseService.createOrUpdateDailyLog(userId, date, logData)
    
    return NextResponse.json(dailyLog)
  } catch (error) {
    console.error('Error creating/updating daily log:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, date, foodEntries, exerciseEntries, ...logData } = body

    if (!userId || !date) {
      return NextResponse.json(
        { error: 'Missing userId or date' },
        { status: 400 }
      )
    }

    // 更新日志基本信息
    const dailyLog = await DatabaseService.createOrUpdateDailyLog(userId, date, logData)

    // 添加食物记录
    if (foodEntries && foodEntries.length > 0) {
      for (const foodEntry of foodEntries) {
        await DatabaseService.addFoodEntry(dailyLog.id, foodEntry)
      }
    }

    // 添加运动记录
    if (exerciseEntries && exerciseEntries.length > 0) {
      for (const exerciseEntry of exerciseEntries) {
        await DatabaseService.addExerciseEntry(dailyLog.id, exerciseEntry)
      }
    }

    // 重新获取完整的日志数据
    const updatedLog = await DatabaseService.getDailyLog(userId, date)
    
    return NextResponse.json(updatedLog)
  } catch (error) {
    console.error('Error updating daily log:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 
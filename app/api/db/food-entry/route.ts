import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { logId, ...foodData } = body

    if (!logId) {
      return NextResponse.json(
        { error: 'Missing logId' },
        { status: 400 }
      )
    }

    const foodEntry = await DatabaseService.addFoodEntry(logId, foodData)
    
    return NextResponse.json(foodEntry)
  } catch (error: any) {
    console.error('Error adding food entry:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
} 
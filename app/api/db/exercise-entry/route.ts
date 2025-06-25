import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { logId, ...exerciseData } = body

    if (!logId) {
      return NextResponse.json(
        { error: 'Missing logId' },
        { status: 400 }
      )
    }

    const exerciseEntry = await DatabaseService.addExerciseEntry(logId, exerciseData)
    
    return NextResponse.json(exerciseEntry)
  } catch (error: any) {
    console.error('Error adding exercise entry:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
} 
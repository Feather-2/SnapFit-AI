import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      )
    }

    const history = await DatabaseService.getUserHistory(userId, startDate || undefined, endDate || undefined)
    
    return NextResponse.json(history)
  } catch (error: any) {
    console.error('Error fetching user history:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
} 
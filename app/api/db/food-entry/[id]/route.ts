import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Missing food entry ID' },
        { status: 400 }
      )
    }

    await DatabaseService.deleteFoodEntry(id)
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting food entry:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
} 
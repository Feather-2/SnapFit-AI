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
        { error: 'Missing exercise entry ID' },
        { status: 400 }
      )
    }

    await DatabaseService.deleteExerciseEntry(id)
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting exercise entry:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
} 
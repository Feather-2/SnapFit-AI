import { NextRequest, NextResponse } from 'next/server'
import { KeyManager } from '@/lib/key-manager'

export async function GET(request: NextRequest) {
  try {
    const keyManager = new KeyManager()
    const { contributors, error } = await keyManager.getThanksBoard()

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ contributors })
  } catch (error) {
    console.error('Get thanks board error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

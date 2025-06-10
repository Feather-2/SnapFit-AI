import { NextRequest, NextResponse } from 'next/server'
import { KeyManager } from '@/lib/key-manager'

// 获取使用排行榜
export async function GET(request: NextRequest) {
  try {
    const keyManager = new KeyManager()
    const result = await keyManager.getUsageLeaderboard()
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch leaderboard' },
        { status: 500 }
      )
    }

    return NextResponse.json({ keys: result.keys })
  } catch (error) {
    console.error('Error in leaderboard API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

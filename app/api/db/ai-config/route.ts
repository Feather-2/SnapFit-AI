import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      )
    }

    // 获取用户的AI配置
    const user = await DatabaseService.createOrGetUser(undefined, 'User')
    
    return NextResponse.json(user.aiConfig || {})
  } catch (error) {
    console.error('Error fetching AI config:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, ...configData } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      )
    }

    // 更新AI配置
    const updatedConfig = await DatabaseService.updateAIConfig(userId, configData)
    
    return NextResponse.json(updatedConfig)
  } catch (error) {
    console.error('Error updating AI config:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 
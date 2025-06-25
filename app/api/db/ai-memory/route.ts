import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const category = searchParams.get('category')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      )
    }

    const memories = await DatabaseService.getAIMemory(userId, category || undefined)
    
    return NextResponse.json(memories)
  } catch (error: any) {
    console.error('Error fetching AI memories:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, category, key, value, context } = body

    if (!userId || !category || !key) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, category, key' },
        { status: 400 }
      )
    }

    const memory = await DatabaseService.saveAIMemory(userId, category, key, value, context)
    
    return NextResponse.json(memory)
  } catch (error: any) {
    console.error('Error saving AI memory:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const category = searchParams.get('category')
    const key = searchParams.get('key')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      )
    }

    if (!category) {
      // 删除用户的所有记忆
      // 注意：这里需要实现一个删除所有记忆的方法
      // 暂时返回错误，提示需要实现
      return NextResponse.json(
        { error: 'Deleting all memories not implemented yet' },
        { status: 501 }
      )
    }

    if (!key) {
      // 删除某个类别下的所有记忆
      // 注意：这里也需要在DatabaseService中实现相应方法
      return NextResponse.json(
        { error: 'Deleting category memories not implemented yet' },
        { status: 501 }
      )
    }

    // 删除特定的记忆
    // 注意：需要在DatabaseService中添加删除特定记忆的方法
    return NextResponse.json(
      { error: 'Deleting specific memory not implemented yet' },
      { status: 501 }
    )
  } catch (error: any) {
    console.error('Error deleting AI memory:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
} 
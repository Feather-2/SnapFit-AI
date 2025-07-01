import { NextRequest, NextResponse } from 'next/server'
import { createUser, verifyInviteCode, generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { username, password, inviteCode } = await request.json()

    // 验证输入
    if (!username || !password || !inviteCode) {
      return NextResponse.json(
        { error: '用户名、密码和邀请码都是必填项' },
        { status: 400 }
      )
    }

    // 验证用户名格式
    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: '用户名长度必须在3-20个字符之间' },
        { status: 400 }
      )
    }

    // 验证密码强度
    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少6个字符' },
        { status: 400 }
      )
    }

    // 验证邀请码
    if (!verifyInviteCode(inviteCode)) {
      return NextResponse.json(
        { error: '邀请码无效' },
        { status: 400 }
      )
    }

    // 创建用户
    const user = await createUser(username, password)

    // 生成 token
    const token = generateToken(user.id)

    // 返回成功响应
    return NextResponse.json({
      message: '注册成功',
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt
      },
      token
    })

  } catch (error) {
    console.error('Registration error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: '注册失败，请稍后重试' },
      { status: 500 }
    )
  }
}

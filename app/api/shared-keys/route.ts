import { NextRequest, NextResponse } from 'next/server'
import { KeyManager } from '@/lib/key-manager'
import { supabaseAdmin } from '@/lib/supabase'

// 获取用户的共享Key列表
export async function GET(request: NextRequest) {
  try {
    // 从请求头获取用户信息（需要认证中间件）
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 解析JWT token获取用户ID（简化版本，实际应该验证token）
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const keyManager = new KeyManager()
    const { keys, error } = await keyManager.getUserKeys(user.id)

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    // 不返回完整的API Key，只返回部分信息用于显示
    const safeKeys = keys.map(key => ({
      ...key,
      apiKey: key.apiKey.substring(0, 8) + '...' // 只显示前8位
    }))

    return NextResponse.json({ keys: safeKeys })
  } catch (error) {
    console.error('Get shared keys error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 添加新的共享Key
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { name, baseUrl, apiKey, modelName, dailyLimit, description, tags } = body

    // 验证必填字段
    if (!name || !baseUrl || !apiKey || !modelName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 验证URL格式
    try {
      new URL(baseUrl)
    } catch {
      return NextResponse.json(
        { error: 'Invalid base URL format' },
        { status: 400 }
      )
    }

    // 验证每日限制
    if (dailyLimit && (dailyLimit < 1 || dailyLimit > 1000)) {
      return NextResponse.json(
        { error: 'Daily limit must be between 1 and 1000' },
        { status: 400 }
      )
    }

    const keyManager = new KeyManager()

    // 先测试Key是否有效
    const testResult = await keyManager.testApiKey(baseUrl, apiKey, modelName)
    if (!testResult.success) {
      return NextResponse.json(
        { error: `API Key测试失败: ${testResult.error}` },
        { status: 400 }
      )
    }

    // 添加Key
    const result = await keyManager.addSharedKey({
      userId: user.id,
      name,
      baseUrl,
      apiKey,
      modelName,
      dailyLimit: dailyLimit || 100,
      description: description || '',
      tags: tags || [],
      isActive: true,
      usageCountToday: 0,
      totalUsageCount: 0
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      id: result.id,
      message: 'API Key添加成功，感谢您的分享！'
    })
  } catch (error) {
    console.error('Add shared key error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 更新共享Key
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { id, isActive, dailyLimit } = body

    if (!id) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
    }

    // 验证Key属于当前用户
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('shared_keys')
      .select('user_id')
      .eq('id', id)
      .single()

    if (keyError || !keyData) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    if (keyData.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 更新Key
    const updateData: any = {}
    if (typeof isActive === 'boolean') {
      updateData.is_active = isActive
    }
    if (dailyLimit && dailyLimit >= 1 && dailyLimit <= 1000) {
      updateData.daily_limit = dailyLimit
    }
    updateData.updated_at = new Date().toISOString()

    const { error: updateError } = await supabaseAdmin
      .from('shared_keys')
      .update(updateData)
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Key updated successfully' })
  } catch (error) {
    console.error('Update shared key error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 删除共享Key
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('id')

    if (!keyId) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
    }

    // 验证Key属于当前用户
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('shared_keys')
      .select('user_id')
      .eq('id', keyId)
      .single()

    if (keyError || !keyData) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    if (keyData.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 删除Key
    const { error: deleteError } = await supabaseAdmin
      .from('shared_keys')
      .delete()
      .eq('id', keyId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Key deleted successfully' })
  } catch (error) {
    console.error('Delete shared key error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

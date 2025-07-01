import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'

// 密码哈希
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

// 密码验证
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

// 生成 JWT token
export function generateToken(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not defined')
  }
  
  return jwt.sign(
    { userId },
    secret,
    { expiresIn: '7d' }
  )
}

// 验证 JWT token
export function verifyToken(token: string): { userId: string } | null {
  try {
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
      throw new Error('NEXTAUTH_SECRET is not defined')
    }
    
    const decoded = jwt.verify(token, secret) as { userId: string }
    return decoded
  } catch (error) {
    return null
  }
}

// 验证邀请码
export function verifyInviteCode(code: string): boolean {
  const validCode = process.env.INVITE_CODE
  if (!validCode) {
    throw new Error('INVITE_CODE is not defined')
  }
  
  return code === validCode
}

// 创建用户
export async function createUser(username: string, password: string) {
  // 检查用户名是否已存在
  const existingUser = await prisma.user.findUnique({
    where: { username }
  })
  
  if (existingUser) {
    throw new Error('用户名已存在')
  }
  
  // 创建用户
  const hashedPassword = await hashPassword(password)
  const user = await prisma.user.create({
    data: {
      username,
      password: hashedPassword
    }
  })
  
  return user
}

// 验证用户登录
export async function authenticateUser(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username }
  })
  
  if (!user) {
    throw new Error('用户不存在')
  }
  
  const isValid = await verifyPassword(password, user.password)
  if (!isValid) {
    throw new Error('密码错误')
  }
  
  return user
}

// 获取用户信息（不包含密码）
export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      createdAt: true,
      updatedAt: true
    }
  })
  
  return user
}

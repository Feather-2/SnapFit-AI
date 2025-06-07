import NextAuth from "next-auth"
import type { NextAuthConfig, User, Account, Profile } from "next-auth"
import type { JWT } from "next-auth/jwt"

// 自定义Linux.do Provider配置
const LinuxDoProvider = {
  id: "linux-do",
  name: "Linux.do",
  type: "oauth" as const,
  authorization: {
    url: "https://connect.linux.do/oauth2/authorize",
    params: { scope: "read" },
  },
  token: "https://connect.linux.do/oauth2/token",
  userinfo: "https://connect.linux.do/api/user",
  clientId: process.env.LINUX_DO_CLIENT_ID,
  clientSecret: process.env.LINUX_DO_CLIENT_SECRET,
  profile(profile: any) {
    return {
      id: profile.id.toString(),
      name: profile.username,
      email: profile.email, // 假设API会返回email
      image: profile.avatar_url,
    }
  },
}

export const authConfig = {
  providers: [LinuxDoProvider],
  pages: {
    signIn: "/signin", // 自定义登录页面
  },
  callbacks: {
    // 这里可以添加回调函数来处理JWT、session等
    async jwt({ token, user, account }: { token: JWT; user?: User; account?: Account | null }): Promise<JWT> {
      if (account && user) {
        token.accessToken = account.access_token
        token.id = user.id
      }
      return token
    },
    async session({ session, token }: { session: any; token: JWT }): Promise<any> {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
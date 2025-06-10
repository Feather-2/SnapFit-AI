import NextAuth from "next-auth"
import type { NextAuthConfig, User, Account, Profile } from "next-auth"
import type { JWT } from "next-auth/jwt"
import { createClient } from "@supabase/supabase-js"

// 初始化Supabase客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
      email: profile.email,
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
    async signIn({ user, account, profile }) {
      if (account?.provider === "linux-do" && profile) {
        // 调试：打印完整的profile信息
        console.log("Original profile from Linux.do:", JSON.stringify(profile, null, 2));

        if (!profile.id) {
          console.error("Linux.do profile is missing 'id'. Cannot proceed with login.");
          return false;
        }

        try {
          const linuxDoId = profile.id.toString();

          // 检查用户是否已存在
          const { data: existingUser, error: findError } = await supabase
            .from("users")
            .select("id") // 只需要获取我们自己系统的id
            .eq("linux_do_id", linuxDoId)
            .single();

          if (findError && findError.code !== 'PGRST116') { // PGRST116: 'No rows found'
            console.error("Error finding user:", findError);
            return false;
          }

          const now = new Date().toISOString();

          if (existingUser) {
            // 先获取当前的login_count
            const { data: currentUser } = await supabase
              .from("users")
              .select("login_count")
              .eq("id", existingUser.id)
              .single();

            // 用户已存在，更新用户信息（包括最新的trust_level等）
            const updateData = {
              username: profile.username || profile.name,
              display_name: profile.name || profile.username,
              email: profile.email,
              avatar_url: profile.avatar_url,
              trust_level: profile.trust_level || 0,
              is_active: profile.active !== false,
              is_silenced: profile.silenced === true,
              last_login_at: now,
              login_count: (currentUser?.login_count || 0) + 1,
              updated_at: now
            };

            console.log("Updating user with data:", JSON.stringify(updateData, null, 2));

            const { error: updateError } = await supabase
              .from("users")
              .update(updateData)
              .eq("id", existingUser.id);

            if (updateError) {
              console.error("Error updating user:", updateError);
              return false;
            }

            user.id = existingUser.id;
          } else {
            // 用户不存在，创建一个新用户
            const insertData = {
              linux_do_id: linuxDoId,
              username: profile.username || profile.name,
              display_name: profile.name || profile.username,
              email: profile.email,
              avatar_url: profile.avatar_url,
              trust_level: profile.trust_level || 0,
              is_active: profile.active !== false,
              is_silenced: profile.silenced === true,
              last_login_at: now,
              login_count: 1,
              created_at: now,
              updated_at: now
            };

            console.log("Creating new user with data:", JSON.stringify(insertData, null, 2));

            const { data: newUser, error: createError } = await supabase
              .from("users")
              .insert(insertData)
              .select("id")
              .single();

            if (createError) {
              console.error("Error creating user:", createError);
              return false;
            }
            // 将新创建的用户在我们数据库中的UUID附加到user对象上
            user.id = newUser.id;
          }
          return true; // 允许登录

        } catch (err) {
          console.error("Error during Supabase user processing:", err)
          return false
        }
      }
      return true
    },
    // 这里可以添加回调函数来处理JWT、session等
    async jwt({ token, user, account }: { token: JWT; user?: User; account?: Account | null }): Promise<JWT> {
      if (account && user) {
        token.accessToken = account.access_token
        token.id = user.id
      }
      return token
    },
    async session({ session, token }: { session: any; token: JWT }): Promise<any> {
      session.accessToken = token.accessToken
      if (session.user) {
        session.user.id = token.id as string

        // 获取用户的最新信任等级信息
        try {
          const { data: userData, error } = await supabase
            .from('users')
            .select('trust_level, display_name, is_active, is_silenced')
            .eq('id', token.id as string)
            .single()

          if (!error && userData) {
            session.user.trustLevel = userData.trust_level || 0
            session.user.displayName = userData.display_name
            session.user.isActive = userData.is_active
            session.user.isSilenced = userData.is_silenced
          }
        } catch (error) {
          console.error('Error fetching user trust level:', error)
          // 如果获取失败，设置默认值
          session.user.trustLevel = 0
        }
      }
      return session
    },
  },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
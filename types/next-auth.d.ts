import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * 扩展 Session 接口，以包含自定义字段
   */
  interface Session {
    accessToken?: string;
    user: {
      id?: string;
      trustLevel?: number;
      displayName?: string;
      isActive?: boolean;
      isSilenced?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  /**
   * 扩展 JWT 接口，以包含 accessToken
   */
  interface JWT {
    accessToken?: string;
  }
}
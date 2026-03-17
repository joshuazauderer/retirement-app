import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Use edge-safe authConfig (no Prisma, no bcryptjs) for middleware
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};

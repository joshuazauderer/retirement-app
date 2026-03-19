import type { NextAuthConfig } from "next-auth";

// Edge-safe auth config — no Prisma, no bcryptjs
// Used by middleware only
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const PUBLIC_PATHS = [
        "/",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/api/auth",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/health",
      ];
      const isPublic = PUBLIC_PATHS.some(
        (path) => nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/")
      );

      if (!isPublic && !isLoggedIn) {
        const loginUrl = new URL("/login", nextUrl);
        loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
        return Response.redirect(loginUrl);
      }

      if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/signup")) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [], // Credentials provider added in auth.ts
};

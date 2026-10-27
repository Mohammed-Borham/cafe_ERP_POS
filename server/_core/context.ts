import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { eq } from "drizzle-orm";
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import { users } from "../../drizzle/schema";
import { COOKIE_NAME } from "../../shared/const";
import { getDb } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    const token = parseCookieHeader(opts.req.headers.cookie ?? "")[COOKIE_NAME];
    const secret = process.env.AUTH_SESSION_SECRET;
    if (token && secret) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
      const subject = payload.sub;
      if (subject && /^\d+$/.test(subject)) {
        const db = await getDb();
        if (db) {
          const row = await db.select({
            id: users.id, openId: users.openId, name: users.name, email: users.email,
            loginMethod: users.loginMethod, role: users.role, createdAt: users.createdAt,
            updatedAt: users.updatedAt, lastSignedIn: users.lastSignedIn,
          }).from(users).where(eq(users.id, Number(subject))).limit(1);
          user = (row[0] as User | undefined) ?? null;
        }
      }
    }
  } catch {
    // Invalid/expired sessions are treated as unauthenticated.
  }
  return { req: opts.req, res: opts.res, user };
}

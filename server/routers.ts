import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq, sql } from "drizzle-orm";
import { SignJWT } from "jose";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, router } from "./_core/trpc";
import { cafeRouter } from "./cafe";
import { getDb } from "./db";
import { cafeAccounts, cafeAudit, users } from "../drizzle/schema";

const scrypt = promisify(scryptCb);
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
async function passwordHash(password: string, salt: string): Promise<Buffer> {
  return (await scrypt(password, salt, 64)) as Buffer;
}
function requiredSessionSecret(): Uint8Array {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET must be configured with at least 32 characters");
  return new TextEncoder().encode(secret);
}

export const appRouter = router({
  cafe: cafeRouter,
  auth: router({
    login: publicProcedure.input(z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(256) })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const username = input.username.toLowerCase();
      const user = (await db.select().from(users).where(eq(users.username, username)).limit(1))[0];
      // Same generic response for unknown username, wrong password, and locked accounts.
      const invalid = () => new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
      if (!user?.passwordSalt || !user.passwordHash || (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now())) throw invalid();
      const candidate = await passwordHash(input.password, user.passwordSalt);
      const expected = Buffer.from(user.passwordHash, "hex");
      if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
        await db.update(users).set({
          failedLoginAttempts: sql`COALESCE(${users.failedLoginAttempts}, 0) + 1`,
          lockedUntil: sql`CASE WHEN COALESCE(${users.failedLoginAttempts}, 0) + 1 >= 5 THEN DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE) ELSE ${users.lockedUntil} END`,
        }).where(eq(users.id, user.id));
        throw invalid();
      }
      const loginAt = new Date();
      await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null, lastSignedIn: loginAt }).where(eq(users.id, user.id));
      await db.update(cafeAccounts).set({ lastAuditedLoginAt: loginAt, lastSeenAt: loginAt }).where(eq(cafeAccounts.userId, user.id));
      await db.insert(cafeAudit).values({ actorId: user.id, action: "sign_in", entity: "user", entityId: user.id, summary: `Signed in as ${username}`, afterData: { loginAt, auth: "password" } });
      const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setSubject(String(user.id)).setIssuedAt().setExpirationTime(Math.floor((Date.now() + SESSION_MS) / 1000)).sign(requiredSessionSecret());
      const cookie = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookie, maxAge: SESSION_MS });
      return { success: true } as const;
    }),
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;

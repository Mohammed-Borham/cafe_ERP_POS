import { afterEach, describe, expect, it, vi } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME } from "../shared/const";

afterEach(() => vi.unstubAllEnvs());

describe("backend-managed demo sessions", () => {
  it("uses a dedicated application cookie name", () => {
    expect(COOKIE_NAME).not.toBe("app_session_id");
  });

  it("uses HttpOnly, same-origin cookie settings in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getSessionCookieOptions({ protocol: "http", headers: {} } as never)).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });

  it("uses a Secure HttpOnly same-origin cookie in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getSessionCookieOptions({ protocol: "http", headers: {} } as never)).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });
});

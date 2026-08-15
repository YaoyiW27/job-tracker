import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware, config } from "../src/middleware";

const PASSWORD = "s3cret";

function request(path: string, auth?: string) {
  const headers = auth ? { authorization: auth } : undefined;
  return new NextRequest(`https://example.test${path}`, { headers });
}

function basic(user: string, password: string) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

afterEach(() => {
  delete process.env.APP_PASSWORD;
});

describe("access gate", () => {
  it("is open when APP_PASSWORD is unset (local dev)", () => {
    expect(middleware(request("/tracker")).status).not.toBe(401);
  });

  it("challenges an unauthenticated request when APP_PASSWORD is set", () => {
    process.env.APP_PASSWORD = PASSWORD;
    const res = middleware(request("/tracker"));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Basic");
  });

  it("rejects a wrong password", () => {
    process.env.APP_PASSWORD = PASSWORD;
    expect(middleware(request("/tracker", basic("me", "wrong"))).status).toBe(401);
  });

  it("accepts the right password regardless of username", () => {
    process.env.APP_PASSWORD = PASSWORD;
    expect(middleware(request("/tracker", basic("", PASSWORD))).status).not.toBe(401);
    expect(middleware(request("/tracker", basic("anyone", PASSWORD))).status).not.toBe(401);
  });

  it("rejects a malformed Authorization header instead of throwing", () => {
    process.env.APP_PASSWORD = PASSWORD;
    expect(middleware(request("/tracker", "Basic !!!not-base64!!!")).status).toBe(401);
  });
});

describe("matcher", () => {
  const matches = (path: string) =>
    config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path));

  it("guards pages and API routes", () => {
    for (const path of ["/", "/tracker", "/discover", "/dashboard", "/api/jobs", "/api/applications"]) {
      expect(matches(path), path).toBe(true);
    }
  });

  it("lets static assets and app icons through — browsers fetch favicons unauthenticated", () => {
    for (const path of ["/_next/static/chunk.js", "/_next/image", "/favicon.ico", "/icon.svg", "/apple-icon.png"]) {
      expect(matches(path), path).toBe(false);
    }
  });
});

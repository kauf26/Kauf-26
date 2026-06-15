import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import {
  draftVisibilityCondition,
  getSessionUserId,
  isProductionAuthRequired,
  requireAuthInProduction,
  userOwnsDraft,
} from "./requireAuth";
import { productDrafts } from "../../shared/schema";
import { eq, isNull, or } from "drizzle-orm";

function mockReq(user?: { id: number }): Request {
  return {
    isAuthenticated: () => Boolean(user),
    user,
  } as unknown as Request;
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("requireAuthInProduction", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("allows unauthenticated requests in development", () => {
    process.env.NODE_ENV = "development";
    const next = vi.fn();
    requireAuthInProduction(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("allows unauthenticated requests when NODE_ENV is unset", () => {
    delete process.env.NODE_ENV;
    const next = vi.fn();
    requireAuthInProduction(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 401 in production without session", () => {
    process.env.NODE_ENV = "production";
    const next = vi.fn();
    const res = mockRes();
    requireAuthInProduction(mockReq(), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows authenticated requests in production", () => {
    process.env.NODE_ENV = "production";
    const next = vi.fn();
    requireAuthInProduction(mockReq({ id: 7 }), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe("draft access helpers", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("scopes list queries to user when authenticated in dev", () => {
    const condition = draftVisibilityCondition(mockReq({ id: 3 }));
    expect(condition).toEqual(or(eq(productDrafts.userId, 3), isNull(productDrafts.userId)));
  });

  it("returns no filter for unauthenticated dev requests", () => {
    expect(draftVisibilityCondition(mockReq())).toBeUndefined();
  });

  it("requires ownership in production", () => {
    process.env.NODE_ENV = "production";
    expect(isProductionAuthRequired()).toBe(true);
    expect(userOwnsDraft(mockReq({ id: 2 }), { userId: 2 })).toBe(true);
    expect(userOwnsDraft(mockReq({ id: 2 }), { userId: 5 })).toBe(false);
    expect(getSessionUserId(mockReq({ id: 2 }))).toBe(2);
  });
});

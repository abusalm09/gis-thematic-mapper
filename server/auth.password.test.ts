import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  getUserByEmail: vi.fn(),
  getUserCount: vi.fn(),
  createUserWithPassword: vi.fn(),
  getAllUsers: vi.fn(),
  getDatasetsByUser: vi.fn(),
  getAllDatasets: vi.fn(),
  getDatasetById: vi.fn(),
  deleteDataset: vi.fn(),
  getDatasetCount: vi.fn(),
  getMapRequestsByUser: vi.fn(),
  getAllMapRequests: vi.fn(),
  createMapRequest: vi.fn(),
  updateMapRequest: vi.fn(),
  getGeneratedMapsByUser: vi.fn(),
  getAllGeneratedMaps: vi.fn(),
  getGeneratedMapById: vi.fn(),
  getGeneratedMapByRequestId: vi.fn(),
  getGeneratedMapCount: vi.fn(),
  getAutomationRulesByUser: vi.fn(),
  getAllAutomationRules: vi.fn(),
  createAutomationRule: vi.fn(),
  updateAutomationRule: vi.fn(),
  deleteAutomationRule: vi.fn(),
  getRecentActivity: vi.fn(),
  logActivity: vi.fn(),
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

// Mock sdk
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-session-token"),
  },
}));

import * as db from "./db";
import bcrypt from "bcryptjs";

function createPublicContext(): TrpcContext {
  const setCookies: Record<string, unknown>[] = [];
  return {
    user: null,
    req: {
      headers: { cookie: "" },
    } as unknown as TrpcContext["req"],
    res: {
      cookie: (_name: string, _val: string, opts: Record<string, unknown>) => {
        setCookies.push({ name: _name, value: _val, ...opts });
      },
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("auth.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return UNAUTHORIZED for unknown email", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.auth.login({ email: "unknown@example.com", password: "password123" })
    ).rejects.toThrow("Invalid email or password");
  });

  it("should return UNAUTHORIZED for wrong password", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 1,
      openId: "email:test@example.com",
      email: "test@example.com",
      passwordHash: "$2b$10$hashedpassword",
      name: "Test User",
      loginMethod: "password",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.auth.login({ email: "test@example.com", password: "wrongpassword" })
    ).rejects.toThrow("Invalid email or password");
  });

  it("should succeed with correct credentials", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 1,
      openId: "email:test@example.com",
      email: "test@example.com",
      passwordHash: "$2b$10$hashedpassword",
      name: "Test User",
      loginMethod: "password",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.auth.login({ email: "test@example.com", password: "correctpassword" });
    expect(result.success).toBe(true);
    expect(result.user.email).toBe("test@example.com");
  });
});

describe("auth.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject when user limit is reached", async () => {
    vi.mocked(db.getUserCount).mockResolvedValue(3);

    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.auth.register({ name: "New User", email: "new@example.com", password: "password123" })
    ).rejects.toThrow("Maximum user limit");
  });

  it("should reject duplicate email", async () => {
    vi.mocked(db.getUserCount).mockResolvedValue(1);
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 1,
      openId: "email:existing@example.com",
      email: "existing@example.com",
      passwordHash: "hash",
      name: "Existing",
      loginMethod: "password",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.auth.register({ name: "New", email: "existing@example.com", password: "password123" })
    ).rejects.toThrow("Email already registered");
  });

  it("should create first user as admin", async () => {
    vi.mocked(db.getUserCount).mockResolvedValue(0);
    vi.mocked(db.getUserByEmail)
      .mockResolvedValueOnce(undefined) // check existing
      .mockResolvedValueOnce({ // after creation
        id: 1,
        openId: "email:admin@example.com",
        email: "admin@example.com",
        passwordHash: "hash",
        name: "Admin",
        loginMethod: "password",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed" as never);
    vi.mocked(db.createUserWithPassword).mockResolvedValue(1);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.auth.register({ name: "Admin", email: "admin@example.com", password: "password123" });
    expect(result.success).toBe(true);
    expect(result.user.role).toBe("admin");

    // Verify createUserWithPassword was called with admin role
    expect(db.createUserWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ role: "admin" })
    );
  });
});

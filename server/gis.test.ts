import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database module
vi.mock("./db", () => ({
  getAllUsers: vi.fn().mockResolvedValue([]),
  getUserCount: vi.fn().mockResolvedValue(0),
  getDatasetsByUser: vi.fn().mockResolvedValue([]),
  getAllDatasets: vi.fn().mockResolvedValue([]),
  getDatasetById: vi.fn().mockResolvedValue(null),
  deleteDataset: vi.fn().mockResolvedValue(undefined),
  getDatasetCount: vi.fn().mockResolvedValue(0),
  getMapRequestsByUser: vi.fn().mockResolvedValue([]),
  getAllMapRequests: vi.fn().mockResolvedValue([]),
  createMapRequest: vi.fn().mockResolvedValue(1),
  updateMapRequest: vi.fn().mockResolvedValue(undefined),
  getGeneratedMapsByUser: vi.fn().mockResolvedValue([]),
  getAllGeneratedMaps: vi.fn().mockResolvedValue([]),
  getGeneratedMapById: vi.fn().mockResolvedValue(null),
  getGeneratedMapByRequestId: vi.fn().mockResolvedValue(null),
  getGeneratedMapCount: vi.fn().mockResolvedValue(0),
  getAutomationRulesByUser: vi.fn().mockResolvedValue([]),
  getAllAutomationRules: vi.fn().mockResolvedValue([]),
  createAutomationRule: vi.fn().mockResolvedValue(1),
  updateAutomationRule: vi.fn().mockResolvedValue(undefined),
  deleteAutomationRule: vi.fn().mockResolvedValue(undefined),
  getRecentActivity: vi.fn().mockResolvedValue([]),
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./gis/queue", () => ({
  processQueue: vi.fn().mockResolvedValue(undefined),
}));

function createUserCtx(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAdminCtx(): TrpcContext {
  return createUserCtx("admin");
}

describe("auth", () => {
  it("returns current user from auth.me", async () => {
    const ctx = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toMatchObject({ id: 1, email: "test@example.com" });
  });

  it("clears cookie on logout", async () => {
    const ctx = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

describe("datasets", () => {
  it("returns empty list when no datasets", async () => {
    const ctx = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.datasets.list();
    expect(result).toEqual([]);
  });

  it("throws NOT_FOUND when dataset does not exist", async () => {
    const ctx = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.datasets.get({ id: 999 })).rejects.toThrow();
  });

  it("admin can list all datasets", async () => {
    const ctx = createAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.datasets.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("mapRequests", () => {
  it("returns empty list when no map requests", async () => {
    const ctx = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mapRequests.list();
    expect(result).toEqual([]);
  });

  it("throws NOT_FOUND when creating request for non-existent dataset", async () => {
    const ctx = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.mapRequests.create({
        datasetId: 999,
        title: "Test Map",
        mapType: "choropleth",
      })
    ).rejects.toThrow();
  });
});

describe("automation", () => {
  it("returns empty list when no automation rules", async () => {
    const ctx = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.automation.list();
    expect(result).toEqual([]);
  });

  it("creates automation rule successfully", async () => {
    const ctx = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.automation.create({
      name: "Test Rule",
      scheduleType: "manual",
      mapType: "choropleth",
    });
    expect(result.success).toBe(true);
    expect(result.id).toBe(1);
  });
});

describe("admin", () => {
  it("returns stats for admin user", async () => {
    const ctx = createAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.stats();
    expect(result).toMatchObject({
      userCount: 0,
      datasetCount: 0,
      mapCount: 0,
      maxUsers: 3,
    });
  });

  it("throws FORBIDDEN for non-admin user accessing admin stats", async () => {
    const ctx = createUserCtx("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.stats()).rejects.toThrow();
  });

  it("returns user list for admin", async () => {
    const ctx = createAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.users();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns recent activity for admin", async () => {
    const ctx = createAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.recentActivity({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });
});

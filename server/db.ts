import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  datasets, Dataset, InsertDataset,
  mapRequests, MapRequest, InsertMapRequest,
  generatedMaps, GeneratedMap, InsertGeneratedMap,
  automationRules, AutomationRule, InsertAutomationRule,
  activityLog,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUserCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(users);
  return result[0]?.count ?? 0;
}

// ─── Datasets ─────────────────────────────────────────────────────────────────

export async function createDataset(data: InsertDataset): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(datasets).values(data);
  return (result[0] as unknown as { insertId: number }).insertId;
}

export async function getDatasetById(id: number): Promise<Dataset | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(datasets).where(eq(datasets.id, id)).limit(1);
  return result[0];
}

export async function getDatasetsByUser(userId: number): Promise<Dataset[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(datasets).where(eq(datasets.userId, userId)).orderBy(desc(datasets.createdAt));
}

export async function getAllDatasets(): Promise<Dataset[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(datasets).orderBy(desc(datasets.createdAt));
}

export async function updateDataset(id: number, data: Partial<InsertDataset>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(datasets).set(data).where(eq(datasets.id, id));
}

export async function deleteDataset(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(datasets).where(eq(datasets.id, id));
}

export async function getDatasetCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(datasets);
  return result[0]?.count ?? 0;
}

// ─── Map Requests ─────────────────────────────────────────────────────────────

export async function createMapRequest(data: InsertMapRequest): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mapRequests).values(data);
  return (result[0] as unknown as { insertId: number }).insertId;
}

export async function getMapRequestById(id: number): Promise<MapRequest | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(mapRequests).where(eq(mapRequests.id, id)).limit(1);
  return result[0];
}

export async function getMapRequestsByUser(userId: number): Promise<MapRequest[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mapRequests).where(eq(mapRequests.userId, userId)).orderBy(desc(mapRequests.createdAt));
}

export async function getAllMapRequests(): Promise<MapRequest[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mapRequests).orderBy(desc(mapRequests.createdAt));
}

export async function getPendingMapRequests(): Promise<MapRequest[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mapRequests)
    .where(eq(mapRequests.status, "pending"))
    .orderBy(desc(mapRequests.priority), mapRequests.createdAt);
}

export async function updateMapRequest(id: number, data: Partial<InsertMapRequest>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mapRequests).set(data).where(eq(mapRequests.id, id));
}

// ─── Generated Maps ───────────────────────────────────────────────────────────

export async function createGeneratedMap(data: InsertGeneratedMap): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(generatedMaps).values(data);
  return (result[0] as unknown as { insertId: number }).insertId;
}

export async function getGeneratedMapById(id: number): Promise<GeneratedMap | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(generatedMaps).where(eq(generatedMaps.id, id)).limit(1);
  return result[0];
}

export async function getGeneratedMapsByUser(userId: number): Promise<GeneratedMap[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedMaps).where(eq(generatedMaps.userId, userId)).orderBy(desc(generatedMaps.createdAt));
}

export async function getAllGeneratedMaps(): Promise<GeneratedMap[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedMaps).orderBy(desc(generatedMaps.createdAt));
}

export async function getGeneratedMapByRequestId(requestId: number): Promise<GeneratedMap | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(generatedMaps).where(eq(generatedMaps.requestId, requestId)).limit(1);
  return result[0];
}

export async function getGeneratedMapCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(generatedMaps);
  return result[0]?.count ?? 0;
}

// ─── Automation Rules ─────────────────────────────────────────────────────────

export async function createAutomationRule(data: InsertAutomationRule): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(automationRules).values(data);
  return (result[0] as unknown as { insertId: number }).insertId;
}

export async function getAutomationRulesByUser(userId: number): Promise<AutomationRule[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(automationRules).where(eq(automationRules.userId, userId)).orderBy(desc(automationRules.createdAt));
}

export async function getAllAutomationRules(): Promise<AutomationRule[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(automationRules).orderBy(desc(automationRules.createdAt));
}

export async function updateAutomationRule(id: number, data: Partial<InsertAutomationRule>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(automationRules).set(data).where(eq(automationRules.id, id));
}

export async function deleteAutomationRule(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(automationRules).where(eq(automationRules.id, id));
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export async function logActivity(
  action: string,
  userId?: number,
  entityType?: string,
  entityId?: number,
  details?: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(activityLog).values({ action, userId, entityType, entityId, details });
  } catch (e) {
    console.warn("Failed to log activity:", e);
  }
}

export async function getRecentActivity(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}

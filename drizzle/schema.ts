import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  bigint,
  float,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Spatial datasets uploaded by users
export const datasets = mysqlTable("datasets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
  format: mysqlEnum("format", ["SHP", "ECW", "DXF"]).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  geojsonKey: varchar("geojsonKey", { length: 512 }),
  geojsonUrl: text("geojsonUrl"),
  fileSizeBytes: bigint("fileSizeBytes", { mode: "number" }),
  featureCount: int("featureCount"),
  geometryType: varchar("geometryType", { length: 64 }),
  crs: varchar("crs", { length: 128 }),
  originalCrs: varchar("originalCrs", { length: 128 }),
  bbox: json("bbox").$type<[number, number, number, number] | null>(),
  attributes: json("attributes").$type<string[]>(),
  status: mysqlEnum("status", ["uploading", "processing", "ready", "error"]).default("uploading").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Dataset = typeof datasets.$inferSelect;
export type InsertDataset = typeof datasets.$inferInsert;

// Thematic map generation requests
export const mapRequests = mysqlTable("mapRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  datasetId: int("datasetId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  mapType: mysqlEnum("mapType", ["choropleth", "heatmap", "proportional_symbol"]).notNull(),
  attributeField: varchar("attributeField", { length: 128 }),
  classificationMethod: mysqlEnum("classificationMethod", ["equal_interval", "quantile", "natural_breaks", "standard_deviation"]).default("quantile"),
  numClasses: int("numClasses").default(5),
  colorScheme: varchar("colorScheme", { length: 64 }).default("YlOrRd"),
  colorReverse: boolean("colorReverse").default(false),
  opacity: float("opacity").default(0.8),
  strokeColor: varchar("strokeColor", { length: 32 }).default("#ffffff"),
  strokeWidth: float("strokeWidth").default(0.5),
  showLegend: boolean("showLegend").default(true),
  showLabels: boolean("showLabels").default(false),
  labelField: varchar("labelField", { length: 128 }),
  customOptions: json("customOptions").$type<Record<string, unknown>>(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  priority: int("priority").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MapRequest = typeof mapRequests.$inferSelect;
export type InsertMapRequest = typeof mapRequests.$inferInsert;

// Generated thematic maps (output)
export const generatedMaps = mysqlTable("generatedMaps", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  userId: int("userId").notNull(),
  datasetId: int("datasetId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  mapType: varchar("mapType", { length: 64 }).notNull(),
  thumbnailKey: varchar("thumbnailKey", { length: 512 }),
  thumbnailUrl: text("thumbnailUrl"),
  pngKey: varchar("pngKey", { length: 512 }),
  pngUrl: text("pngUrl"),
  pdfKey: varchar("pdfKey", { length: 512 }),
  pdfUrl: text("pdfUrl"),
  geojsonKey: varchar("geojsonKey", { length: 512 }),
  geojsonUrl: text("geojsonUrl"),
  mapConfig: json("mapConfig").$type<Record<string, unknown>>(),
  legendData: json("legendData").$type<Array<{ label: string; color: string; value?: number }>>(),
  stats: json("stats").$type<Record<string, unknown>>(),
  width: int("width").default(1200),
  height: int("height").default(800),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedMap = typeof generatedMaps.$inferSelect;
export type InsertGeneratedMap = typeof generatedMaps.$inferInsert;

// Automation rules for scheduled map generation
export const automationRules = mysqlTable("automationRules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  datasetId: int("datasetId"),
  mapType: varchar("mapType", { length: 64 }),
  scheduleType: mysqlEnum("scheduleType", ["manual", "daily", "weekly", "monthly"]).default("manual"),
  scheduleConfig: json("scheduleConfig").$type<Record<string, unknown>>(),
  isActive: boolean("isActive").default(true),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  runCount: int("runCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AutomationRule = typeof automationRules.$inferSelect;
export type InsertAutomationRule = typeof automationRules.$inferInsert;

// System activity log
export const activityLog = mysqlTable("activityLog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 128 }).notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: int("entityId"),
  details: json("details").$type<Record<string, unknown>>(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLog.$inferSelect;

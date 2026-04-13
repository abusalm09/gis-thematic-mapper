import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  jsonb,
  bigint,
  doublePrecision,
  boolean,
  integer, // Tambahan: Tipe data angka biasa
  customType
} from "drizzle-orm/pg-core";

// Custom type untuk PostGIS Geometry
const geometry = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geometry(Geometry, 4326)';
  },
});

export const roleEnum = ["user", "admin"] as const;
export const datasetFormatEnum = ["SHP", "ECW", "DXF"] as const;
export const datasetStatusEnum = ["uploading", "processing", "ready", "error"] as const;
export const mapTypeEnum = ["choropleth", "heatmap", "proportional_symbol"] as const;
export const classMethodEnum = ["equal_interval", "quantile", "natural_breaks", "standard_deviation"] as const;
export const requestStatusEnum = ["pending", "processing", "completed", "failed"] as const;
export const scheduleTypeEnum = ["manual", "daily", "weekly", "monthly"] as const;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 20 }).$type<typeof roleEnum[number]>().default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const datasets = pgTable("datasets", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(), // Perubahan: integer (bukan serial)
  name: varchar("name", { length: 255 }).notNull(),
  originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
  format: varchar("format", { length: 10 }).$type<typeof datasetFormatEnum[number]>().notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  geojsonKey: varchar("geojsonKey", { length: 512 }),
  geojsonUrl: text("geojsonUrl"),
  fileSizeBytes: bigint("fileSizeBytes", { mode: "number" }),
  featureCount: integer("featureCount"), // Perubahan: integer
  geometryType: varchar("geometryType", { length: 64 }),
  crs: varchar("crs", { length: 128 }),
  originalCrs: varchar("originalCrs", { length: 128 }),
  bbox: jsonb("bbox").$type<[number, number, number, number] | null>(),
  attributes: jsonb("attributes").$type<string[]>(),
  geom: geometry("geom"), 
  status: varchar("status", { length: 20 }).$type<typeof datasetStatusEnum[number]>().default("uploading").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const mapRequests = pgTable("mapRequests", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(), // Perubahan: integer
  datasetId: integer("datasetId").notNull(), // Perubahan: integer
  title: varchar("title", { length: 255 }).notNull(),
  mapType: varchar("mapType", { length: 50 }).$type<typeof mapTypeEnum[number]>().notNull(),
  attributeField: varchar("attributeField", { length: 128 }),
  classificationMethod: varchar("classificationMethod", { length: 50 }).$type<typeof classMethodEnum[number]>().default("quantile"),
  numClasses: integer("numClasses").default(5), // Perubahan: integer
  colorScheme: varchar("colorScheme", { length: 64 }).default("YlOrRd"),
  colorReverse: boolean("colorReverse").default(false),
  opacity: doublePrecision("opacity").default(0.8),
  strokeColor: varchar("strokeColor", { length: 32 }).default("#ffffff"),
  strokeWidth: doublePrecision("strokeWidth").default(0.5),
  showLegend: boolean("showLegend").default(true),
  showLabels: boolean("showLabels").default(false),
  labelField: varchar("labelField", { length: 128 }),
  customOptions: jsonb("customOptions").$type<Record<string, unknown>>(),
  status: varchar("status", { length: 20 }).$type<typeof requestStatusEnum[number]>().default("pending").notNull(),
  errorMessage: text("errorMessage"),
  priority: integer("priority").default(0), // Perubahan: integer
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const generatedMaps = pgTable("generatedMaps", {
  id: serial("id").primaryKey(),
  requestId: integer("requestId").notNull(), // Perubahan: integer
  userId: integer("userId").notNull(), // Perubahan: integer
  datasetId: integer("datasetId").notNull(), // Perubahan: integer
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
  mapConfig: jsonb("mapConfig").$type<Record<string, unknown>>(),
  legendData: jsonb("legendData").$type<Array<{ label: string; color: string; value?: number }>>(),
  stats: jsonb("stats").$type<Record<string, unknown>>(),
  width: integer("width").default(1200), // Perubahan: integer
  height: integer("height").default(800), // Perubahan: integer
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const automationRules = pgTable("automationRules", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(), // Perubahan: integer
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  datasetId: integer("datasetId"), // Perubahan: integer
  mapType: varchar("mapType", { length: 64 }),
  scheduleType: varchar("scheduleType", { length: 20 }).$type<typeof scheduleTypeEnum[number]>().default("manual"),
  scheduleConfig: jsonb("scheduleConfig").$type<Record<string, unknown>>(),
  isActive: boolean("isActive").default(true),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  runCount: integer("runCount").default(0), // Perubahan: integer
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const activityLog = pgTable("activityLog", {
  id: serial("id").primaryKey(),
  userId: integer("userId"), // Perubahan: integer
  action: varchar("action", { length: 128 }).notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: integer("entityId"), // Perubahan: integer
  details: jsonb("details").$type<Record<string, unknown>>(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Dataset = typeof datasets.$inferSelect;
export type InsertDataset = typeof datasets.$inferInsert;
export type MapRequest = typeof mapRequests.$inferSelect;
export type InsertMapRequest = typeof mapRequests.$inferInsert;
export type GeneratedMap = typeof generatedMaps.$inferSelect;
export type InsertGeneratedMap = typeof generatedMaps.$inferInsert;
export type AutomationRule = typeof automationRules.$inferSelect;
export type InsertAutomationRule = typeof automationRules.$inferInsert;
export type ActivityLog = typeof activityLog.$inferSelect;

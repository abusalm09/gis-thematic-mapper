import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { createUploadRouter } from "../uploadRoute";
import { startQueueProcessor } from "../gis/queue";
import mysql from "mysql2/promise";

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.log("[Migration] DATABASE_URL not set, skipping migrations");
    return;
  }
  try {
    console.log("[Migration] Running database migrations...");
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    await conn.execute(`CREATE TABLE IF NOT EXISTS \`users\` (\`id\` int AUTO_INCREMENT PRIMARY KEY, \`openId\` varchar(64) NOT NULL UNIQUE, \`name\` text, \`email\` varchar(320), \`passwordHash\` varchar(255), \`loginMethod\` varchar(64), \`role\` enum('user','admin') NOT NULL DEFAULT 'user', \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, \`lastSignedIn\` timestamp NOT NULL DEFAULT (now()))`);
    await conn.execute(`CREATE TABLE IF NOT EXISTS \`datasets\` (\`id\` int AUTO_INCREMENT PRIMARY KEY, \`userId\` int NOT NULL, \`name\` varchar(255) NOT NULL, \`originalFilename\` varchar(255) NOT NULL, \`format\` enum('SHP','ECW','DXF') NOT NULL, \`fileKey\` varchar(512) NOT NULL, \`fileUrl\` text NOT NULL, \`geojsonKey\` varchar(512), \`geojsonUrl\` text, \`fileSizeBytes\` bigint, \`featureCount\` int, \`crs\` varchar(64), \`bboxMinX\` float, \`bboxMinY\` float, \`bboxMaxX\` float, \`bboxMaxY\` float, \`attributeSchema\` json, \`processingStatus\` enum('pending','processing','ready','error') NOT NULL DEFAULT 'pending', \`processingError\` text, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP)`);
    await conn.execute(`CREATE TABLE IF NOT EXISTS \`mapRequests\` (\`id\` int AUTO_INCREMENT PRIMARY KEY, \`userId\` int NOT NULL, \`datasetId\` int NOT NULL, \`mapType\` enum('choropleth','heatmap','proportional_symbol') NOT NULL, \`attributeField\` varchar(255) NOT NULL, \`classificationMethod\` enum('equal_interval','quantile','natural_breaks','standard_deviation') NOT NULL DEFAULT 'quantile', \`numClasses\` int NOT NULL DEFAULT 5, \`colorScheme\` varchar(64) NOT NULL DEFAULT 'Blues', \`title\` varchar(255), \`description\` text, \`customOptions\` json, \`status\` enum('queued','processing','completed','failed') NOT NULL DEFAULT 'queued', \`processingError\` text, \`queuedAt\` timestamp NOT NULL DEFAULT (now()), \`startedAt\` timestamp, \`completedAt\` timestamp, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP)`);
    await conn.execute(`CREATE TABLE IF NOT EXISTS \`generatedMaps\` (\`id\` int AUTO_INCREMENT PRIMARY KEY, \`requestId\` int NOT NULL, \`userId\` int NOT NULL, \`datasetId\` int NOT NULL, \`mapType\` enum('choropleth','heatmap','proportional_symbol') NOT NULL, \`title\` varchar(255), \`description\` text, \`thumbnailKey\` varchar(512), \`thumbnailUrl\` text, \`pdfKey\` varchar(512), \`pdfUrl\` text, \`geojsonKey\` varchar(512), \`geojsonUrl\` text, \`mapConfig\` json, \`attributeField\` varchar(255), \`colorScheme\` varchar(64), \`numClasses\` int, \`classBreaks\` json, \`featureCount\` int, \`isPublic\` boolean NOT NULL DEFAULT false, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP)`);
    await conn.execute(`CREATE TABLE IF NOT EXISTS \`automationRules\` (\`id\` int AUTO_INCREMENT PRIMARY KEY, \`userId\` int NOT NULL, \`name\` varchar(255) NOT NULL, \`description\` text, \`isActive\` boolean NOT NULL DEFAULT true, \`triggerType\` enum('on_upload','scheduled','manual') NOT NULL DEFAULT 'on_upload', \`triggerConfig\` json, \`mapType\` enum('choropleth','heatmap','proportional_symbol') NOT NULL, \`attributeField\` varchar(255) NOT NULL, \`classificationMethod\` enum('equal_interval','quantile','natural_breaks','standard_deviation') NOT NULL DEFAULT 'quantile', \`numClasses\` int NOT NULL DEFAULT 5, \`colorScheme\` varchar(64) NOT NULL DEFAULT 'Blues', \`executionCount\` int NOT NULL DEFAULT 0, \`lastExecutedAt\` timestamp, \`createdAt\` timestamp NOT NULL DEFAULT (now()), \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP)`);
    await conn.execute(`CREATE TABLE IF NOT EXISTS \`activityLog\` (\`id\` int AUTO_INCREMENT PRIMARY KEY, \`action\` varchar(128) NOT NULL, \`userId\` int, \`entityType\` varchar(64), \`entityId\` int, \`details\` json, \`ipAddress\` varchar(64), \`createdAt\` timestamp NOT NULL DEFAULT (now()))`);
    // Add passwordHash column if upgrading from older schema
    try { await conn.execute('ALTER TABLE `users` ADD COLUMN `passwordHash` varchar(255)'); } catch (_) { /* already exists */ }
    await conn.end();
    console.log("[Migration] Migrations completed successfully");
  } catch (error) {
    console.error("[Migration] Migration failed:", error);
    // Don't crash the server on migration failure
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Run migrations before starting the server
  await runMigrations();

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Health check endpoint for Railway
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  // File upload route
  app.use("/api", createUploadRouter());
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Start the map generation queue processor
    startQueueProcessor(5000);
  });
}

startServer().catch(console.error);

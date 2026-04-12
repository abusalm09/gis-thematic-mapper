import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAllUsers, getUserCount,
  getDatasetsByUser, getAllDatasets, getDatasetById, deleteDataset, getDatasetCount,
  getMapRequestsByUser, getAllMapRequests, createMapRequest, updateMapRequest,
  getGeneratedMapsByUser, getAllGeneratedMaps, getGeneratedMapById, getGeneratedMapByRequestId, getGeneratedMapCount,
  getAutomationRulesByUser, getAllAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule,
  getRecentActivity, logActivity,
} from "./db";
import { processQueue } from "./gis/queue";

const MAX_USERS = 3;

// Admin guard middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Datasets ───────────────────────────────────────────────────────────────
  datasets: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") {
        return getAllDatasets();
      }
      return getDatasetsByUser(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const dataset = await getDatasetById(input.id);
        if (!dataset) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && dataset.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return dataset;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const dataset = await getDatasetById(input.id);
        if (!dataset) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && dataset.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await deleteDataset(input.id);
        await logActivity("dataset_deleted", ctx.user.id, "dataset", input.id, { name: dataset.name } as Record<string, unknown>);
        return { success: true };
      }),
  }),

  // ─── Map Requests ────────────────────────────────────────────────────────────
  mapRequests: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const requests = ctx.user.role === "admin" ? await getAllMapRequests() : await getMapRequestsByUser(ctx.user.id);
      // Attach generated map data to each request
      const withMaps = await Promise.all(requests.map(async (req) => {
        const generatedMap = await getGeneratedMapByRequestId(req.id);
        return { ...req, generatedMap: generatedMap || null };
      }));
      return withMaps;
    }),

    create: protectedProcedure
      .input(z.object({
        datasetId: z.number(),
        title: z.string().min(1).max(255),
        mapType: z.enum(["choropleth", "heatmap", "proportional_symbol"]),
        attributeField: z.string().optional(),
        classificationMethod: z.enum(["equal_interval", "quantile", "natural_breaks", "standard_deviation"]).optional(),
        numClasses: z.number().min(2).max(10).optional(),
        colorScheme: z.string().optional(),
        colorReverse: z.boolean().optional(),
        opacity: z.number().min(0).max(1).optional(),
        strokeColor: z.string().optional(),
        strokeWidth: z.number().optional(),
        showLegend: z.boolean().optional(),
        showLabels: z.boolean().optional(),
        labelField: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify dataset access
        const dataset = await getDatasetById(input.datasetId);
        if (!dataset) throw new TRPCError({ code: "NOT_FOUND", message: "Dataset not found" });
        if (ctx.user.role !== "admin" && dataset.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (dataset.status !== "ready") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Dataset is not ready for processing" });
        }

        const id = await createMapRequest({
          userId: ctx.user.id,
          datasetId: input.datasetId,
          title: input.title,
          mapType: input.mapType,
          attributeField: input.attributeField,
          classificationMethod: input.classificationMethod || "quantile",
          numClasses: input.numClasses || 5,
          colorScheme: input.colorScheme || "YlOrRd",
          colorReverse: input.colorReverse || false,
          opacity: input.opacity || 0.8,
          strokeColor: input.strokeColor || "#ffffff",
          strokeWidth: input.strokeWidth || 0.5,
          showLegend: input.showLegend !== false,
          showLabels: input.showLabels || false,
          labelField: input.labelField,
          status: "pending",
        });

        await logActivity("map_request_created", ctx.user.id, "mapRequest", id, { title: input.title } as Record<string, unknown>);

        // Trigger queue processing
        processQueue().catch(console.error);

        return { id, success: true };
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getMapRequestById } = await import("./db");
        const req = await getMapRequestById(input.id);
        if (!req) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && req.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (req.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending requests can be cancelled" });
        }
        await updateMapRequest(input.id, { status: "failed", errorMessage: "Cancelled by user" });
        return { success: true };
      }),

    getResult: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .query(async ({ ctx, input }) => {
        const map = await getGeneratedMapByRequestId(input.requestId);
        return map || null;
      }),
  }),

  // ─── Generated Maps ──────────────────────────────────────────────────────────
  maps: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") return getAllGeneratedMaps();
      return getGeneratedMapsByUser(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const map = await getGeneratedMapById(input.id);
        if (!map) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && map.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return map;
      }),
  }),

  // ─── Automation Rules ────────────────────────────────────────────────────────
  automation: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") return getAllAutomationRules();
      return getAutomationRulesByUser(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        datasetId: z.number().optional(),
        mapType: z.string().optional(),
        scheduleType: z.enum(["manual", "daily", "weekly", "monthly"]).optional(),
        scheduleConfig: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createAutomationRule({
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          datasetId: input.datasetId,
          mapType: input.mapType,
          scheduleType: input.scheduleType || "manual",
          scheduleConfig: input.scheduleConfig,
          isActive: true,
          runCount: 0,
        });
        return { id, success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        scheduleType: z.enum(["manual", "daily", "weekly", "monthly"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateAutomationRule(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteAutomationRule(input.id);
        return { success: true };
      }),
  }),

  // ─── Admin ───────────────────────────────────────────────────────────────────
  admin: router({
    stats: adminProcedure.query(async () => {
      const [userCount, datasetCount, mapCount] = await Promise.all([
        getUserCount(),
        getDatasetCount(),
        getGeneratedMapCount(),
      ]);
      return { userCount, datasetCount, mapCount, maxUsers: MAX_USERS };
    }),

    users: adminProcedure.query(async () => {
      return getAllUsers();
    }),

    allDatasets: adminProcedure.query(async () => {
      return getAllDatasets();
    }),

    allMapRequests: adminProcedure.query(async () => {
      return getAllMapRequests();
    }),

    recentActivity: adminProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return getRecentActivity(input.limit || 50);
      }),

    triggerQueue: adminProcedure.mutation(async () => {
      processQueue().catch(console.error);
      return { success: true, message: "Queue processing triggered" };
    }),
  }),

  // ─── User stats ──────────────────────────────────────────────────────────────
  userStats: protectedProcedure.query(async ({ ctx }) => {
    const [datasets, requests, maps] = await Promise.all([
      getDatasetsByUser(ctx.user.id),
      getMapRequestsByUser(ctx.user.id),
      getGeneratedMapsByUser(ctx.user.id),
    ]);
    return {
      datasetCount: datasets.length,
      requestCount: requests.length,
      mapCount: maps.length,
      pendingRequests: requests.filter(r => r.status === "pending" || r.status === "processing").length,
    };
  }),
});

export type AppRouter = typeof appRouter;

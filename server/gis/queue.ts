import {
  getPendingMapRequests,
  updateMapRequest,
  getDatasetById,
  createGeneratedMap,
  getGeneratedMapByRequestId,
  logActivity,
} from "../db";
import { generateThematicMap, saveMapToStorage } from "./mapGenerator";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { PDFDocument, rgb } from "pdf-lib";

let isProcessing = false;
let processingInterval: ReturnType<typeof setInterval> | null = null;

export async function processMapRequest(requestId: number): Promise<void> {
  await updateMapRequest(requestId, { status: "processing" });

  try {
    const request = await getPendingMapRequests().then(reqs =>
      reqs.find(r => r.id === requestId)
    );

    // Re-fetch to get current state
    const { getMapRequestById } = await import("../db");
    const req = await getMapRequestById(requestId);
    if (!req) throw new Error("Map request not found");

    const dataset = await getDatasetById(req.datasetId);
    if (!dataset) throw new Error("Dataset not found");
    if (!dataset.geojsonUrl) throw new Error("Dataset has no GeoJSON data");

    // Fetch GeoJSON
    const response = await fetch(dataset.geojsonUrl);
    if (!response.ok) throw new Error("Failed to fetch dataset GeoJSON");
    const geojson = await response.json() as GeoJSON.FeatureCollection;

    const bbox = (dataset.bbox as [number, number, number, number]) || [-180, -90, 180, 90];

    // Generate the map
    const result = await generateThematicMap(geojson, {
      title: req.title,
      mapType: req.mapType,
      attributeField: req.attributeField || undefined,
      classificationMethod: req.classificationMethod || "quantile",
      numClasses: req.numClasses || 5,
      colorScheme: req.colorScheme || "YlOrRd",
      colorReverse: req.colorReverse || false,
      opacity: req.opacity || 0.8,
      strokeColor: req.strokeColor || "#ffffff",
      strokeWidth: req.strokeWidth || 0.5,
      showLegend: req.showLegend !== false,
      showLabels: req.showLabels || false,
      labelField: req.labelField || undefined,
      width: 1200,
      height: 800,
    }, bbox);

    // Save PNG and thumbnail to storage
    const { pngKey, pngUrl, thumbnailKey, thumbnailUrl } = await saveMapToStorage(
      result, req.id, req.userId
    );

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([result.width, result.height]);
    const pngImage = await pdfDoc.embedPng(result.pngBuffer);
    page.drawImage(pngImage, { x: 0, y: 0, width: result.width, height: result.height });
    const pdfBytes = await pdfDoc.save();

    const pdfPrefix = `maps/${req.userId}/${req.id}-${nanoid(8)}`;
    const pdfResult = await storagePut(`${pdfPrefix}.pdf`, Buffer.from(pdfBytes), "application/pdf");

    // Save GeoJSON for online viewing
    const geojsonStr = JSON.stringify(geojson);
    const geojsonResult = await storagePut(
      `maps/${req.userId}/${req.id}-data.geojson`,
      Buffer.from(geojsonStr),
      "application/json"
    );

    // Create generated map record
    const mapId = await createGeneratedMap({
      requestId: req.id,
      userId: req.userId,
      datasetId: req.datasetId,
      title: req.title,
      mapType: req.mapType,
      thumbnailKey,
      thumbnailUrl,
      pngKey,
      pngUrl,
      pdfKey: pdfResult.key,
      pdfUrl: pdfResult.url,
      geojsonKey: geojsonResult.key,
      geojsonUrl: geojsonResult.url,
      mapConfig: {
        attributeField: req.attributeField,
        classificationMethod: req.classificationMethod,
        numClasses: req.numClasses,
        colorScheme: req.colorScheme,
        colorReverse: req.colorReverse,
        opacity: req.opacity,
      },
      legendData: result.legendData,
      stats: result.stats,
      width: result.width,
      height: result.height,
    });

    await updateMapRequest(requestId, { status: "completed" });
    await logActivity("map_generated", req.userId, "generatedMap", mapId, {
      title: req.title,
      mapType: req.mapType,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await updateMapRequest(requestId, { status: "failed", errorMessage });
    await logActivity("map_generation_failed", undefined, "mapRequest", requestId, { error: errorMessage });
    throw error;
  }
}

export async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pending = await getPendingMapRequests();
    if (pending.length === 0) return;

    const next = pending[0];
    console.log(`[Queue] Processing map request #${next.id}: ${next.title}`);
    await processMapRequest(next.id);
    console.log(`[Queue] Completed map request #${next.id}`);
  } catch (error) {
    console.error("[Queue] Error processing map request:", error);
  } finally {
    isProcessing = false;
  }
}

export function startQueueProcessor(intervalMs = 5000): void {
  if (processingInterval) return;
  processingInterval = setInterval(processQueue, intervalMs);
  console.log(`[Queue] Map generation queue started (interval: ${intervalMs}ms)`);
}

export function stopQueueProcessor(): void {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
    console.log("[Queue] Map generation queue stopped");
  }
}

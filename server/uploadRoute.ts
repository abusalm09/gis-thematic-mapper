import { Router, Request, Response } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";
import { createDataset, updateDataset, logActivity, getUserCount } from "./db";
import { sdk } from "./_core/sdk";
import { processSpatialFile } from "./gis/processor";

const MAX_USERS = 3;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowed = [".zip", ".shp", ".ecw", ".dxf"];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format: ${ext}. Supported: ZIP (SHP), ECW, DXF`));
    }
  },
});

export function createUploadRouter(): Router {
  const router = Router();

  router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      // Verify authentication
      const user = await sdk.authenticateRequest(req).catch(() => null);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      const originalName = file.originalname;
      const ext = originalName.toLowerCase().slice(originalName.lastIndexOf("."));
      
      // Detect format
      let format: "SHP" | "ECW" | "DXF";
      if (ext === ".zip" || ext === ".shp") {
        format = "SHP";
      } else if (ext === ".ecw") {
        format = "ECW";
      } else if (ext === ".dxf") {
        format = "DXF";
      } else {
        return res.status(400).json({ error: `Unsupported format: ${ext}` });
      }

      const datasetName = req.body.name || originalName.replace(/\.[^/.]+$/, "");
      const fileKey = `datasets/${user.id}/${nanoid()}-${originalName}`;

      // Upload raw file to S3
      const { url: fileUrl } = await storagePut(fileKey, file.buffer, file.mimetype || "application/octet-stream");

      // Create initial dataset record
      const datasetId = await createDataset({
        userId: user.id,
        name: datasetName,
        originalFilename: originalName,
        format,
        fileKey,
        fileUrl,
        fileSizeBytes: file.size,
        status: "processing",
      });

      // Process spatial data asynchronously
      processDatasetAsync(datasetId, file.buffer, format, user.id).catch(console.error);

      await logActivity("dataset_uploaded", user.id, "dataset", datasetId, {
        name: datasetName,
        format,
        size: file.size,
      } as Record<string, unknown>);

      return res.json({
        success: true,
        datasetId,
        message: "File uploaded successfully. Processing in background...",
      });

    } catch (error) {
      console.error("[Upload] Error:", error);
      const message = error instanceof Error ? error.message : "Upload failed";
      return res.status(500).json({ error: message });
    }
  });

  return router;
}

async function processDatasetAsync(
  datasetId: number,
  buffer: Buffer,
  format: "SHP" | "ECW" | "DXF",
  userId: number
): Promise<void> {
  try {
    console.log(`[Processing] Dataset #${datasetId} (${format})`);
    
    const result = await processSpatialFile(buffer, format);
    
    // Save GeoJSON to S3
    const geojsonStr = JSON.stringify(result.geojson);
    const geojsonKey = `datasets/${userId}/${datasetId}-data.geojson`;
    const { url: geojsonUrl } = await storagePut(geojsonKey, Buffer.from(geojsonStr), "application/json");
    
    await updateDataset(datasetId, {
      geojsonKey,
      geojsonUrl,
      featureCount: result.featureCount,
      geometryType: result.geometryType,
      crs: result.crs,
      originalCrs: result.originalCrs,
      bbox: result.bbox,
      attributes: result.attributes,
      status: "ready",
    });
    
    console.log(`[Processing] Dataset #${datasetId} ready: ${result.featureCount} features, CRS: ${result.originalCrs}`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Processing failed";
    console.error(`[Processing] Dataset #${datasetId} failed:`, errorMessage);
    
    await updateDataset(datasetId, {
      status: "error",
      errorMessage,
    });
  }
}

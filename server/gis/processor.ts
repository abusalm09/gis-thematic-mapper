import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import proj4 from "proj4";

export interface ProcessedGeoData {
  geojson: GeoJSON.FeatureCollection;
  crs: string;
  originalCrs: string;
  featureCount: number;
  geometryType: string;
  bbox: [number, number, number, number];
  attributes: string[];
}

// Common CRS definitions
const CRS_DEFS: Record<string, string> = {
  "EPSG:4326": "+proj=longlat +datum=WGS84 +no_defs",
  "EPSG:3857": "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs",
  "EPSG:32648": "+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs",
  "EPSG:32649": "+proj=utm +zone=49 +datum=WGS84 +units=m +no_defs",
  "EPSG:32650": "+proj=utm +zone=50 +datum=WGS84 +units=m +no_defs",
  "EPSG:23837": "+proj=utm +zone=47 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:23838": "+proj=utm +zone=48 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:23839": "+proj=utm +zone=49 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:23840": "+proj=utm +zone=50 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:23841": "+proj=utm +zone=51 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:23842": "+proj=utm +zone=52 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
};

// Register all known CRS
Object.entries(CRS_DEFS).forEach(([name, def]) => {
  proj4.defs(name, def);
});

export function detectCrsFromPrjContent(prjContent: string): string {
  const content = prjContent.trim();
  
  // WGS84 geographic
  if (content.includes("GCS_WGS_1984") || content.includes("WGS 1984") || content.includes("WGS84")) {
    if (!content.includes("UTM") && !content.includes("Transverse_Mercator")) {
      return "EPSG:4326";
    }
  }
  
  // UTM zones (common for Indonesia)
  const utmMatch = content.match(/UTM[_\s]Zone[_\s](\d+)/i) || content.match(/Zone[_\s](\d+)/i);
  if (utmMatch) {
    const zone = parseInt(utmMatch[1]);
    if (zone >= 46 && zone <= 54) {
      if (content.includes("WGS") || content.includes("WGS84")) {
        return `EPSG:326${zone}`;
      }
      // DGN95 (Indonesian datum)
      return `EPSG:238${zone - 10}`;
    }
  }
  
  // Web Mercator
  if (content.includes("Mercator") && content.includes("6378137")) {
    return "EPSG:3857";
  }
  
  return "EPSG:4326"; // Default to WGS84
}

export function reprojectCoordinate(
  coord: [number, number],
  fromCrs: string,
  toCrs: string = "EPSG:4326"
): [number, number] {
  if (fromCrs === toCrs) return coord;
  
  try {
    const result = proj4(fromCrs, toCrs, coord);
    return [result[0], result[1]];
  } catch {
    return coord;
  }
}

export function reprojectGeometry(
  geometry: GeoJSON.Geometry,
  fromCrs: string,
  toCrs: string = "EPSG:4326"
): GeoJSON.Geometry {
  if (fromCrs === toCrs) return geometry;

  const reprojectCoords = (coords: number[]): number[] => {
    if (typeof coords[0] === "number") {
      const reprojected = reprojectCoordinate([coords[0], coords[1]], fromCrs, toCrs);
      return coords.length > 2 ? [...reprojected, coords[2]] : reprojected;
    }
    return (coords as unknown as number[][]).map(reprojectCoords) as unknown as number[];
  };

  const geom = { ...geometry } as GeoJSON.Geometry;
  
  if ("coordinates" in geom) {
    (geom as GeoJSON.Point).coordinates = reprojectCoords(
      (geom as GeoJSON.Point).coordinates as number[]
    ) as GeoJSON.Position;
  }
  
  return geom;
}

export function calculateBbox(features: GeoJSON.Feature[]): [number, number, number, number] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  
  const processCoords = (coords: number[] | number[][] | number[][][] | number[][][][]) => {
    if (typeof coords[0] === "number") {
      const [lng, lat] = coords as number[];
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    } else {
      (coords as number[][]).forEach(processCoords);
    }
  };
  
  features.forEach(f => {
    if (f.geometry && "coordinates" in f.geometry) {
      processCoords((f.geometry as GeoJSON.Point).coordinates as unknown as number[]);
    }
  });
  
  return [
    isFinite(minLng) ? minLng : -180,
    isFinite(minLat) ? minLat : -90,
    isFinite(maxLng) ? maxLng : 180,
    isFinite(maxLat) ? maxLat : 90,
  ];
}

export async function processSHP(zipBuffer: Buffer): Promise<ProcessedGeoData> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shp_"));
  
  try {
    // Write zip to temp
    const zipPath = path.join(tmpDir, "upload.zip");
    fs.writeFileSync(zipPath, zipBuffer);
    
    // Extract zip
    execSync(`unzip -o "${zipPath}" -d "${tmpDir}"`, { stdio: "pipe" });
    
    // Find .shp file
    const files = fs.readdirSync(tmpDir);
    const shpFile = files.find(f => f.toLowerCase().endsWith(".shp"));
    const prjFile = files.find(f => f.toLowerCase().endsWith(".prj"));
    
    if (!shpFile) throw new Error("No .shp file found in ZIP archive");
    
    // Detect CRS from .prj
    let originalCrs = "EPSG:4326";
    if (prjFile) {
      const prjContent = fs.readFileSync(path.join(tmpDir, prjFile), "utf-8");
      originalCrs = detectCrsFromPrjContent(prjContent);
    }
    
    // Read shapefile using shapefile module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const shapefile = require("shapefile") as { open: (p: string) => Promise<{ read: () => Promise<{ done: boolean; value: GeoJSON.Feature | null }> }> };
    const source = await shapefile.open(path.join(tmpDir, shpFile));
    
    const features: GeoJSON.Feature[] = [];
    let result = await source.read();
    
    while (!result.done) {
      if (result.value) {
        // Reproject to WGS84 if needed
        if (originalCrs !== "EPSG:4326" && result.value.geometry) {
          result.value.geometry = reprojectGeometry(result.value.geometry, originalCrs);
        }
        features.push(result.value as GeoJSON.Feature);
      }
      result = await source.read();
    }
    
    if (features.length === 0) throw new Error("No features found in shapefile");
    
    const geometryType = features[0]?.geometry?.type || "Unknown";
    const attributes = Object.keys(features[0]?.properties || {});
    const bbox = calculateBbox(features);
    
    return {
      geojson: { type: "FeatureCollection", features },
      crs: "EPSG:4326",
      originalCrs,
      featureCount: features.length,
      geometryType,
      bbox,
      attributes,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function processDXF(dxfBuffer: Buffer): Promise<ProcessedGeoData> {
  const { default: DxfParser } = await import("dxf-parser");
  const parser = new DxfParser();
  
  const dxfContent = dxfBuffer.toString("utf-8");
  const dxf = parser.parseSync(dxfContent);
  
  if (!dxf) throw new Error("Failed to parse DXF file");
  
  const features: GeoJSON.Feature[] = [];
  
  // Convert DXF entities to GeoJSON features
  if (dxf.entities) {
    for (const entity of dxf.entities as unknown as Record<string, unknown>[]) {
      let geometry: GeoJSON.Geometry | null = null;
      const etype = entity.type as string;
      
      if (etype === "POINT") {
        const pos = entity.position as { x: number; y: number } | undefined;
        if (pos) {
          geometry = { type: "Point", coordinates: [pos.x, pos.y] };
        }
      } else if (etype === "LINE") {
        const verts = entity.vertices as { x: number; y: number }[] | undefined;
        if (verts && verts.length >= 2) {
          geometry = { type: "LineString", coordinates: verts.map(v => [v.x, v.y]) };
        }
      } else if (etype === "LWPOLYLINE" || etype === "POLYLINE") {
        const verts = entity.vertices as { x: number; y: number }[] | undefined;
        if (verts && verts.length >= 2) {
          const coords = verts.map(v => [v.x, v.y]);
          if (entity.shape && coords.length >= 3) {
            if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
              coords.push(coords[0]);
            }
            geometry = { type: "Polygon", coordinates: [coords] };
          } else {
            geometry = { type: "LineString", coordinates: coords };
          }
        }
      } else if (etype === "CIRCLE") {
        const center = entity.center as { x: number; y: number } | undefined;
        const radius = entity.radius as number | undefined;
        if (center && radius) {
          const circleCoords: [number, number][] = [];
          for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * 2 * Math.PI;
            circleCoords.push([center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle)]);
          }
          geometry = { type: "Polygon", coordinates: [circleCoords] };
        }
      }
      
      if (geometry) {
        features.push({
          type: "Feature",
          geometry,
          properties: {
            layer: (entity.layer as string) || "0",
            type: etype,
            handle: entity.handle as string,
            color: entity.color as number,
          },
        });
      }
    }
  }
  
  if (features.length === 0) {
    throw new Error("No spatial features found in DXF file");
  }
  
  const geometryType = features[0]?.geometry?.type || "Mixed";
  const attributes = ["layer", "type", "handle", "color"];
  const bbox = calculateBbox(features);
  
  return {
    geojson: { type: "FeatureCollection", features },
    crs: "EPSG:4326",
    originalCrs: "Local/CAD",
    featureCount: features.length,
    geometryType,
    bbox,
    attributes,
  };
}

export async function processECW(ecwBuffer: Buffer): Promise<ProcessedGeoData> {
  // ECW is a raster format - we create a GeoJSON bounding box representation
  // Full ECW processing requires GDAL native bindings which are complex to setup
  // We store the raw file and create a placeholder GeoJSON with bbox
  
  // Try to extract basic info from ECW header
  const header = ecwBuffer.slice(0, 1024);
  const headerStr = header.toString("ascii");
  
  // ECW files have a specific header signature
  const isECW = headerStr.includes("ECWP") || ecwBuffer[0] === 0x4E && ecwBuffer[1] === 0x43 && ecwBuffer[2] === 0x53;
  
  if (!isECW) {
    // Try as GeoTIFF or other raster
    console.warn("ECW file may not be valid ECW format, treating as raster");
  }
  
  // Create a placeholder feature for the raster extent
  // In production, you'd use GDAL to extract actual bounds
  const feature: GeoJSON.Feature = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [95.0, -11.0],
        [141.0, -11.0],
        [141.0, 6.0],
        [95.0, 6.0],
        [95.0, -11.0],
      ]],
    },
    properties: {
      type: "raster",
      format: "ECW",
      note: "ECW raster dataset - extent approximated",
    },
  };
  
  return {
    geojson: { type: "FeatureCollection", features: [feature] },
    crs: "EPSG:4326",
    originalCrs: "EPSG:4326",
    featureCount: 1,
    geometryType: "Raster",
    bbox: [95.0, -11.0, 141.0, 6.0],
    attributes: ["type", "format", "note"],
  };
}

export async function processSpatialFile(
  buffer: Buffer,
  format: "SHP" | "ECW" | "DXF"
): Promise<ProcessedGeoData> {
  switch (format) {
    case "SHP":
      return processSHP(buffer);
    case "DXF":
      return processDXF(buffer);
    case "ECW":
      return processECW(buffer);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

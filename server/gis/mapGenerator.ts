import chroma from "chroma-js";
import { Canvas } from "skia-canvas";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

export type MapType = "choropleth" | "heatmap" | "proportional_symbol";
export type ClassificationMethod = "equal_interval" | "quantile" | "natural_breaks" | "standard_deviation";

export interface MapGenerationConfig {
  title: string;
  mapType: MapType;
  attributeField?: string;
  classificationMethod: ClassificationMethod;
  numClasses: number;
  colorScheme: string;
  colorReverse: boolean;
  opacity: number;
  strokeColor: string;
  strokeWidth: number;
  showLegend: boolean;
  showLabels: boolean;
  labelField?: string;
  width?: number;
  height?: number;
}

export interface LegendItem {
  label: string;
  color: string;
  value?: number;
  min?: number;
  max?: number;
}

export interface MapGenerationResult {
  pngBuffer: Buffer;
  thumbnailBuffer: Buffer;
  legendData: LegendItem[];
  stats: Record<string, unknown>;
  width: number;
  height: number;
}

// Classify values using different methods
export function classifyValues(
  values: number[],
  numClasses: number,
  method: ClassificationMethod
): number[] {
  const sorted = [...values].filter(v => !isNaN(v) && isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const breaks: number[] = [min];
  
  switch (method) {
    case "equal_interval": {
      const step = (max - min) / numClasses;
      for (let i = 1; i <= numClasses; i++) {
        breaks.push(min + step * i);
      }
      break;
    }
    
    case "quantile": {
      for (let i = 1; i <= numClasses; i++) {
        const idx = Math.floor((i / numClasses) * sorted.length) - 1;
        breaks.push(sorted[Math.max(0, idx)]);
      }
      break;
    }
    
    case "natural_breaks": {
      // Jenks natural breaks - simplified implementation
      const n = Math.min(sorted.length, 1000);
      const sample = sorted.filter((_, i) => i % Math.ceil(sorted.length / n) === 0);
      
      // Initialize with equal interval
      const step = (max - min) / numClasses;
      for (let i = 1; i <= numClasses; i++) {
        breaks.push(min + step * i);
      }
      
      // Iterate to find natural breaks
      for (let iter = 0; iter < 10; iter++) {
        const newBreaks = [min];
        for (let c = 1; c <= numClasses; c++) {
          const classValues = sample.filter(v => v > breaks[c - 1] && v <= breaks[c]);
          if (classValues.length > 0) {
            const mean = classValues.reduce((a, b) => a + b, 0) / classValues.length;
            newBreaks.push(mean + (breaks[c] - mean) * 0.5);
          } else {
            newBreaks.push(breaks[c]);
          }
        }
        newBreaks[numClasses] = max;
        breaks.splice(0, breaks.length, ...newBreaks);
      }
      break;
    }
    
    case "standard_deviation": {
      const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      const stdDev = Math.sqrt(sorted.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / sorted.length);
      const halfClasses = Math.floor(numClasses / 2);
      
      for (let i = -halfClasses; i <= halfClasses; i++) {
        const breakVal = mean + i * stdDev;
        if (breakVal > min && breakVal < max) {
          breaks.push(breakVal);
        }
      }
      breaks.push(max);
      breaks.sort((a, b) => a - b);
      // Remove duplicates
      const unique = Array.from(new Set(breaks));
      breaks.splice(0, breaks.length, ...unique);
      break;
    }
  }
  
  // Ensure last break is max
  if (breaks[breaks.length - 1] !== max) breaks.push(max);
  
  return breaks;
}

export function getColorForValue(
  value: number,
  breaks: number[],
  colors: string[]
): string {
  if (breaks.length < 2 || colors.length === 0) return "#cccccc";
  
  for (let i = 1; i < breaks.length; i++) {
    if (value <= breaks[i]) {
      return colors[Math.min(i - 1, colors.length - 1)];
    }
  }
  return colors[colors.length - 1];
}

// Project geographic coordinates to canvas pixels
function geoToCanvas(
  lng: number,
  lat: number,
  bbox: [number, number, number, number],
  width: number,
  height: number,
  padding: number = 40
): [number, number] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const lngRange = maxLng - minLng || 1;
  const latRange = maxLat - minLat || 1;
  
  const x = padding + ((lng - minLng) / lngRange) * (width - padding * 2);
  const y = padding + ((maxLat - lat) / latRange) * (height - padding * 2);
  
  return [x, y];
}

function drawGeometry(
  ctx: CanvasRenderingContext2D,
  geometry: GeoJSON.Geometry,
  bbox: [number, number, number, number],
  width: number,
  height: number,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number,
  opacity: number,
  symbolSize?: number
) {
  ctx.globalAlpha = opacity;
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  
  const drawCoords = (coords: GeoJSON.Position[]) => {
    if (coords.length === 0) return;
    const [startX, startY] = geoToCanvas(coords[0][0], coords[0][1], bbox, width, height);
    ctx.moveTo(startX, startY);
    for (let i = 1; i < coords.length; i++) {
      const [x, y] = geoToCanvas(coords[i][0], coords[i][1], bbox, width, height);
      ctx.lineTo(x, y);
    }
  };
  
  switch (geometry.type) {
    case "Point": {
      const [x, y] = geoToCanvas(geometry.coordinates[0], geometry.coordinates[1], bbox, width, height);
      const r = symbolSize || 6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    
    case "LineString": {
      ctx.beginPath();
      drawCoords(geometry.coordinates as GeoJSON.Position[]);
      ctx.stroke();
      break;
    }
    
    case "Polygon": {
      ctx.beginPath();
      drawCoords(geometry.coordinates[0] as GeoJSON.Position[]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    
    case "MultiPolygon": {
      for (const polygon of geometry.coordinates) {
        ctx.beginPath();
        drawCoords(polygon[0] as GeoJSON.Position[]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    
    case "MultiPoint": {
      for (const point of geometry.coordinates) {
        const [x, y] = geoToCanvas(point[0], point[1], bbox, width, height);
        const r = symbolSize || 6;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    
    case "MultiLineString": {
      for (const line of geometry.coordinates) {
        ctx.beginPath();
        drawCoords(line as GeoJSON.Position[]);
        ctx.stroke();
      }
      break;
    }
  }
  
  ctx.globalAlpha = 1;
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  legendItems: LegendItem[],
  width: number,
  height: number,
  title: string
) {
  const legendX = width - 200;
  const legendY = 60;
  const itemHeight = 22;
  const legendWidth = 180;
  const legendHeight = legendItems.length * itemHeight + 50;
  
  // Background
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(legendX, legendY, legendWidth, legendHeight, 6);
  ctx.fill();
  ctx.stroke();
  
  // Title
  ctx.fillStyle = "#1a1a2e";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(title.substring(0, 20), legendX + 10, legendY + 18);
  
  // Items
  legendItems.forEach((item, i) => {
    const y = legendY + 35 + i * itemHeight;
    
    // Color swatch
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX + 10, y - 10, 16, 14);
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(legendX + 10, y - 10, 16, 14);
    
    // Label
    ctx.fillStyle = "#333";
    ctx.font = "10px sans-serif";
    ctx.fillText(item.label.substring(0, 22), legendX + 32, y);
  });
}

export async function generateThematicMap(
  geojson: GeoJSON.FeatureCollection,
  config: MapGenerationConfig,
  bbox: [number, number, number, number]
): Promise<MapGenerationResult> {
  const width = config.width || 1200;
  const height = config.height || 800;
  
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  
  // Background
  ctx.fillStyle = "#f0f4f8";
  ctx.fillRect(0, 0, width, height);
  
  // Map area background
  ctx.fillStyle = "#d4e6f1";
  ctx.fillRect(40, 40, width - 80, height - 80);
  
  const features = geojson.features;
  const legendItems: LegendItem[] = [];
  const stats: Record<string, unknown> = {};
  
  // Get color palette
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colorScale = chroma.scale(config.colorScheme as any || "YlOrRd").mode("lab");
  
  if (config.mapType === "choropleth" && config.attributeField) {
    // Extract numeric values
    const values = features
      .map(f => parseFloat(String(f.properties?.[config.attributeField!])))
      .filter(v => !isNaN(v));
    
    if (values.length === 0) {
      // Fallback: draw all features with default color
      features.forEach(f => {
        if (f.geometry) {
          drawGeometry(ctx, f.geometry, bbox, width, height, "#7fb3d3", config.strokeColor, config.strokeWidth, config.opacity);
        }
      });
    } else {
      const breaks = classifyValues(values, config.numClasses, config.classificationMethod);
      const numBreaks = breaks.length - 1;
      const colors = Array.from({ length: numBreaks }, (_, i) => {
        const t = numBreaks > 1 ? i / (numBreaks - 1) : 0;
        return config.colorReverse ? colorScale(1 - t).hex() : colorScale(t).hex();
      });
      
      // Build legend
      for (let i = 0; i < numBreaks; i++) {
        legendItems.push({
          label: `${breaks[i].toFixed(1)} – ${breaks[i + 1].toFixed(1)}`,
          color: colors[i],
          min: breaks[i],
          max: breaks[i + 1],
        });
      }
      
      // Draw features
      features.forEach(f => {
        if (!f.geometry) return;
        const val = parseFloat(String(f.properties?.[config.attributeField!]));
        const color = isNaN(val) ? "#cccccc" : getColorForValue(val, breaks, colors);
        drawGeometry(ctx, f.geometry, bbox, width, height, color, config.strokeColor, config.strokeWidth, config.opacity);
      });
      
      stats.min = breaks[0];
      stats.max = breaks[breaks.length - 1];
      stats.mean = values.reduce((a, b) => a + b, 0) / values.length;
      stats.count = values.length;
    }
  } else if (config.mapType === "heatmap") {
    // Simple heatmap: color by density using a grid
    const gridSize = 40;
    const gridW = Math.ceil((width - 80) / gridSize);
    const gridH = Math.ceil((height - 80) / gridSize);
    const grid = Array.from({ length: gridH }, () => Array(gridW).fill(0));
    
    features.forEach(f => {
      if (!f.geometry) return;
      let lng: number, lat: number;
      
      if (f.geometry.type === "Point") {
        [lng, lat] = f.geometry.coordinates;
      } else if (f.geometry.type === "Polygon" && f.geometry.coordinates[0].length > 0) {
        const ring = f.geometry.coordinates[0] as GeoJSON.Position[];
        lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
        lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
      } else {
        return;
      }
      
      const [px, py] = geoToCanvas(lng, lat, bbox, width, height);
      const gx = Math.floor((px - 40) / gridSize);
      const gy = Math.floor((py - 40) / gridSize);
      
      if (gx >= 0 && gx < gridW && gy >= 0 && gy < gridH) {
        grid[gy][gx]++;
        // Spread heat
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (gx + dx >= 0 && gx + dx < gridW && gy + dy >= 0 && gy + dy < gridH) {
              grid[gy + dy][gx + dx] += 0.3;
            }
          }
        }
      }
    });
    
    const maxDensity = Math.max(...grid.flat());
    
    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const density = grid[gy][gx];
        if (density > 0) {
          const t = density / maxDensity;
          const color = chroma.scale(["#313695", "#4575b4", "#74add1", "#abd9e9", "#e0f3f8", "#fee090", "#fdae61", "#f46d43", "#d73027", "#a50026"])(t);
          ctx.fillStyle = color.alpha(config.opacity).css();
          ctx.fillRect(40 + gx * gridSize, 40 + gy * gridSize, gridSize, gridSize);
        }
      }
    }
    
    // Add legend for heatmap
    legendItems.push(
      { label: "Low density", color: "#313695" },
      { label: "Medium density", color: "#fdae61" },
      { label: "High density", color: "#a50026" }
    );
    
    stats.featureCount = features.length;
    stats.maxDensity = maxDensity;
    
  } else if (config.mapType === "proportional_symbol" && config.attributeField) {
    const values = features
      .map(f => parseFloat(String(f.properties?.[config.attributeField!])))
      .filter(v => !isNaN(v) && v > 0);
    
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const maxRadius = 30;
    const minRadius = 3;
    
    // Draw base layer first
    features.forEach(f => {
      if (!f.geometry) return;
      if (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") {
        drawGeometry(ctx, f.geometry, bbox, width, height, "#e8edf2", "#ccc", 0.5, 0.8);
      }
    });
    
    // Draw proportional symbols
    features.forEach(f => {
      if (!f.geometry) return;
      const val = parseFloat(String(f.properties?.[config.attributeField!]));
      if (isNaN(val) || val <= 0) return;
      
      const t = maxVal > minVal ? (val - minVal) / (maxVal - minVal) : 0.5;
      const radius = minRadius + t * (maxRadius - minRadius);
      const color = config.colorReverse ? colorScale(1 - t).hex() : colorScale(t).hex();
      
      let cx: number, cy: number;
      if (f.geometry.type === "Point") {
        [cx, cy] = geoToCanvas(f.geometry.coordinates[0], f.geometry.coordinates[1], bbox, width, height);
      } else if (f.geometry.type === "Polygon") {
        const ring = f.geometry.coordinates[0] as GeoJSON.Position[];
        const lngC = ring.reduce((s, c) => s + c[0], 0) / ring.length;
        const latC = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        [cx, cy] = geoToCanvas(lngC, latC, bbox, width, height);
      } else {
        return;
      }
      
      ctx.globalAlpha = config.opacity;
      ctx.fillStyle = color;
      ctx.strokeStyle = config.strokeColor;
      ctx.lineWidth = config.strokeWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    
    // Legend with size classes
    const sizes = [minVal, (minVal + maxVal) / 2, maxVal];
    sizes.forEach((v, i) => {
      const t = maxVal > minVal ? (v - minVal) / (maxVal - minVal) : 0.5;
      legendItems.push({
        label: v.toFixed(1),
        color: config.colorReverse ? colorScale(1 - t).hex() : colorScale(t).hex(),
        value: v,
      });
    });
    
    stats.min = minVal;
    stats.max = maxVal;
    stats.count = values.length;
  } else {
    // Default: draw all features with base color
    const baseColor = colorScale(0.5).hex();
    features.forEach(f => {
      if (f.geometry) {
        drawGeometry(ctx, f.geometry, bbox, width, height, baseColor, config.strokeColor, config.strokeWidth, config.opacity);
      }
    });
    legendItems.push({ label: "Features", color: baseColor });
  }
  
  // Draw legend
  if (config.showLegend && legendItems.length > 0) {
    drawLegend(ctx, legendItems, width, height, config.attributeField || config.mapType);
  }
  
  // Draw title
  ctx.fillStyle = "#1a1a2e";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(config.title, 50, 30);
  
  // Draw border
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(40, 40, width - 80, height - 80);
  
  // Export PNG
  const pngBuffer = await (canvas as unknown as { toBuffer: (format: string) => Promise<Buffer> }).toBuffer("png");
  
  // Generate thumbnail (300x200)
  const thumbCanvas = new Canvas(300, 200);
  const thumbCtx = thumbCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  thumbCtx.drawImage(canvas as unknown as HTMLCanvasElement, 0, 0, 300, 200);
  const thumbnailBuffer = await (thumbCanvas as unknown as { toBuffer: (format: string) => Promise<Buffer> }).toBuffer("png");
  
  return {
    pngBuffer,
    thumbnailBuffer,
    legendData: legendItems,
    stats,
    width,
    height,
  };
}

export async function saveMapToStorage(
  result: MapGenerationResult,
  requestId: number,
  userId: number
): Promise<{
  pngKey: string; pngUrl: string;
  thumbnailKey: string; thumbnailUrl: string;
}> {
  const prefix = `maps/${userId}/${requestId}-${nanoid(8)}`;
  
  const [pngResult, thumbResult] = await Promise.all([
    storagePut(`${prefix}.png`, result.pngBuffer, "image/png"),
    storagePut(`${prefix}-thumb.png`, result.thumbnailBuffer, "image/png"),
  ]);
  
  return {
    pngKey: pngResult.key,
    pngUrl: pngResult.url,
    thumbnailKey: thumbResult.key,
    thumbnailUrl: thumbResult.url,
  };
}

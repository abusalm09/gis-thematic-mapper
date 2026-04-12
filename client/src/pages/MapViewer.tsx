import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Layers, Map, ChevronLeft, Eye, EyeOff, Info,
  ZoomIn, ZoomOut, Maximize2, Download, RefreshCw
} from "lucide-react";

// Leaflet types
declare global {
  interface Window {
    L: typeof import("leaflet");
  }
}

type Dataset = {
  id: number;
  name: string;
  format: string;
  geojsonUrl: string | null;
  featureCount: number | null;
  geometryType: string | null;
  crs: string | null;
  originalCrs: string | null;
  bbox: unknown;
  attributes: unknown;
  status: string;
};

export default function MapViewer() {
  const params = useParams<{ datasetId?: string }>();
  const [, navigate] = useLocation();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<import("leaflet").Map | null>(null);
  const layersRef = useRef<Record<number, import("leaflet").GeoJSON>>({});
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    params.datasetId ? parseInt(params.datasetId) : null
  );
  const [visibleLayers, setVisibleLayers] = useState<Set<number>>(new Set());
  const [selectedFeature, setSelectedFeature] = useState<Record<string, unknown> | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const { data: datasets } = trpc.datasets.list.useQuery();
  const readyDatasets = datasets?.filter(d => d.status === "ready") || [];

  // Load Leaflet dynamically
  useEffect(() => {
    const loadLeaflet = async () => {
      if (window.L) { setLeafletLoaded(true); return; }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => setLeafletLoaded(true);
      document.head.appendChild(script);
    };
    loadLeaflet();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || leafletMapRef.current) return;

    const L = window.L;
    const map = L.map(mapRef.current, {
      center: [-2.5, 118],
      zoom: 5,
      zoomControl: false,
    });

    // Dark tile layer
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    // Custom zoom control
    L.control.zoom({ position: "topright" }).addTo(map);

    leafletMapRef.current = map;
  }, [leafletLoaded]);

  // Load dataset layer
  const loadDatasetLayer = async (dataset: Dataset) => {
    if (!leafletMapRef.current || !dataset.geojsonUrl) return;
    const L = window.L;
    const map = leafletMapRef.current;

    // Remove existing layer
    const existing = layersRef.current[dataset.id];
    if (existing) {
      map.removeLayer(existing);
      delete layersRef.current[dataset.id];
    }

    try {
      const response = await fetch(dataset.geojsonUrl);
      const geojson = await response.json();

      const colors = ["#38bdf8", "#34d399", "#a78bfa", "#fb923c", "#f472b6"];
      const colorIdx = readyDatasets.findIndex(d => d.id === dataset.id) % colors.length;
      const color = colors[colorIdx];

      const layer = L.geoJSON(geojson, {
        style: () => ({
          color,
          weight: 1.5,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.25,
        }),
        pointToLayer: (feature, latlng) => {
          return L.circleMarker(latlng, {
            radius: 6,
            fillColor: color,
            color: "#fff",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8,
          });
        },
        onEachFeature: (feature, featureLayer) => {
          featureLayer.on("click", () => {
            setSelectedFeature(feature.properties as Record<string, unknown>);
          });
          featureLayer.on("mouseover", (e) => {
            const l = e.target;
            if (l.setStyle) {
              l.setStyle({ weight: 2.5, fillOpacity: 0.5 });
            }
          });
          featureLayer.on("mouseout", (e) => {
            layer.resetStyle(e.target);
          });
        },
      });

      layer.addTo(map);
      layersRef.current[dataset.id] = layer;
      setVisibleLayers(prev => new Set(Array.from(prev).concat(dataset.id)));

      // Fit bounds
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    } catch (error) {
      toast.error(`Failed to load layer: ${dataset.name}`);
    }
  };

  const toggleLayer = (dataset: Dataset) => {
    const map = leafletMapRef.current;
    if (!map) return;

    const layer = layersRef.current[dataset.id];
    if (layer) {
      if (visibleLayers.has(dataset.id)) {
        map.removeLayer(layer);
        setVisibleLayers(prev => { const s = new Set(Array.from(prev)); s.delete(dataset.id); return s; });
      } else {
        layer.addTo(map);
        setVisibleLayers(prev => new Set(Array.from(prev).concat(dataset.id)));
      }
    } else {
      loadDatasetLayer(dataset as Dataset);
    }
  };

  // Auto-load selected dataset
  useEffect(() => {
    if (selectedDatasetId && leafletLoaded && readyDatasets.length > 0) {
      const dataset = readyDatasets.find(d => d.id === selectedDatasetId);
        if (dataset && !layersRef.current[dataset.id]) {
        loadDatasetLayer(dataset as Dataset);
      }
    }
  }, [selectedDatasetId, leafletLoaded, readyDatasets.length]);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Panel - Layer Control */}
      <div className="w-72 bg-card border-r border-border/60 flex flex-col">
        <div className="p-4 border-b border-border/60">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Layer Control</h2>
          </div>
          <p className="text-xs text-muted-foreground">Click a dataset to add it as a layer</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {readyDatasets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Map className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No ready datasets</p>
              <Button
                variant="link"
                size="sm"
                className="text-primary text-xs mt-1"
                onClick={() => navigate("/datasets")}
              >
                Upload datasets →
              </Button>
            </div>
          ) : (
            readyDatasets.map((dataset, idx) => {
              const colors = ["#38bdf8", "#34d399", "#a78bfa", "#fb923c", "#f472b6"];
              const color = colors[idx % colors.length];
              const isLoaded = !!layersRef.current[dataset.id];
              const isVisible = visibleLayers.has(dataset.id);

              return (
                <div
                  key={dataset.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                    isLoaded
                      ? "border-border bg-muted/30"
                      : "border-border/40 bg-card hover:border-border"
                  }`}
                  onClick={() => toggleLayer(dataset as Dataset)}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: isLoaded ? color : "transparent", border: `2px solid ${color}` }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{dataset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dataset.format} · {dataset.featureCount?.toLocaleString() || "?"} features
                      </p>
                    </div>
                    {isLoaded && (
                      isVisible
                        ? <Eye className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        : <EyeOff className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Feature Properties Panel */}
        {selectedFeature && (
          <div className="border-t border-border/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Info className="w-3.5 h-3.5 text-primary" />
                Feature Properties
              </div>
              <button
                onClick={() => setSelectedFeature(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {Object.entries(selectedFeature).map(([key, value]) => (
                <div key={key} className="flex gap-2 text-xs">
                  <span className="text-muted-foreground font-mono flex-shrink-0 w-24 truncate">{key}:</span>
                  <span className="text-foreground truncate">{String(value ?? "—")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map Area */}
      <div className="flex-1 relative">
        {!leafletLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />

        {/* Map toolbar */}
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            className="bg-card/90 border-border/60 backdrop-blur-sm gap-2 text-xs"
            onClick={() => navigate("/datasets")}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Datasets
          </Button>
        </div>

        {/* Layer count indicator */}
        {visibleLayers.size > 0 && (
          <div className="absolute bottom-4 left-4 z-[1000]">
            <div className="bg-card/90 border border-border/60 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-muted-foreground">
              {visibleLayers.size} layer{visibleLayers.size !== 1 ? "s" : ""} visible
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Map, Download, Eye, RefreshCw, Plus, Clock, CheckCircle2,
  AlertCircle, Loader2, Image, FileText, Filter, BarChart3, Layers
} from "lucide-react";

type MapRequest = {
  id: number;
  title: string;
  mapType: string;
  status: string;
  attributeField: string | null;
  colorScheme: string | null;
  createdAt: Date;
  updatedAt: Date;
  datasetId: number;
  generatedMap?: {
    id: number;
    pngUrl: string | null;
    pdfUrl: string | null;
    thumbnailUrl: string | null;
    width: number | null;
    height: number | null;
    createdAt: Date;
  } | null;
};

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === "failed") return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
  if (status === "processing") return <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
  return <Clock className="w-3.5 h-3.5 text-slate-400" />;
}

function MapTypeIcon({ type }: { type: string }) {
  if (type === "choropleth") return <Map className="w-4 h-4 text-blue-400" />;
  if (type === "heatmap") return <BarChart3 className="w-4 h-4 text-orange-400" />;
  return <Layers className="w-4 h-4 text-emerald-400" />;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MapGallery() {
  const [, navigate] = useLocation();
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: mapRequests, isLoading, refetch } = trpc.mapRequests.list.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const filtered = mapRequests?.filter(m =>
    filterStatus === "all" || m.status === filterStatus
  ) || [];

  const counts = {
    all: mapRequests?.length || 0,
    completed: mapRequests?.filter(m => m.status === "completed").length || 0,
    processing: mapRequests?.filter(m => m.status === "processing" || m.status === "pending").length || 0,
    failed: mapRequests?.filter(m => m.status === "failed").length || 0,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Map Gallery</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generated thematic maps — download as PNG or PDF
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-2 border-border/60"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/map-request")}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" />
            New Map
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 w-fit">
        {[
          { key: "all", label: "All", count: counts.all },
          { key: "completed", label: "Completed", count: counts.completed },
          { key: "processing", label: "Processing", count: counts.processing },
          { key: "failed", label: "Failed", count: counts.failed },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              filterStatus === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              filterStatus === tab.key ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Map Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Image className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground font-medium">No maps yet</p>
          <p className="text-muted-foreground/60 text-sm mt-1">
            {filterStatus === "all"
              ? "Submit a map request to generate your first thematic map"
              : `No ${filterStatus} maps`}
          </p>
          {filterStatus === "all" && (
            <Button
              size="sm"
              className="mt-4 gap-2 bg-primary hover:bg-primary/90"
              onClick={() => navigate("/map-request")}
            >
              <Plus className="w-3.5 h-3.5" />
              Create Map
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((req) => (
            <div
              key={req.id}
              className="bg-card border border-border/60 rounded-xl overflow-hidden hover:border-border transition-all duration-200 group"
            >
              {/* Thumbnail */}
              <div
                className="h-44 bg-muted/30 relative overflow-hidden cursor-pointer"
                onClick={() => req.status === "completed" && navigate(`/gallery/${req.id}`)}
              >
                {req.generatedMap?.thumbnailUrl ? (
                  <img
                    src={req.generatedMap.thumbnailUrl}
                    alt={req.title}
                    className="w-full h-full object-cover"
                  />
                ) : req.generatedMap?.pngUrl ? (
                  <img
                    src={req.generatedMap.pngUrl}
                    alt={req.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {req.status === "processing" || req.status === "pending" ? (
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Generating...</p>
                      </div>
                    ) : req.status === "failed" ? (
                      <div className="text-center">
                        <AlertCircle className="w-8 h-8 text-red-400/60 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Generation failed</p>
                      </div>
                    ) : (
                      <Map className="w-10 h-10 text-muted-foreground/30" />
                    )}
                  </div>
                )}

                {/* Overlay on hover */}
                {req.status === "completed" && (
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-primary hover:bg-primary/90 text-xs"
                      onClick={(e) => { e.stopPropagation(); navigate(`/gallery/${req.id}`); }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </Button>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapTypeIcon type={req.mapType} />
                    <h3 className="font-medium text-foreground text-sm truncate">{req.title}</h3>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <StatusIcon status={req.status} />
                    <span className={`text-xs capitalize ${
                      req.status === "completed" ? "text-emerald-400" :
                      req.status === "failed" ? "text-red-400" :
                      req.status === "processing" ? "text-amber-400" : "text-slate-400"
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="capitalize">{req.mapType.replace("_", " ")}</span>
                  {req.attributeField && (
                    <span className="font-mono text-primary/70">{req.attributeField}</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(req.createdAt)}</span>
                  {req.status === "completed" && req.generatedMap && (
                    <div className="flex items-center gap-1">
                      {req.generatedMap.pngUrl && (
                        <a
                          href={req.generatedMap.pngUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Image className="w-3 h-3" />
                          PNG
                        </a>
                      )}
                      {req.generatedMap.pdfUrl && (
                        <a
                          href={req.generatedMap.pdfUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                          PDF
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

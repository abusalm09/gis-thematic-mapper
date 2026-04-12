import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, Download, Image, FileText, Map, BarChart3, Layers,
  Calendar, Database, Palette, Settings2, Loader2, AlertCircle
} from "lucide-react";

function MapTypeIcon({ type }: { type: string }) {
  if (type === "choropleth") return <Map className="w-4 h-4 text-blue-400" />;
  if (type === "heatmap") return <BarChart3 className="w-4 h-4 text-orange-400" />;
  return <Layers className="w-4 h-4 text-emerald-400" />;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MapDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(params.id || "0");

  const { data: requests, isLoading } = trpc.mapRequests.list.useQuery();
  const req = requests?.find(r => r.id === id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!req) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">Map not found</p>
        <Button variant="link" className="text-primary mt-2" onClick={() => navigate("/gallery")}>
          Back to Gallery
        </Button>
      </div>
    );
  }

  const map = (req as typeof req & { generatedMap?: { pngUrl?: string | null; pdfUrl?: string | null; thumbnailUrl?: string | null; width?: number | null; height?: number | null; createdAt?: Date } | null }).generatedMap;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left: Map Preview */}
      <div className="flex-1 bg-muted/20 flex items-center justify-center p-6 overflow-auto">
        {map?.pngUrl ? (
          <img
            src={map.pngUrl}
            alt={req.title}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-border/40"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <Map className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Map preview not available</p>
          </div>
        )}
      </div>

      {/* Right: Info Panel */}
      <div className="w-72 bg-card border-l border-border/60 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-border/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/gallery")}
            className="gap-2 text-muted-foreground hover:text-foreground mb-3 -ml-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Gallery
          </Button>
          <div className="flex items-center gap-2 mb-1">
            <MapTypeIcon type={req.mapType} />
            <h2 className="font-semibold text-foreground text-sm leading-tight">{req.title}</h2>
          </div>
          <p className="text-xs text-muted-foreground capitalize">{req.mapType.replace("_", " ")} Map</p>
        </div>

        {/* Download */}
        {map && (map.pngUrl || map.pdfUrl) && (
          <div className="p-4 border-b border-border/60 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Download</p>
            {map.pngUrl && (
              <a href={map.pngUrl} download target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-2 bg-primary hover:bg-primary/90 text-sm" size="sm">
                  <Image className="w-3.5 h-3.5" />
                  Download PNG
                </Button>
              </a>
            )}
            {map.pdfUrl && (
              <a href={map.pdfUrl} download target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full gap-2 border-border/60 text-sm" size="sm">
                  <FileText className="w-3.5 h-3.5" />
                  Download PDF
                </Button>
              </a>
            )}
          </div>
        )}

        {/* Metadata */}
        <div className="p-4 space-y-4 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Map Details</p>

          {[
            { icon: Database, label: "Dataset ID", value: `#${req.datasetId}` },
            { icon: Settings2, label: "Classification", value: req.classificationMethod?.replace("_", " ") || "—" },
            { icon: Palette, label: "Color Scheme", value: req.colorScheme || "—" },
            { icon: Settings2, label: "Classes", value: String(req.numClasses || "—") },
            { icon: Calendar, label: "Created", value: formatDate(req.createdAt) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm text-foreground capitalize">{value}</p>
              </div>
            </div>
          ))}

          {req.attributeField && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Attribute Field</p>
                <p className="text-sm text-primary font-mono">{req.attributeField}</p>
              </div>
            </div>
          )}

          {map && (map.width || map.height) && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <Image className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dimensions</p>
                <p className="text-sm text-foreground">{map.width} × {map.height} px</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

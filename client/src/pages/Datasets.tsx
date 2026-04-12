import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Upload, Database, Trash2, Eye, Map, RefreshCw,
  FileText, AlertCircle, CheckCircle2, Clock, Loader2,
  FolderOpen, Info, X, ChevronRight
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

type Dataset = {
  id: number;
  name: string;
  originalFilename: string;
  format: "SHP" | "ECW" | "DXF";
  fileSizeBytes: number | null;
  featureCount: number | null;
  geometryType: string | null;
  crs: string | null;
  originalCrs: string | null;
  bbox: unknown;
  attributes: unknown;
  status: "uploading" | "processing" | "ready" | "error";
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    uploading: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: "Uploading", cls: "status-uploading" },
    processing: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: "Processing", cls: "status-processing" },
    ready: { icon: <CheckCircle2 className="w-3 h-3" />, label: "Ready", cls: "status-ready" },
    error: { icon: <AlertCircle className="w-3 h-3" />, label: "Error", cls: "status-error" },
  };
  const c = config[status] || config.error;
  return (
    <span className={`status-badge ${c.cls}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function FormatBadge({ format }: { format: string }) {
  const cls: Record<string, string> = {
    SHP: "format-shp", ECW: "format-ecw", DXF: "format-dxf",
  };
  return (
    <span className={`status-badge ${cls[format] || "status-pending"}`}>
      {format}
    </span>
  );
}

export default function Datasets() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: datasets, isLoading, refetch } = trpc.datasets.list.useQuery(undefined, {
    refetchInterval: 5000, // Poll for status updates
  });

  const deleteMutation = trpc.datasets.delete.useMutation({
    onSuccess: () => {
      toast.success("Dataset deleted successfully");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleUpload = useCallback(async (file: File) => {
    if (!file) return;

    const ext = file.name.toLowerCase().split(".").pop();
    const allowed = ["zip", "shp", "ecw", "dxf"];
    if (!allowed.includes(ext || "")) {
      toast.error("Unsupported file format. Please upload ZIP (SHP), ECW, or DXF files.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", datasetName || file.name.replace(/\.[^/.]+$/, ""));

    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      const result = await new Promise<{ success: boolean; datasetId: number; message: string }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              reject(new Error(JSON.parse(xhr.responseText).error || "Upload failed"));
            } catch {
              reject(new Error("Upload failed"));
            }
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      toast.success(`${result.message}`);
      setDatasetName("");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [datasetName, refetch]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const readyDatasets = datasets?.filter(d => d.status === "ready") || [];
  const processingDatasets = datasets?.filter(d => d.status === "processing" || d.status === "uploading") || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Spatial Datasets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your spatial data files — SHP, ECW, and DXF formats supported
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
            onClick={() => fileInputRef.current?.click()}
            className="gap-2 bg-primary hover:bg-primary/90"
            disabled={uploading}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Dataset
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Datasets", value: datasets?.length || 0, icon: Database, color: "text-primary" },
          { label: "Ready", value: readyDatasets.length, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Processing", value: processingDatasets.length, icon: Clock, color: "text-amber-400" },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card border border-border/60 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          isDragging ? "dropzone-active" : "border-border/50 hover:border-border"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.shp,.ecw,.dxf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />

        {uploading ? (
          <div className="space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Uploading... {uploadProgress}%</p>
            <div className="w-64 mx-auto h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-foreground font-medium">Drop your spatial data file here</p>
              <p className="text-muted-foreground text-sm mt-1">
                Supports <span className="text-violet-400 font-medium">SHP</span> (as ZIP),{" "}
                <span className="text-cyan-400 font-medium">ECW</span>, and{" "}
                <span className="text-orange-400 font-medium">DXF</span> formats · Max 100MB
              </p>
            </div>
            <div className="flex items-center gap-2 max-w-xs mx-auto">
              <input
                type="text"
                placeholder="Dataset name (optional)"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Browse
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dataset List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : datasets?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground font-medium">No datasets yet</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Upload your first spatial data file to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {datasets?.map((dataset) => (
            <div
              key={dataset.id}
              className="bg-card border border-border/60 rounded-xl p-4 flex items-center gap-4 hover:border-border transition-all duration-200 group"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground truncate">{dataset.name}</span>
                  <FormatBadge format={dataset.format} />
                  <StatusBadge status={dataset.status} />
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{dataset.originalFilename}</span>
                  <span>{formatBytes(dataset.fileSizeBytes)}</span>
                  {dataset.featureCount && <span>{dataset.featureCount.toLocaleString()} features</span>}
                  {dataset.geometryType && <span>{dataset.geometryType}</span>}
                  {dataset.originalCrs && dataset.originalCrs !== "EPSG:4326" && (
                    <span className="text-amber-400/80">CRS: {dataset.originalCrs} → WGS84</span>
                  )}
                  <span>{formatDate(dataset.createdAt)}</span>
                </div>
                {dataset.status === "error" && dataset.errorMessage && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {dataset.errorMessage}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedDataset(dataset as Dataset)}
                  title="View details"
                >
                  <Info className="w-4 h-4" />
                </Button>
                {dataset.status === "ready" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-cyan-400"
                      onClick={() => navigate(`/map-viewer/${dataset.id}`)}
                      title="View on map"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                      onClick={() => navigate(`/map-request?datasetId=${dataset.id}`)}
                      title="Create thematic map"
                    >
                      <Map className="w-4 h-4" />
                    </Button>
                  </>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      title="Delete dataset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Dataset</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted-foreground">
                        Are you sure you want to delete <strong className="text-foreground">{dataset.name}</strong>?
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate({ id: dataset.id })}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dataset Detail Dialog */}
      <Dialog open={!!selectedDataset} onOpenChange={() => setSelectedDataset(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              {selectedDataset?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Dataset metadata and spatial information
            </DialogDescription>
          </DialogHeader>
          {selectedDataset && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Format", value: (<FormatBadge format={selectedDataset.format} />) as React.ReactNode },
                  { label: "Status", value: (<StatusBadge status={selectedDataset.status} />) as React.ReactNode },
                  { label: "File Size", value: formatBytes(selectedDataset.fileSizeBytes) as React.ReactNode },
                  { label: "Features", value: (selectedDataset.featureCount?.toLocaleString() || "—") as React.ReactNode },
                  { label: "Geometry", value: (selectedDataset.geometryType || "—") as React.ReactNode },
                  { label: "Original CRS", value: (selectedDataset.originalCrs || "—") as React.ReactNode },
                  { label: "Output CRS", value: (selectedDataset.crs || "—") as React.ReactNode },
                  { label: "Uploaded", value: formatDate(selectedDataset.createdAt) as React.ReactNode },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/50 rounded-lg p-3">
                    <div className="text-muted-foreground text-xs mb-1">{label}</div>
                    <div className="text-foreground font-medium">{value}</div>
                  </div>
                ))}
              </div>
              {selectedDataset.attributes != null && Array.isArray(selectedDataset.attributes as unknown[]) && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground text-xs mb-2">Attribute Fields</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedDataset.attributes as string[]).map((attr) => (
                      <span key={attr} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">
                        {attr}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedDataset.status === "ready" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 gap-2 bg-primary hover:bg-primary/90"
                    onClick={() => {
                      setSelectedDataset(null);
                      navigate(`/map-viewer/${selectedDataset.id}`);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                    View on Map
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 border-border/60"
                    onClick={() => {
                      setSelectedDataset(null);
                      navigate(`/map-request?datasetId=${selectedDataset.id}`);
                    }}
                  >
                    <Map className="w-4 h-4" />
                    Create Map
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

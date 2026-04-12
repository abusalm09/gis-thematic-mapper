import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Map, BarChart3, Layers, ChevronLeft, ChevronRight,
  Palette, Settings2, Type, Eye, Loader2, CheckCircle2
} from "lucide-react";

const MAP_TYPES = [
  {
    id: "choropleth",
    label: "Choropleth",
    description: "Color regions by attribute value using classification methods",
    icon: Map,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  {
    id: "heatmap",
    label: "Heatmap",
    description: "Show density distribution of spatial features",
    icon: BarChart3,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
  },
  {
    id: "proportional_symbol",
    label: "Proportional Symbol",
    description: "Scale symbols proportionally to attribute values",
    icon: Layers,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
];

const COLOR_SCHEMES = [
  { id: "YlOrRd", label: "Yellow → Red", preview: ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"] },
  { id: "Blues", label: "Blues", preview: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"] },
  { id: "Greens", label: "Greens", preview: ["#f7fcf5", "#c7e9c0", "#74c476", "#31a354", "#006d2c"] },
  { id: "RdYlGn", label: "Red → Green", preview: ["#d73027", "#fc8d59", "#fee08b", "#91cf60", "#1a9850"] },
  { id: "Purples", label: "Purples", preview: ["#fcfbfd", "#dadaeb", "#9e9ac8", "#756bb1", "#54278f"] },
  { id: "Spectral", label: "Spectral", preview: ["#d53e4f", "#fc8d59", "#fee08b", "#99d594", "#3288bd"] },
  { id: "Viridis", label: "Viridis", preview: ["#440154", "#3b528b", "#21908c", "#5dc963", "#fde725"] },
  { id: "Plasma", label: "Plasma", preview: ["#0d0887", "#7e03a8", "#cc4778", "#f89540", "#f0f921"] },
];

const CLASSIFICATION_METHODS = [
  { id: "quantile", label: "Quantile", description: "Equal number of features per class" },
  { id: "equal_interval", label: "Equal Interval", description: "Equal value range per class" },
  { id: "natural_breaks", label: "Natural Breaks (Jenks)", description: "Minimize within-class variance" },
  { id: "standard_deviation", label: "Standard Deviation", description: "Classes based on std dev from mean" },
];

export default function MapRequest() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedDatasetId = params.get("datasetId") ? parseInt(params.get("datasetId")!) : null;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    datasetId: preselectedDatasetId || 0,
    title: "",
    mapType: "choropleth" as "choropleth" | "heatmap" | "proportional_symbol",
    attributeField: "",
    classificationMethod: "quantile" as "equal_interval" | "quantile" | "natural_breaks" | "standard_deviation",
    numClasses: 5,
    colorScheme: "YlOrRd",
    colorReverse: false,
    opacity: 0.8,
    strokeColor: "#ffffff",
    strokeWidth: 0.5,
    showLegend: true,
    showLabels: false,
    labelField: "",
  });

  const { data: datasets } = trpc.datasets.list.useQuery();
  const readyDatasets = datasets?.filter(d => d.status === "ready") || [];

  const selectedDataset = readyDatasets.find(d => d.id === form.datasetId);
  const attributes = selectedDataset?.attributes as string[] | undefined;

  const createMutation = trpc.mapRequests.create.useMutation({
    onSuccess: (data) => {
      toast.success("Map request submitted! Processing in background...");
      navigate("/gallery");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateForm = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const canProceedStep1 = form.datasetId > 0 && form.title.trim().length > 0;
  const canProceedStep2 = form.mapType && (form.mapType === "heatmap" || form.attributeField);

  const handleSubmit = () => {
    createMutation.mutate({
      datasetId: form.datasetId,
      title: form.title,
      mapType: form.mapType,
      attributeField: form.attributeField || undefined,
      classificationMethod: form.classificationMethod,
      numClasses: form.numClasses,
      colorScheme: form.colorScheme,
      colorReverse: form.colorReverse,
      opacity: form.opacity,
      strokeColor: form.strokeColor,
      strokeWidth: form.strokeWidth,
      showLegend: form.showLegend,
      showLabels: form.showLabels,
      labelField: form.labelField || undefined,
    });
  };

  const steps = [
    { num: 1, label: "Dataset & Title" },
    { num: 2, label: "Map Type" },
    { num: 3, label: "Style & Options" },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/datasets")}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Thematic Map</h1>
          <p className="text-muted-foreground text-sm">Configure and generate a professional thematic map</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              step === s.num
                ? "bg-primary text-primary-foreground"
                : step > s.num
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-muted text-muted-foreground"
            }`}>
              {step > s.num ? <CheckCircle2 className="w-3 h-3" /> : <span>{s.num}</span>}
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-8 ${step > s.num ? "bg-emerald-500/40" : "bg-border/60"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Dataset & Title */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="bg-card border border-border/60 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Select Dataset
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {readyDatasets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>No ready datasets available.</p>
                  <Button variant="link" size="sm" className="text-primary" onClick={() => navigate("/datasets")}>
                    Upload a dataset →
                  </Button>
                </div>
              ) : (
                readyDatasets.map(dataset => (
                  <div
                    key={dataset.id}
                    onClick={() => updateForm("datasetId", dataset.id)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all duration-150 ${
                      form.datasetId === dataset.id
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground text-sm">{dataset.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {dataset.format} · {dataset.featureCount?.toLocaleString()} features · {dataset.geometryType}
                        </p>
                      </div>
                      {form.datasetId === dataset.id && (
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Type className="w-4 h-4 text-primary" />
              Map Title
            </h2>
            <input
              type="text"
              placeholder="e.g., Population Density by Province 2024"
              value={form.title}
              onChange={(e) => updateForm("title", e.target.value)}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring text-sm"
            />
          </div>

          <Button
            className="w-full gap-2 bg-primary hover:bg-primary/90"
            disabled={!canProceedStep1}
            onClick={() => setStep(2)}
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Step 2: Map Type & Attribute */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="bg-card border border-border/60 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Map className="w-4 h-4 text-primary" />
              Map Type
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {MAP_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <div
                    key={type.id}
                    onClick={() => updateForm("mapType", type.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
                      form.mapType === type.id
                        ? `${type.border} ${type.bg}`
                        : "border-border/60 hover:border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg ${type.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${type.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground text-sm">{type.label}</p>
                          {form.mapType === type.id && <CheckCircle2 className={`w-3.5 h-3.5 ${type.color}`} />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {form.mapType !== "heatmap" && attributes && attributes.length > 0 && (
            <div className="bg-card border border-border/60 rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                Attribute Field
              </h2>
              <p className="text-xs text-muted-foreground">Select the numeric field to visualize</p>
              <div className="grid grid-cols-2 gap-2">
                {attributes.map(attr => (
                  <div
                    key={attr}
                    onClick={() => updateForm("attributeField", attr)}
                    className={`px-3 py-2 rounded-lg border cursor-pointer text-xs font-mono transition-all ${
                      form.attributeField === attr
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 hover:border-border text-muted-foreground"
                    }`}
                  >
                    {attr}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 border-border/60" onClick={() => setStep(1)}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              className="flex-1 gap-2 bg-primary hover:bg-primary/90"
              disabled={!canProceedStep2}
              onClick={() => setStep(3)}
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Style & Options */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Color Scheme */}
          <div className="bg-card border border-border/60 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              Color Scheme
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {COLOR_SCHEMES.map(scheme => (
                <div
                  key={scheme.id}
                  onClick={() => updateForm("colorScheme", scheme.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    form.colorScheme === scheme.id
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:border-border"
                  }`}
                >
                  <div className="flex gap-0.5 mb-1.5">
                    {(form.colorReverse ? [...scheme.preview].reverse() : scheme.preview).map((c, i) => (
                      <div key={i} className="flex-1 h-4 rounded-sm" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{scheme.label}</p>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.colorReverse}
                onChange={(e) => updateForm("colorReverse", e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <span className="text-sm text-muted-foreground">Reverse color order</span>
            </label>
          </div>

          {/* Classification (for choropleth) */}
          {form.mapType === "choropleth" && (
            <div className="bg-card border border-border/60 rounded-xl p-5 space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                Classification Method
              </h2>
              <div className="space-y-2">
                {CLASSIFICATION_METHODS.map(method => (
                  <div
                    key={method.id}
                    onClick={() => updateForm("classificationMethod", method.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      form.classificationMethod === method.id
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{method.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{method.description}</p>
                      </div>
                      {form.classificationMethod === method.id && (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Number of Classes: <span className="text-foreground font-medium">{form.numClasses}</span>
                </label>
                <input
                  type="range"
                  min={2}
                  max={9}
                  value={form.numClasses}
                  onChange={(e) => updateForm("numClasses", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>2</span><span>9</span>
                </div>
              </div>
            </div>
          )}

          {/* Rendering Options */}
          <div className="bg-card border border-border/60 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Rendering Options
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Opacity: <span className="text-foreground font-medium">{Math.round(form.opacity * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(form.opacity * 100)}
                  onChange={(e) => updateForm("opacity", parseInt(e.target.value) / 100)}
                  className="w-full accent-primary"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.showLegend}
                    onChange={(e) => updateForm("showLegend", e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-muted-foreground">Show Legend</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.showLabels}
                    onChange={(e) => updateForm("showLabels", e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-muted-foreground">Show Labels</span>
                </label>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm">
            <p className="font-medium text-foreground mb-2">Map Summary</p>
            <div className="space-y-1 text-muted-foreground text-xs">
              <p>Title: <span className="text-foreground">{form.title}</span></p>
              <p>Dataset: <span className="text-foreground">{selectedDataset?.name}</span></p>
              <p>Type: <span className="text-foreground capitalize">{form.mapType.replace("_", " ")}</span></p>
              {form.attributeField && <p>Field: <span className="text-foreground font-mono">{form.attributeField}</span></p>}
              <p>Colors: <span className="text-foreground">{form.colorScheme}</span></p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 border-border/60" onClick={() => setStep(2)}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              className="flex-1 gap-2 bg-primary hover:bg-primary/90"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</>
              ) : (
                <><Map className="w-4 h-4" />Generate Map</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

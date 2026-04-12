import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { Map, Layers, BarChart3, Upload, Shield, Zap, Globe2, ChevronRight } from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "Multi-Format Import",
    description: "Upload SHP, ECW, and DXF spatial data with automatic CRS detection and reprojection to WGS84.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    icon: Map,
    title: "Interactive Map Viewer",
    description: "Explore your spatial data with Leaflet-powered maps, layer toggling, and attribute inspection.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    icon: BarChart3,
    title: "Thematic Map Generation",
    description: "Generate choropleth, heatmap, and proportional symbol maps with configurable classification methods.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Layers,
    title: "Data Management",
    description: "Organize datasets with full metadata, attribute inspection, and version tracking.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: Zap,
    title: "Automated Queue",
    description: "Submit map requests and let the system process them automatically in the background.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description: "Secure multi-user environment with admin controls and activity monitoring.",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
];

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (!loading && isAuthenticated) {
    navigate("/datasets");
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(oklch(0.65 0.18 200) 1px, transparent 1px), linear-gradient(90deg, oklch(0.65 0.18 200) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
            <Globe2 className="w-5 h-5 text-primary" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">GIS Thematic Mapper</span>
        </div>
        {!loading && !isAuthenticated && (
          <Button
            onClick={() => window.location.href = getLoginUrl()}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Sign In
          </Button>
        )}
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-24 pb-16">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Professional GIS Platform
        </div>

        {/* Title */}
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 max-w-3xl leading-tight">
          <span className="text-foreground">Spatial Data &</span>
          <br />
          <span className="gradient-text">Thematic Mapping</span>
        </h1>

        <p className="text-muted-foreground text-lg max-w-xl mb-10 leading-relaxed">
          A professional platform for managing spatial datasets and generating publication-quality
          thematic maps from SHP, ECW, and DXF files.
        </p>

        {/* CTA */}
        {loading ? (
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        ) : isAuthenticated ? (
          <Button
            onClick={() => navigate("/datasets")}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-8"
          >
            Open Dashboard
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => window.location.href = getLoginUrl()}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-8"
            >
              Get Started
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-border/60 text-muted-foreground hover:text-foreground hover:border-border px-8"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Sign In
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-8 mt-14 text-sm text-muted-foreground">
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-foreground">3</span>
            <span>Supported Formats</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-foreground">3</span>
            <span>Map Types</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-foreground">Auto</span>
            <span>Processing</span>
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="p-5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm hover:border-border transition-all duration-200"
              >
                <div className={`w-10 h-10 rounded-lg ${feature.bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 px-8 py-5 flex items-center justify-between text-xs text-muted-foreground">
        <span>GIS Thematic Mapper — Professional Spatial Data Platform</span>
        <span>Up to 3 users · SHP · ECW · DXF</span>
      </footer>
    </div>
  );
}

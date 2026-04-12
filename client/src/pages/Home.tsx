import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Map, Layers, BarChart3, Upload, Shield, Zap, Globe2, ChevronRight, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

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

type AuthMode = "landing" | "login" | "register";

export default function Home() {
  const { loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<AuthMode>("landing");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      navigate("/datasets");
    },
    onError: (e) => setError(e.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      navigate("/datasets");
    },
    onError: (e) => setError(e.message),
  });

  if (!loading && isAuthenticated) {
    navigate("/datasets");
    return null;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ email: loginEmail, password: loginPassword });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    registerMutation.mutate({ name: regName, email: regEmail, password: regPassword });
  };

  // Auth form overlay
  if (mode === "login" || mode === "register") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <div
          className="fixed inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(oklch(0.65 0.18 200) 1px, transparent 1px), linear-gradient(90deg, oklch(0.65 0.18 200) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative z-10 w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Globe2 className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-semibold text-foreground">GIS Thematic Mapper</span>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl p-8 shadow-xl">
            <h2 className="text-xl font-bold text-foreground mb-1">
              {mode === "login" ? "Sign in to your account" : "Create an account"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {mode === "login"
                ? "Enter your credentials to access the platform"
                : "Register to start managing spatial data"}
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm text-foreground/80">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm text-foreground/80">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="bg-background/50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm text-foreground/80">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-sm text-foreground/80">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="you@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password" className="text-sm text-foreground/80">Password</Label>
                  <div className="relative">
                    <Input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 6 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={6}
                      className="bg-background/50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            )}

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    onClick={() => { setMode("register"); setError(""); }}
                    className="text-primary hover:underline font-medium"
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    onClick={() => { setMode("login"); setError(""); }}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>

            <div className="mt-3 text-center">
              <button
                onClick={() => { setMode("landing"); setError(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back to home
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Max 3 users · First user becomes admin
          </p>
        </div>
      </div>
    );
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
            onClick={() => setMode("login")}
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
              onClick={() => setMode("register")}
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
              onClick={() => setMode("login")}
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

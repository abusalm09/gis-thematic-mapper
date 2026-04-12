import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Zap, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw,
  Loader2, Settings2, Clock, Map, Database, AlertCircle
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const SCHEDULE_TYPES = [
  { id: "manual", label: "Manual", description: "Trigger manually from the dashboard", icon: Settings2 },
  { id: "daily", label: "Daily", description: "Run automatically every day", icon: Clock },
  { id: "weekly", label: "Weekly", description: "Run automatically every week", icon: Clock },
  { id: "monthly", label: "Monthly", description: "Run automatically every month", icon: Clock },
];

const MAP_TYPES = [
  { id: "choropleth", label: "Generate Choropleth Map", icon: Map },
  { id: "heatmap", label: "Generate Heatmap", icon: Map },
  { id: "proportional_symbol", label: "Generate Proportional Symbol Map", icon: Map },
];

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function Automation() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    scheduleType: "manual" as "manual" | "daily" | "weekly" | "monthly",
    mapType: "choropleth" as string,
    config: {} as Record<string, unknown>,
  });

  const { data: rules, isLoading, refetch } = trpc.automation.list.useQuery();

  const createMutation = trpc.automation.create.useMutation({
    onSuccess: () => {
      toast.success("Automation rule created");
      setShowCreate(false);
      setForm({ name: "", description: "", scheduleType: "manual", mapType: "choropleth", config: {} });
      refetch();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const toggleMutation = trpc.automation.update.useMutation({
    onSuccess: () => { toast.success("Rule updated"); refetch(); },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const deleteMutation = trpc.automation.delete.useMutation({
    onSuccess: () => { toast.success("Rule deleted"); refetch(); },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Automation Rules</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Configure automated map generation triggers and actions
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
            onClick={() => setShowCreate(true)}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <Zap className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="text-foreground font-medium mb-1">How Automation Works</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Create rules that automatically generate thematic maps when certain conditions are met.
            For example, automatically generate a choropleth map whenever a new SHP dataset is uploaded.
          </p>
        </div>
      </div>

      {/* Rules List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : rules?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/50 rounded-xl">
          <Zap className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">No automation rules yet</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Create your first rule to automate map generation</p>
          <Button
            size="sm"
            className="mt-4 gap-2 bg-primary hover:bg-primary/90"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Create Rule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules?.map(rule => {
                    const schedule = SCHEDULE_TYPES.find(t => t.id === rule.scheduleType);
            const mapType = MAP_TYPES.find(a => a.id === rule.mapType);
            const ScheduleIcon = schedule?.icon || Settings2;
            const MapTypeIcon = mapType?.icon || Map;

            return (
              <div
                key={rule.id}
                className={`bg-card border rounded-xl p-4 transition-all duration-200 ${
                  rule.isActive ? "border-border/60" : "border-border/30 opacity-60"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    rule.isActive ? "bg-primary/10" : "bg-muted"
                  }`}>
                    <Zap className={`w-5 h-5 ${rule.isActive ? "text-primary" : "text-muted-foreground"}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground">{rule.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        rule.isActive
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground mb-2">{rule.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ScheduleIcon className="w-3 h-3" />
                        {schedule?.label || rule.scheduleType || "Manual"}
                      </span>
                      <span className="text-border">→</span>
                      <span className="flex items-center gap-1">
                        <MapTypeIcon className="w-3 h-3" />
                        {mapType?.label || rule.mapType || "Map"}
                      </span>
                      <span className="text-border">·</span>
                      <span>{formatDate(rule.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-8 w-8 p-0 ${rule.isActive ? "text-emerald-400 hover:text-muted-foreground" : "text-muted-foreground hover:text-emerald-400"}`}
                      onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                      title={rule.isActive ? "Deactivate" : "Activate"}
                    >
                      {rule.isActive
                        ? <ToggleRight className="w-5 h-5" />
                        : <ToggleLeft className="w-5 h-5" />
                      }
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground">
                            Delete <strong className="text-foreground">{rule.name}</strong>? This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ id: rule.id })}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Create Automation Rule
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Configure a trigger and action for automated map generation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Rule Name</label>
              <input
                type="text"
                placeholder="e.g., Auto-generate choropleth on upload"
                value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Description (optional)</label>
              <input
                type="text"
                placeholder="Brief description of what this rule does"
                value={form.description}
                onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Schedule Type</label>
              <div className="space-y-2">
                {SCHEDULE_TYPES.map(t => {
                  const Icon = t.icon;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setForm(p => ({ ...p, scheduleType: t.id as typeof form.scheduleType }))}
                      className={`p-3 rounded-lg border cursor-pointer transition-all text-sm ${
                        form.scheduleType === t.id
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-primary" />
                        <span className="font-medium text-foreground">{t.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 ml-6">{t.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Map Type to Generate</label>
              <div className="space-y-1.5">
                {MAP_TYPES.map(a => {
                  const Icon = a.icon;
                  return (
                    <div
                      key={a.id}
                      onClick={() => setForm(p => ({ ...p, mapType: a.id }))}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all text-sm flex items-center gap-2 ${
                        form.mapType === a.id
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border/60 hover:border-border text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {a.label}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 border-border/60" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={!form.name || createMutation.isPending}
                onClick={() => createMutation.mutate({
                  name: form.name,
                  description: form.description || undefined,
                  scheduleType: form.scheduleType,
                  mapType: form.mapType,
                  scheduleConfig: form.config,
                })}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Rule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

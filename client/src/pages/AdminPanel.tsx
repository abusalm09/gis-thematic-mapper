import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Shield, Users, Database, Map, Activity, RefreshCw,
  Loader2, AlertCircle, CheckCircle2, Clock, BarChart3,
  Server, Zap, FileText
} from "lucide-react";
import { useEffect } from "react";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ActivityIcon({ action }: { action: string }) {
  if (action.includes("upload") || action.includes("dataset")) return <Database className="w-3.5 h-3.5 text-violet-400" />;
  if (action.includes("map")) return <Map className="w-3.5 h-3.5 text-blue-400" />;
  if (action.includes("user")) return <Users className="w-3.5 h-3.5 text-emerald-400" />;
  return <Activity className="w-3.5 h-3.5 text-muted-foreground" />;
}

export default function AdminPanel() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.admin.stats.useQuery();
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = trpc.admin.users.useQuery();
  const { data: activity, isLoading: activityLoading, refetch: refetchActivity } = trpc.admin.recentActivity.useQuery({ limit: 20 });
  const { data: allRequests } = trpc.mapRequests.list.useQuery();

  const refetchAll = () => {
    refetchStats();
    refetchUsers();
    refetchActivity();
  };

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/datasets");
    }
  }, [user]);

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Admin access required</p>
        </div>
      </div>
    );
  }

  const processingCount = allRequests?.filter(r => r.status === "processing" || r.status === "pending").length || 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          </div>
          <p className="text-muted-foreground text-sm">System monitoring and management</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refetchAll}
          className="gap-2 border-border/60"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: stats?.userCount || 0, icon: Users, color: "text-primary", bg: "bg-primary/10", limit: `/ ${3} max` },
            { label: "Datasets", value: stats?.datasetCount || 0, icon: Database, color: "text-violet-400", bg: "bg-violet-500/10", limit: "" },
            { label: "Generated Maps", value: stats?.mapCount || 0, icon: Map, color: "text-blue-400", bg: "bg-blue-500/10", limit: "" },
            { label: "Processing Queue", value: processingCount, icon: Zap, color: "text-amber-400", bg: "bg-amber-500/10", limit: "" },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card border border-border/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  {stat.limit && (
                    <span className="text-xs text-muted-foreground">{stat.limit}</span>
                  )}
                </div>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users */}
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground text-sm">Users</h2>
              <span className="text-xs text-muted-foreground">
                ({users?.length || 0} / 3)
              </span>
            </div>
            {(users?.length || 0) >= 3 && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Limit reached
              </span>
            )}
          </div>
          <div className="divide-y divide-border/40">
            {usersLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : users?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No users yet</div>
            ) : (
              users?.map(u => (
                <div key={u.id} className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary text-xs font-semibold">
                      {(u.name || u.email || "U").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{u.name || "Anonymous"}</p>
                      {u.role === "admin" && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-primary/15 text-primary">Admin</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email || u.openId}</p>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDate(u.lastSignedIn)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Map Request Status */}
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/60 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Map Request Status</h2>
          </div>
          <div className="p-4 space-y-3">
            {[
              { label: "Completed", count: allRequests?.filter(r => r.status === "completed").length || 0, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Processing", count: allRequests?.filter(r => r.status === "processing").length || 0, icon: Loader2, color: "text-amber-400", bg: "bg-amber-500/10" },
              { label: "Pending", count: allRequests?.filter(r => r.status === "pending").length || 0, icon: Clock, color: "text-slate-400", bg: "bg-slate-500/10" },
              { label: "Failed", count: allRequests?.filter(r => r.status === "failed").length || 0, icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10" },
            ].map(item => {
              const Icon = item.icon;
              const total = allRequests?.length || 1;
              const pct = Math.round((item.count / total) * 100);
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-md ${item.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <span className="text-xs font-medium text-foreground">{item.count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.bg.replace("/10", "/60")}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/60 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Recent Activity</h2>
        </div>
        <div className="divide-y divide-border/40">
          {activityLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : activity?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No activity yet</div>
          ) : (
            activity?.map((log: { id: number; action: string; userId: number | null; entityType: string | null; entityId: number | null; createdAt: Date }) => (
              <div key={log.id} className="p-4 flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <ActivityIcon action={log.action} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-mono text-xs text-primary">{log.action}</span>
                    {log.entityType && (
                      <span className="text-muted-foreground"> on {log.entityType} #{log.entityId}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">User #{log.userId}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(log.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

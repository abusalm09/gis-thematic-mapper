import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DashboardLayout from "./components/DashboardLayout";
import Datasets from "./pages/Datasets";
import MapViewer from "./pages/MapViewer";
import MapRequest from "./pages/MapRequest";
import MapGallery from "./pages/MapGallery";
import MapDetail from "./pages/MapDetail";
import AdminPanel from "./pages/AdminPanel";
import Automation from "./pages/Automation";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/datasets" component={() => <DashboardLayout><Datasets /></DashboardLayout>} />
      <Route path="/map-viewer/:datasetId?" component={() => <DashboardLayout><MapViewer /></DashboardLayout>} />
      <Route path="/map-request" component={() => <DashboardLayout><MapRequest /></DashboardLayout>} />
      <Route path="/gallery" component={() => <DashboardLayout><MapGallery /></DashboardLayout>} />
      <Route path="/gallery/:id" component={() => <DashboardLayout><MapDetail /></DashboardLayout>} />
      <Route path="/automation" component={() => <DashboardLayout><Automation /></DashboardLayout>} />
      <Route path="/admin" component={() => <DashboardLayout><AdminPanel /></DashboardLayout>} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

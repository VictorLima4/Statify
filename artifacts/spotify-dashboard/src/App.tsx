import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/layout/Layout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import TopArtists from "./pages/TopArtists";
import TopTracks from "./pages/TopTracks";
import Genres from "./pages/Genres";
import Activity from "./pages/Activity";
import Insights from "./pages/Insights";
import Wrapped from "./pages/Wrapped";
import Library from "./pages/Library";
import RecentlyPlayed from "./pages/RecentlyPlayed";
import ArtistDetail from "./pages/ArtistDetail";
import AlbumDetail from "./pages/AlbumDetail";
import TrackDetail from "./pages/TrackDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60 * 1000,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/";
    return null;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/artists">{() => <ProtectedRoute component={TopArtists} />}</Route>
      <Route path="/tracks">{() => <ProtectedRoute component={TopTracks} />}</Route>
      <Route path="/genres">{() => <ProtectedRoute component={Genres} />}</Route>
      <Route path="/activity">{() => <ProtectedRoute component={Activity} />}</Route>
      <Route path="/insights">{() => <ProtectedRoute component={Insights} />}</Route>
      <Route path="/wrapped">{() => <ProtectedRoute component={Wrapped} />}</Route>
      <Route path="/library">{() => <ProtectedRoute component={Library} />}</Route>
      <Route path="/recently-played">{() => <ProtectedRoute component={RecentlyPlayed} />}</Route>
      <Route path="/artist/:id">{() => <ProtectedRoute component={ArtistDetail} />}</Route>
      <Route path="/album/:id">{() => <ProtectedRoute component={AlbumDetail} />}</Route>
      <Route path="/track/:id">{() => <ProtectedRoute component={TrackDetail} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

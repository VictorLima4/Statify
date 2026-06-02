import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../../contexts/AuthContext";
import { useLogout, useGetNowPlaying, getGetNowPlayingQueryKey } from "@workspace/api-client-react";
import { 
  LayoutDashboard, 
  Mic2, 
  Music2, 
  PieChart, 
  Activity, 
  Lightbulb, 
  Gift, 
  Library, 
  History,
  LogOut,
  Music
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/";
      }
    });
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/artists", label: "Top Artists", icon: Mic2 },
    { href: "/tracks", label: "Top Tracks", icon: Music2 },
    { href: "/genres", label: "Genres", icon: PieChart },
    { href: "/activity", label: "Activity", icon: Activity },
    { href: "/insights", label: "Insights", icon: Lightbulb },
    { href: "/wrapped", label: "My Wrapped", icon: Gift },
    { href: "/library", label: "Library", icon: Library },
    { href: "/recently-played", label: "Recently Played", icon: History },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col hidden md:flex z-20">
        <div className="p-6 pb-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-2xl font-black tracking-tighter text-primary">
            Statify
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-sidebar-border p-4">
          <SidebarNowPlaying />
          
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="w-9 h-9 border border-sidebar-border">
                <AvatarImage src={user?.images?.[0]?.url} />
                <AvatarFallback>{user?.displayName?.[0]}</AvatarFallback>
              </Avatar>
              <div className="truncate">
                <p className="text-sm font-medium truncate">{user?.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-sidebar-accent"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}

function SidebarNowPlaying() {
  const { data: nowPlaying } = useGetNowPlaying({
    query: { refetchInterval: 10000, queryKey: getGetNowPlayingQueryKey() }
  });

  if (!nowPlaying?.isPlaying || !nowPlaying.track) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/50 text-muted-foreground">
        <Music className="w-8 h-8 opacity-50" />
        <div className="text-xs">
          <p className="font-medium">Nothing playing</p>
          <p className="opacity-70">Start Spotify</p>
        </div>
      </div>
    );
  }

  const track = nowPlaying.track;
  const progressPercent = nowPlaying.progressMs 
    ? (nowPlaying.progressMs / track.durationMs) * 100 
    : 0;

  return (
    <div className="p-3 rounded-lg bg-card border border-border group relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center gap-3 relative z-10">
        <img 
          src={track.album.images[0]?.url} 
          alt={track.album.name} 
          className="w-10 h-10 rounded shadow-sm object-cover"
        />
        <div className="overflow-hidden flex-1">
          <p className="text-sm font-medium text-foreground truncate animate-pulse">
            {track.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {track.artists.map(a => a.name).join(", ")}
          </p>
        </div>
      </div>
      <div className="h-1 w-full bg-secondary mt-3 rounded-full overflow-hidden relative z-10">
        <div 
          className="h-full bg-primary transition-all duration-1000 ease-linear" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

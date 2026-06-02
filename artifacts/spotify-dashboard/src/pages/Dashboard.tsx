import { useGetStats, useGetNowPlaying, getGetNowPlayingQueryKey, useGetTopArtists, useGetTopTracks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Mic2, Disc, PlayCircle, Clock } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: stats } = useGetStats();
  const { data: nowPlaying } = useGetNowPlaying({ query: { refetchInterval: 10000, queryKey: getGetNowPlayingQueryKey() } });
  const { data: topArtists } = useGetTopArtists({ limit: 5, time_range: "short_term" });
  const { data: topTracks } = useGetTopTracks({ limit: 5, time_range: "short_term" });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-4xl font-black tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground text-lg">Your musical universe at a glance.</p>
      </header>

      {nowPlaying?.isPlaying && nowPlaying.track && (
        <Card className="bg-gradient-to-br from-primary/20 to-card border-primary/30 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
             <Music className="w-32 h-32" />
          </div>
          <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 relative z-10">
            <img 
              src={nowPlaying.track.album.images[0]?.url} 
              alt={nowPlaying.track.album.name} 
              className="w-32 h-32 md:w-48 md:h-48 rounded-lg shadow-2xl shadow-black/50 animate-pulse-slow"
            />
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 text-primary font-medium mb-2 uppercase text-xs tracking-widest bg-primary/10 px-3 py-1 rounded-full">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Now Playing on {nowPlaying.device?.name || "Spotify"}
              </div>
              <h2 className="text-3xl md:text-5xl font-black mb-2 tracking-tighter line-clamp-1">{nowPlaying.track.name}</h2>
              <p className="text-xl text-muted-foreground mb-6 line-clamp-1">{nowPlaying.track.artists.map(a => a.name).join(", ")}</p>
              
              <div className="max-w-md mx-auto md:mx-0">
                <div className="flex justify-between text-xs text-muted-foreground mb-2 font-mono">
                  <span>{formatMs(nowPlaying.progressMs || 0)}</span>
                  <span>{formatMs(nowPlaying.track.durationMs)}</span>
                </div>
                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(29,185,84,0.5)]" 
                    style={{ width: `${((nowPlaying.progressMs || 0) / nowPlaying.track.durationMs) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Tracks" value={stats?.savedTracksTotal} icon={Music} />
        <StatCard title="Total Albums" value={stats?.savedAlbumsTotal} icon={Disc} />
        <StatCard title="Followed Artists" value={stats?.followedArtistsTotal} icon={Mic2} />
        <StatCard title="Playlists" value={stats?.playlistsTotal} icon={PlayCircle} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top Artists (4 Weeks)</CardTitle>
            <Link href="/artists" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {topArtists?.map((artist, i) => (
              <Link key={artist.id} href={`/artist/${artist.id}`} className="flex items-center gap-4 group hover:bg-secondary/50 p-2 -mx-2 rounded-md transition-colors">
                <span className="w-4 font-mono text-muted-foreground text-right">{i + 1}</span>
                <img src={artist.images[0]?.url} alt={artist.name} className="w-12 h-12 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate group-hover:text-primary transition-colors">{artist.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{artist.genres.slice(0, 2).join(", ")}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top Tracks (4 Weeks)</CardTitle>
            <Link href="/tracks" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {topTracks?.map((track, i) => (
              <Link key={track.id} href={`/track/${track.id}`} className="flex items-center gap-4 group hover:bg-secondary/50 p-2 -mx-2 rounded-md transition-colors">
                <span className="w-4 font-mono text-muted-foreground text-right">{i + 1}</span>
                <img src={track.album.images[0]?.url} alt={track.name} className="w-12 h-12 rounded shadow-sm object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate group-hover:text-primary transition-colors">{track.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artists.map(a => a.name).join(", ")}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon }: { title: string, value?: number, icon: any }) {
  return (
    <Card className="bg-card hover:bg-secondary/20 transition-colors">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-3xl font-black tracking-tighter mb-1">{value !== undefined ? value.toLocaleString() : "-"}</h3>
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
      </CardContent>
    </Card>
  );
}

function formatMs(ms: number) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

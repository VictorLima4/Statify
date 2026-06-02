import { useState } from "react";
import { useGetTopTracks, GetTopTracksTimeRange } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayCircle } from "lucide-react";

export default function TopTracks() {
  const [timeRange, setTimeRange] = useState<GetTopTracksTimeRange>("short_term");
  const { data: tracks, isLoading } = useGetTopTracks({ time_range: timeRange, limit: 50 });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">Top Tracks</h1>
          <p className="text-muted-foreground text-lg">The songs you have on repeat.</p>
        </div>
        
        <div className="flex bg-secondary/50 p-1 rounded-full w-fit">
          {(["short_term", "medium_term", "long_term"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                timeRange === range 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range === "short_term" ? "4 Weeks" : range === "medium_term" ? "6 Months" : "All Time"}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-2">
              <Skeleton className="w-8 h-8 rounded" />
              <Skeleton className="w-12 h-12 rounded" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-3 w-1/5" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {tracks?.map((track, index) => (
            <Link key={track.id} href={`/track/${track.id}`}>
              <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/30 transition-colors group cursor-pointer">
                <div className={`w-8 text-center font-mono font-bold ${
                  index === 0 ? "text-[#FFD700]" : 
                  index === 1 ? "text-[#C0C0C0]" : 
                  index === 2 ? "text-[#CD7F32]" : 
                  "text-muted-foreground"
                }`}>
                  {index + 1}
                </div>
                
                <div className="relative w-12 h-12 flex-shrink-0">
                  <img 
                    src={track.album.images[0]?.url} 
                    alt={track.album.name} 
                    className="w-full h-full object-cover rounded shadow-sm"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                    <PlayCircle className="w-6 h-6 text-white" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {track.name}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {track.artists.map(a => a.name).join(", ")}
                  </p>
                </div>
                
                <div className="hidden md:block w-1/3 min-w-0 px-4">
                  <p className="text-sm text-muted-foreground truncate hover:underline" onClick={(e) => {
                    e.preventDefault();
                    // Optional: link to album
                  }}>
                    {track.album.name}
                  </p>
                </div>
                
                <div className="text-sm text-muted-foreground font-mono">
                  {Math.floor(track.durationMs / 60000)}:
                  {Math.floor((track.durationMs % 60000) / 1000).toString().padStart(2, "0")}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

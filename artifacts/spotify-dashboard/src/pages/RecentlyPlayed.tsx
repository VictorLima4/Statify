import { useGetRecentlyPlayed } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Clock } from "lucide-react";

export default function RecentlyPlayed() {
  const { data, isLoading } = useGetRecentlyPlayed({ limit: 50 });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-black tracking-tight mb-2">Recently Played</h1>
        <p className="text-muted-foreground text-lg">Your listening trail.</p>
      </header>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Last 50 Tracks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No recently played tracks found.</div>
          ) : (
            <div className="space-y-1">
              {data.map((item: any, i: number) => {
                const track = item.track ?? item;
                const playedAt = item.playedAt ? new Date(item.playedAt) : null;
                return (
                  <div key={`${track.id}-${i}`} className="flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-secondary/50 transition-colors group">
                    <span className="w-5 text-right text-xs text-muted-foreground font-mono flex-shrink-0">{i + 1}</span>
                    <Link href={`/album/${track.album?.id}`} className="flex-shrink-0">
                      <img src={track.album?.images?.[0]?.url} alt={track.name}
                        className="w-12 h-12 rounded object-cover shadow-sm hover:opacity-80 transition-opacity" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/track/${track.id}`}>
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{track.name}</p>
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">
                        {track.artists?.map((a: any, j: number) => (
                          <span key={a.id}>
                            {j > 0 && ", "}
                            <Link href={`/artist/${a.id}`} className="hover:text-primary transition-colors">{a.name}</Link>
                          </span>
                        ))}
                        {track.album?.name && <> · {track.album.name}</>}
                      </p>
                    </div>
                    {playedAt && (
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">{formatRelativeTime(playedAt)}</p>
                        <p className="text-xs text-muted-foreground/60">{playedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatRelativeTime(date: Date) {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

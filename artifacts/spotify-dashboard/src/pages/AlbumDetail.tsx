import { useParams, Link } from "wouter";
import { useGetAlbumDetail, getGetAlbumDetailQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AlbumDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGetAlbumDetail(id!, {
    query: { enabled: !!id, queryKey: getGetAlbumDetailQueryKey(id!) },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data) return null;
  const { album, tracks } = data;
  const coverImage = album.images?.[0]?.url;
  const totalMs = tracks.reduce((sum, t) => sum + t.durationMs, 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/library" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      {/* Hero */}
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-end">
        {coverImage && (
          <img src={coverImage} alt={album.name}
            className="w-48 h-48 rounded-xl object-cover shadow-2xl shadow-black/60 border border-border" />
        )}
        <div className="text-center md:text-left">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">Album</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-3">{album.name}</h1>
          <div className="flex flex-wrap justify-center md:justify-start gap-3 text-sm text-muted-foreground">
            {album.artists.map((a, i) => (
              <Link key={a.id} href={`/artist/${a.id}`}
                className="text-foreground font-semibold hover:text-primary transition-colors">
                {i > 0 && <span className="text-muted-foreground mr-2">·</span>}{a.name}
              </Link>
            ))}
            <span>·</span>
            <span>{album.releaseDate?.split("-")[0]}</span>
            <span>·</span>
            <span>{album.totalTracks} tracks</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatMs(totalMs)}</span>
          </div>
          {album.spotifyUrl && (
            <a href={album.spotifyUrl} target="_blank" rel="noreferrer"
              className="inline-flex mt-4 items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors">
              Open in Spotify
            </a>
          )}
        </div>
      </div>

      {/* Tracklist */}
      <Card className="bg-card">
        <CardHeader><CardTitle>Tracklist</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1">
            {tracks.map((track, i) => (
              <Link key={track.id} href={`/track/${track.id}`}
                className="flex items-center gap-4 px-3 py-2.5 rounded-md hover:bg-secondary/50 transition-colors group">
                <span className="w-5 text-right text-xs text-muted-foreground font-mono">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{track.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artists.map(a => a.name).join(", ")}</p>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{formatMs(track.durationMs)}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatMs(ms: number) {
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor(ms / (1000 * 60));
  const h = Math.floor(ms / (1000 * 60 * 60));
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

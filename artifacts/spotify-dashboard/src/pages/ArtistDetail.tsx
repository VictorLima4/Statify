import { useParams, Link } from "wouter";
import { useGetArtistDetail, getGetArtistDetailQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, Star, Music } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ArtistDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGetArtistDetail(id!, {
    query: { enabled: !!id, queryKey: getGetArtistDetailQueryKey(id!) },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { artist, topTracks, relatedArtists, albums, userRank } = data;
  const image = artist.images?.[0]?.url;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/artists" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Artists
      </Link>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-card border border-border">
        {image && (
          <div className="absolute inset-0 opacity-20">
            <img src={image} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent" />
        <div className="relative z-10 p-8 flex flex-col md:flex-row items-center md:items-end gap-6">
          {image && (
            <img src={image} alt={artist.name} className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover shadow-2xl border-4 border-primary/30" />
          )}
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {artist.genres.slice(0, 3).map(g => (
                <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">{g}</span>
              ))}
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter">{artist.name}</h1>
            <div className="flex flex-wrap gap-6 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="w-4 h-4" />{artist.followers.toLocaleString()} followers</span>
              <span className="flex items-center gap-1"><Star className="w-4 h-4" />Popularity: {artist.popularity}/100</span>
              {userRank && <span className="flex items-center gap-1 text-primary font-semibold">#{userRank} in your top artists</span>}
            </div>
          </div>
          {artist.spotifyUrl && (
            <a href={artist.spotifyUrl} target="_blank" rel="noreferrer"
              className="md:ml-auto flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors">
              Open in Spotify
            </a>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Tracks */}
        <Card className="bg-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><Music className="w-5 h-5 text-primary" /> Top Tracks</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {topTracks.slice(0, 8).map((track, i) => (
              <Link key={track.id} href={`/track/${track.id}`}
                className="flex items-center gap-3 group hover:bg-secondary/50 p-2 -mx-2 rounded-md transition-colors">
                <span className="w-5 text-right text-xs text-muted-foreground font-mono">{i + 1}</span>
                <img src={track.album.images?.[0]?.url} alt={track.name} className="w-10 h-10 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{track.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{formatMs(track.durationMs)}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Albums */}
        <Card className="bg-card">
          <CardHeader><CardTitle>Albums</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {albums.slice(0, 8).map((album) => (
              <Link key={album.id} href={`/album/${album.id}`}
                className="flex items-center gap-3 group hover:bg-secondary/50 p-2 -mx-2 rounded-md transition-colors">
                <img src={album.images?.[0]?.url} alt={album.name} className="w-10 h-10 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{album.name}</p>
                  <p className="text-xs text-muted-foreground">{album.releaseDate?.split("-")[0]} · {album.totalTracks} tracks</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Related Artists */}
      {relatedArtists.length > 0 && (
        <Card className="bg-card">
          <CardHeader><CardTitle>Related Artists</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {relatedArtists.slice(0, 10).map((ra) => (
                <Link key={ra.id} href={`/artist/${ra.id}`}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-secondary/50 transition-colors text-center group">
                  <img src={ra.images?.[0]?.url} alt={ra.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-transparent group-hover:border-primary transition-colors" />
                  <p className="text-xs font-medium truncate w-full group-hover:text-primary transition-colors">{ra.name}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatMs(ms: number) {
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor(ms / (1000 * 60));
  return `${m}:${s.toString().padStart(2, "0")}`;
}

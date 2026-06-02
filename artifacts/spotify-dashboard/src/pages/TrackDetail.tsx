import { useParams, Link } from "wouter";
import { useGetTrackDetail, getGetTrackDetailQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Clock, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TrackDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGetTrackDetail(id!, {
    query: { enabled: !!id, queryKey: getGetTrackDetailQueryKey(id!) },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) return null;
  const { track, audioFeatures } = data;
  const coverImage = track.album?.images?.[0]?.url;

  const features = [
    { label: "Danceability", value: audioFeatures.danceability, color: "#1DB954" },
    { label: "Energy", value: audioFeatures.energy, color: "#FF6B35" },
    { label: "Valence (Mood)", value: audioFeatures.valence, color: "#FFD700" },
    { label: "Acousticness", value: audioFeatures.acousticness, color: "#4FC3F7" },
    { label: "Instrumentalness", value: audioFeatures.instrumentalness, color: "#CE93D8" },
    { label: "Speechiness", value: audioFeatures.speechiness, color: "#80CBC4" },
  ];

  const tempo = audioFeatures.tempo ? Math.round(audioFeatures.tempo) : null;
  const loudness = audioFeatures.loudness ? Math.round(audioFeatures.loudness * 10) / 10 : null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/tracks" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Tracks
      </Link>

      {/* Hero */}
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-end">
        {coverImage && (
          <img src={coverImage} alt={track.album?.name}
            className="w-48 h-48 rounded-xl object-cover shadow-2xl shadow-black/60 border border-border" />
        )}
        <div className="text-center md:text-left">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">Track</p>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter mb-2">{track.name}</h1>
          <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-3">
            {track.artists.map((a, i) => (
              <Link key={a.id} href={`/artist/${a.id}`}
                className="text-foreground font-semibold hover:text-primary transition-colors text-lg">
                {i > 0 && <span className="text-muted-foreground mx-2">·</span>}{a.name}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-muted-foreground">
            {track.album && (
              <Link href={`/album/${track.album.id}`} className="hover:text-primary transition-colors">
                {track.album.name} ({track.album.releaseDate?.split("-")[0]})
              </Link>
            )}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatMs(track.durationMs)}</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3" />Popularity: {track.popularity}/100</span>
            {tempo && <span>{tempo} BPM</span>}
            {loudness != null && <span>{loudness} dB</span>}
          </div>
          {track.spotifyUrl && (
            <a href={track.spotifyUrl} target="_blank" rel="noreferrer"
              className="inline-flex mt-4 items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors">
              Open in Spotify
            </a>
          )}
        </div>
      </div>

      {/* Audio Features */}
      <Card className="bg-card">
        <CardHeader><CardTitle>Audio Features</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {features.map(({ label, value, color }) => (
            <div key={label}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground font-mono">{Math.round(value * 100)}%</span>
              </div>
              <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${value * 100}%`, backgroundColor: color }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function formatMs(ms: number) {
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor(ms / (1000 * 60));
  return `${m}:${s.toString().padStart(2, "0")}`;
}

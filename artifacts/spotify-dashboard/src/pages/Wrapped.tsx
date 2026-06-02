import { useGetWrapped, GenreItem } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Clock, Music, Mic2, Disc } from "lucide-react";
import { ComponentType } from "react";

export default function Wrapped() {
  const { data, isLoading } = useGetWrapped();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-48" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-black tracking-tight mb-2">My Wrapped</h1>
        <p className="text-muted-foreground text-lg">Your personal year in music.</p>
      </header>

      {/* Stats hero */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Minutes Listened" value={data.totalMinutesListened?.toLocaleString() ?? "—"} colorClass="text-primary" bgClass="bg-primary/10" />
        <StatCard icon={Music} label="Top Tracks" value={data.topTracks?.length?.toString() ?? "0"} colorClass="text-[#9b59b6]" bgClass="bg-[#9b59b6]/10" />
        <StatCard icon={Mic2} label="Top Artists" value={data.topArtists?.length?.toString() ?? "0"} colorClass="text-[#FF6B35]" bgClass="bg-[#FF6B35]/10" />
        <StatCard icon={Disc} label="Top Genres" value={data.topGenres?.length?.toString() ?? "0"} colorClass="text-[#4FC3F7]" bgClass="bg-[#4FC3F7]/10" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Artists */}
        {data.topArtists && data.topArtists.length > 0 && (
          <Card className="bg-card">
            <CardHeader><CardTitle className="flex items-center gap-2"><Mic2 className="w-5 h-5 text-primary" /> Top Artists</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.topArtists.slice(0, 5).map((artist, i) => (
                <Link key={artist.id} href={`/artist/${artist.id}`}
                  className="flex items-center gap-4 group hover:bg-secondary/50 p-2 -mx-2 rounded-md transition-colors">
                  <RankBadge rank={i + 1} />
                  <img src={artist.images?.[0]?.url} alt={artist.name} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate group-hover:text-primary transition-colors">{artist.name}</p>
                    <p className="text-xs text-muted-foreground capitalize truncate">{artist.genres?.slice(0, 2).join(", ")}</p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Top Tracks */}
        {data.topTracks && data.topTracks.length > 0 && (
          <Card className="bg-card">
            <CardHeader><CardTitle className="flex items-center gap-2"><Music className="w-5 h-5 text-primary" /> Top Tracks</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.topTracks.slice(0, 5).map((track, i) => (
                <Link key={track.id} href={`/track/${track.id}`}
                  className="flex items-center gap-4 group hover:bg-secondary/50 p-2 -mx-2 rounded-md transition-colors">
                  <RankBadge rank={i + 1} />
                  <img src={track.album?.images?.[0]?.url} alt={track.name} className="w-12 h-12 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate group-hover:text-primary transition-colors">{track.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artists?.map((a) => a.name).join(", ")}</p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top Genres */}
      {data.topGenres && data.topGenres.length > 0 && (
        <Card className="bg-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><Disc className="w-5 h-5 text-primary" /> Top Genres</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {data.topGenres.map((g: GenreItem, i: number) => (
                <span key={g.genre} className="px-4 py-2 rounded-full text-sm font-medium capitalize"
                  style={{
                    backgroundColor: `hsl(${(i * 40) % 360}, 60%, 20%)`,
                    color: `hsl(${(i * 40) % 360}, 80%, 70%)`,
                    border: `1px solid hsl(${(i * 40) % 360}, 60%, 35%)`,
                  }}>
                  {g.genre}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, colorClass, bgClass }: {
  icon: ComponentType<{ className?: string }>,
  label: string,
  value: string,
  colorClass: string,
  bgClass: string,
}) {
  return (
    <Card className="bg-card">
      <CardContent className="p-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${bgClass}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        <p className="text-2xl font-black tracking-tighter">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const color = rank === 1 ? "text-[#FFD700]" : rank === 2 ? "text-[#C0C0C0]" : rank === 3 ? "text-[#CD7F32]" : "text-muted-foreground";
  return (
    <span className={`w-6 text-right text-sm font-bold font-mono ${color}`}>{rank}</span>
  );
}

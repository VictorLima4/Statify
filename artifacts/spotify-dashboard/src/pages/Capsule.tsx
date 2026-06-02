import { useState } from "react";
import { useGetCapsule, getGetCapsuleQueryKey, CapsuleArtist, CapsuleTrack, CapsuleAlbum, CapsuleGenreItem } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Clock, Headphones, Music2, Mic2, Disc3, Tag, ChevronDown, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const ACCENT = "#1DB954";
const MUTED_COLORS = ["#1DB954", "#17a349", "#138a3e", "#0f7134", "#0b592a", "#1ed760", "#20e563", "#22f368", "#19c254", "#15a848"];

function MonthLabel(month: string) {
  const [y, m] = month.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string; sub?: string; color: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="rounded-xl p-3" style={{ background: `${color}18` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-black tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-xs font-black shrink-0">1</span>;
  if (rank === 2) return <span className="w-7 h-7 rounded-full bg-slate-400/20 text-slate-300 flex items-center justify-center text-xs font-black shrink-0">2</span>;
  if (rank === 3) return <span className="w-7 h-7 rounded-full bg-orange-700/20 text-orange-500 flex items-center justify-center text-xs font-black shrink-0">3</span>;
  return <span className="w-7 h-7 rounded-full bg-muted/40 text-muted-foreground flex items-center justify-center text-xs font-bold shrink-0">{rank}</span>;
}

function ArtistRow({ artist, rank }: { artist: CapsuleArtist; rank: number }) {
  return (
    <Link href={`/artist/${artist.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group">
      <RankBadge rank={rank} />
      {artist.imageUrl
        ? <img src={artist.imageUrl} alt={artist.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
        : <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0"><Mic2 className="w-4 h-4 text-muted-foreground" /></div>
      }
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{artist.name}</p>
        <p className="text-xs text-muted-foreground">{artist.minutesListened} min listened</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-foreground">{artist.streams.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">streams</p>
      </div>
    </Link>
  );
}

function TrackRow({ track, rank }: { track: CapsuleTrack; rank: number }) {
  return (
    <Link href={`/track/${track.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group">
      <RankBadge rank={rank} />
      {track.imageUrl
        ? <img src={track.imageUrl} alt={track.albumName} className="w-10 h-10 rounded-md object-cover shrink-0" />
        : <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0"><Music2 className="w-4 h-4 text-muted-foreground" /></div>
      }
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{track.name}</p>
        <p className="text-xs text-muted-foreground truncate">{track.artistName} · {track.albumName}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold">{track.streams.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{track.minutesListened} min</p>
      </div>
    </Link>
  );
}

function AlbumRow({ album, rank }: { album: CapsuleAlbum; rank: number }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
      <RankBadge rank={rank} />
      {album.imageUrl
        ? <img src={album.imageUrl} alt={album.name} className="w-10 h-10 rounded-md object-cover shrink-0" />
        : <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0"><Disc3 className="w-4 h-4 text-muted-foreground" /></div>
      }
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{album.name}</p>
        <p className="text-xs text-muted-foreground truncate">{album.artistName}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold">{album.streams.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{album.minutesListened} min</p>
      </div>
    </div>
  );
}

function GenreBar({ genres }: { genres: CapsuleGenreItem[] }) {
  if (!genres.length) return <p className="text-muted-foreground text-sm text-center py-8">No genre data available</p>;
  const max = genres[0].streams;
  return (
    <div className="space-y-2.5">
      {genres.map((g, i) => (
        <div key={g.genre} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium capitalize">{g.genre}</span>
              <span className="text-xs text-muted-foreground">{g.streams} streams</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(g.streams / max) * 100}%`, background: MUTED_COLORS[i % MUTED_COLORS.length] }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Capsule() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const { data, isLoading } = useGetCapsule(
    { month: selectedMonth },
    { query: { queryKey: getGetCapsuleQueryKey({ month: selectedMonth }) } }
  );

  const availableMonths = data?.availableMonths ?? [];
  const hasData = (data?.totalStreams ?? 0) > 0;

  // Build month options: available months from DB + current month
  const monthOptions = Array.from(new Set([defaultMonth, ...availableMonths])).sort((a, b) => b.localeCompare(a));

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-96" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">Sound Capsule</h1>
          <p className="text-muted-foreground text-lg">Your monthly music breakdown — deeper than Wrapped.</p>
        </div>

        {/* Month Picker */}
        <div className="relative">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="appearance-none bg-card border border-border rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[180px]"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>{MonthLabel(m)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </header>

      {/* No data state */}
      {!hasData && (
        <Card className="bg-card border-border">
          <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground" />
            <div>
              <p className="font-semibold text-lg">No listening data for {MonthLabel(selectedMonth)}</p>
              <p className="text-muted-foreground text-sm mt-1">
                Listening history is built from your recently played tracks. Keep using the app and data will appear here.
                {availableMonths.length > 0 && " Try a month where you have data."}
              </p>
            </div>
            {availableMonths.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {availableMonths.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMonth(m)}
                    className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-full transition-colors font-medium"
                  >
                    {MonthLabel(m)}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>
          {/* Stats Hero */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Clock} label="Minutes Listened" value={data!.totalMinutes.toLocaleString()} color={ACCENT} />
            <StatCard icon={Headphones} label="Total Streams" value={data!.totalStreams.toLocaleString()} color="#9b59b6" />
            <StatCard icon={Mic2} label="Artists Played" value={data!.topArtists.length.toString()} sub="tracked in top 10" color="#FF6B35" />
            <StatCard icon={Music2} label="Unique Tracks" value={data!.topTracks.length.toString()} sub="tracked in top 10" color="#4FC3F7" />
          </div>

          {/* Top 10 Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Artists */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mic2 className="w-5 h-5 text-primary" />
                  Top 10 Artists
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {data!.topArtists.length === 0
                  ? <p className="text-muted-foreground text-sm py-6 text-center">No artist data</p>
                  : data!.topArtists.map((artist, i) => <ArtistRow key={artist.id} artist={artist} rank={i + 1} />)
                }
              </CardContent>
            </Card>

            {/* Top Tracks */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Music2 className="w-5 h-5 text-primary" />
                  Top 10 Songs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {data!.topTracks.length === 0
                  ? <p className="text-muted-foreground text-sm py-6 text-center">No track data</p>
                  : data!.topTracks.map((track, i) => <TrackRow key={track.id} track={track} rank={i + 1} />)
                }
              </CardContent>
            </Card>

            {/* Top Albums */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Disc3 className="w-5 h-5 text-primary" />
                  Top 10 Albums
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {data!.topAlbums.length === 0
                  ? <p className="text-muted-foreground text-sm py-6 text-center">No album data</p>
                  : data!.topAlbums.map((album, i) => <AlbumRow key={album.id} album={album} rank={i + 1} />)
                }
              </CardContent>
            </Card>

            {/* Top Genres */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Tag className="w-5 h-5 text-primary" />
                  Top 10 Genres
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <GenreBar genres={data!.topGenres} />
              </CardContent>
            </Card>
          </div>

          {/* Listening breakdown bar chart */}
          {data!.topArtists.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Minutes per Artist
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data!.topArtists.map(a => ({ name: a.name.length > 12 ? a.name.slice(0, 12) + "…" : a.name, minutes: a.minutesListened, streams: a.streams }))} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                    <XAxis dataKey="name" tick={{ fill: "#B3B3B3", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#B3B3B3", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#181818", border: "1px solid #282828", borderRadius: 8 }}
                      itemStyle={{ color: "#B3B3B3" }}
                      formatter={(val: number, name: string) => [name === "minutes" ? `${val} min` : `${val} streams`, name === "minutes" ? "Minutes" : "Streams"]}
                    />
                    <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                      {data!.topArtists.map((_, i) => <Cell key={i} fill={i === 0 ? ACCENT : "#282828"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

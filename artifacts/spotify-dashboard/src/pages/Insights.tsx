import { useGetInsights, InsightsData } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Calendar, Mic2, Music2, Clock, Disc, Star } from "lucide-react";
import { Link } from "wouter";
import { ComponentType } from "react";

interface Highlight {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  image?: string;
  href?: string;
  color: string;
}

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  artist: Mic2,
  track: Music2,
  genre: Disc,
  time: Clock,
  calendar: Calendar,
  trophy: Trophy,
};

export default function Insights() {
  const { data, isLoading } = useGetInsights();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-10 w-48" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  const buildHighlights = (d: InsightsData): Highlight[] => {
    const result: Highlight[] = [];

    if (d.allTimeTopArtist) {
      result.push({
        icon: Trophy,
        label: "All-Time Favorite Artist",
        value: d.allTimeTopArtist.name,
        image: d.allTimeTopArtist.images?.[0]?.url,
        href: `/artist/${d.allTimeTopArtist.id}`,
        color: "#FFD700",
      });
    }
    if (d.monthTopArtist) {
      result.push({
        icon: Star,
        label: "This Month's Top Artist",
        value: d.monthTopArtist.name,
        image: d.monthTopArtist.images?.[0]?.url,
        href: `/artist/${d.monthTopArtist.id}`,
        color: "#1DB954",
      });
    }
    if (d.mostPlayedTrack) {
      result.push({
        icon: Music2,
        label: "Most Played Track",
        value: d.mostPlayedTrack.name,
        sub: d.mostPlayedTrack.artists?.map((a) => a.name).join(", "),
        image: d.mostPlayedTrack.album?.images?.[0]?.url,
        href: `/track/${d.mostPlayedTrack.id}`,
        color: "#9b59b6",
      });
    }
    if (d.dominantGenre) {
      result.push({ icon: Disc, label: "Dominant Genre", value: d.dominantGenre, color: "#FF6B35" });
    }
    if (d.mostActiveHour != null) {
      result.push({ icon: Clock, label: "Most Active Hour", value: formatHour(d.mostActiveHour), color: "#4FC3F7" });
    }
    if (d.favoriteDecade) {
      result.push({ icon: Calendar, label: "Favorite Decade", value: d.favoriteDecade, color: "#CE93D8" });
    }

    return result;
  };

  const highlights = data ? buildHighlights(data) : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-black tracking-tight mb-2">Insights</h1>
        <p className="text-muted-foreground text-lg">What your listening history says about you.</p>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {highlights.map((item, i) => {
          const Icon = item.icon;
          const isArtistLink = item.href?.startsWith("/artist");
          const cardEl = (
            <Card className="bg-card border border-border hover:border-primary/40 transition-colors group h-full">
              <CardContent className="p-5 flex items-start gap-4 h-full">
                <div className="relative flex-shrink-0">
                  {item.image ? (
                    <img src={item.image} alt={item.value}
                      className={`w-14 h-14 object-cover shadow-lg ${isArtistLink ? "rounded-full" : "rounded-lg"}`} />
                  ) : (
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: item.color + "22", color: item.color }}>
                      <Icon className="w-7 h-7" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: item.color }}>
                    {item.label}
                  </p>
                  <p className="text-xl font-bold leading-tight capitalize group-hover:text-primary transition-colors">
                    {item.value}
                  </p>
                  {item.sub && <p className="text-sm text-muted-foreground mt-0.5 truncate">{item.sub}</p>}
                </div>
              </CardContent>
            </Card>
          );

          return item.href ? (
            <Link key={i} href={item.href}>{cardEl}</Link>
          ) : (
            <div key={i}>{cardEl}</div>
          );
        })}
      </div>

      {data?.insights && data.insights.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">More Insights</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {data.insights.map((insight, i) => {
              const Icon = iconMap[insight.emoji] ?? Star;
              return (
                <Card key={i} className="bg-card">
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold mb-0.5">{insight.title}</p>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatHour(hour: number) {
  if (hour === 0) return "12:00 AM";
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return "12:00 PM";
  return `${hour - 12}:00 PM`;
}

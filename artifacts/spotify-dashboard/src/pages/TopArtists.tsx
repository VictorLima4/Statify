import { useState } from "react";
import { useGetTopArtists, GetTopArtistsTimeRange } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TopArtists() {
  const [timeRange, setTimeRange] = useState<GetTopArtistsTimeRange>("short_term");
  const { data: artists, isLoading } = useGetTopArtists({ time_range: timeRange, limit: 50 });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">Top Artists</h1>
          <p className="text-muted-foreground text-lg">Who you've been listening to the most.</p>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="w-full aspect-square rounded-full" />
              <Skeleton className="h-4 w-3/4 mx-auto" />
              <Skeleton className="h-3 w-1/2 mx-auto" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {artists?.map((artist, index) => (
            <Link key={artist.id} href={`/artist/${artist.id}`}>
              <Card className="bg-transparent border-none shadow-none hover:bg-secondary/20 transition-colors group cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col items-center text-center space-y-4">
                  <div className="relative w-full aspect-square mb-2">
                    <img 
                      src={artist.images[0]?.url} 
                      alt={artist.name} 
                      className="w-full h-full object-cover rounded-full shadow-lg group-hover:shadow-xl transition-shadow"
                    />
                    <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 border-background shadow-sm ${
                      index === 0 ? "bg-[#FFD700] text-black" : 
                      index === 1 ? "bg-[#C0C0C0] text-black" : 
                      index === 2 ? "bg-[#CD7F32] text-black" : 
                      "bg-secondary text-foreground"
                    }`}>
                      {index + 1}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-1">{artist.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1 capitalize">
                      {artist.genres.slice(0, 2).join(", ")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useGetGenreDistribution } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#1DB954", "#9b59b6", "#FF6B35", "#4FC3F7", "#FFD700", "#CE93D8", "#80CBC4", "#FF8A65", "#AED581", "#F48FB1"];

type TimeRange = "short_term" | "medium_term" | "long_term";

export default function Genres() {
  const [timeRange, setTimeRange] = useState<TimeRange>("medium_term");
  const { data, isLoading } = useGetGenreDistribution({ time_range: timeRange });

  const ranges: { value: TimeRange; label: string }[] = [
    { value: "short_term", label: "4 Weeks" },
    { value: "medium_term", label: "6 Months" },
    { value: "long_term", label: "All Time" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">Genres</h1>
          <p className="text-muted-foreground text-lg">Your musical taste in numbers.</p>
        </div>
        <div className="flex bg-secondary/50 p-1 rounded-full w-fit">
          {ranges.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                timeRange === value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No genre data available.</div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-card">
              <CardHeader><CardTitle>Genre Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={data.slice(0, 10)} dataKey="count" nameKey="genre" cx="50%" cy="50%" innerRadius={70} outerRadius={120} paddingAngle={3}>
                      {data.slice(0, 10).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#181818", border: "1px solid #282828", borderRadius: 8 }}
                      itemStyle={{ color: "#B3B3B3" }}
                      formatter={(val: number) => [val, "artists"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {data.slice(0, 10).map((g, i) => (
                    <div key={g.genre} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground truncate capitalize">{g.genre}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader><CardTitle>Top Genres by Artist Count</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={data.slice(0, 12)} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="genre" width={110} tick={{ fill: "#B3B3B3", fontSize: 12 }}
                      tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + "…" : v} />
                    <Tooltip
                      contentStyle={{ background: "#181818", border: "1px solid #282828", borderRadius: 8 }}
                      itemStyle={{ color: "#B3B3B3" }}
                      formatter={(val: number) => [val, "artists"]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {data.slice(0, 12).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card">
            <CardHeader><CardTitle>All Genres</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.map((g, i) => (
                  <div key={g.genre} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors">
                    <span className="text-xs font-mono text-muted-foreground w-5 text-right">{i + 1}</span>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-medium capitalize truncate">{g.genre}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{g.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

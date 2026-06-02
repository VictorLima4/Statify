import { useGetListeningActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from "recharts";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Activity() {
  const { data, isLoading } = useGetListeningActivity();

  const tooltipStyle = {
    contentStyle: { background: "#181818", border: "1px solid #282828", borderRadius: 8 },
    itemStyle: { color: "#B3B3B3" },
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-10 w-64" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const byHour = data?.byHour?.map((bucket, i) => ({
    hour: bucket.label ?? (i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`),
    plays: bucket.count,
  })) ?? [];

  const byDay = data?.byDayOfWeek?.map((bucket, i) => ({
    day: bucket.label ?? DAYS[i],
    plays: bucket.count,
  })) ?? [];

  const byMonth = data?.byMonth?.map((bucket, i) => ({
    month: bucket.label ?? MONTHS[i],
    plays: bucket.count,
  })) ?? [];

  const timeline = data?.timeline?.map(point => ({
    date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    plays: point.count,
  })) ?? [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-black tracking-tight mb-2">Activity</h1>
        <p className="text-muted-foreground text-lg">When do you listen the most?</p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-card">
          <CardHeader><CardTitle>By Time of Day</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byHour} margin={{ left: -16 }}>
                <XAxis dataKey="hour" tick={{ fill: "#B3B3B3", fontSize: 10 }} interval={2} />
                <YAxis tick={{ fill: "#B3B3B3", fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(val: number) => [val, "plays"]} />
                <Bar dataKey="plays" fill="#1DB954" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader><CardTitle>By Day of Week</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byDay} margin={{ left: -16 }}>
                <XAxis dataKey="day" tick={{ fill: "#B3B3B3", fontSize: 12 }} />
                <YAxis tick={{ fill: "#B3B3B3", fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(val: number) => [val, "plays"]} />
                <Bar dataKey="plays" fill="#9b59b6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card">
        <CardHeader><CardTitle>By Month</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byMonth} margin={{ left: -16 }}>
              <XAxis dataKey="month" tick={{ fill: "#B3B3B3", fontSize: 12 }} />
              <YAxis tick={{ fill: "#B3B3B3", fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(val: number) => [val, "plays"]} />
              <Bar dataKey="plays" fill="#FF6B35" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {timeline.length > 0 && (
        <Card className="bg-card">
          <CardHeader><CardTitle>Listening Timeline</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={timeline} margin={{ left: -16 }}>
                <defs>
                  <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1DB954" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#1DB954" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#282828" />
                <XAxis dataKey="date" tick={{ fill: "#B3B3B3", fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#B3B3B3", fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(val: number) => [val, "plays"]} />
                <Area type="monotone" dataKey="plays" stroke="#1DB954" strokeWidth={2} fill="url(#activityGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

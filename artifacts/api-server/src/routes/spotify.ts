import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  spotifyFetch,
  mapArtist,
  mapTrack,
  mapAlbum,
  type SpotifyApiArtist,
  type SpotifyApiTrack,
  type SpotifyApiAlbum,
} from "../lib/spotify";
import { db, listeningHistoryTable, usersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

router.use("/spotify", requireAuth);

// Now Playing
router.get("/spotify/now-playing", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  try {
    const data = await spotifyFetch<any>(userId, "/me/player/currently-playing");
    if (!data || !data.item) {
      res.json({ isPlaying: false });
      return;
    }
    res.json({
      isPlaying: data.is_playing,
      progressMs: data.progress_ms ?? null,
      track: mapTrack(data.item),
      device: data.device
        ? { name: data.device.name, type: data.device.type, isActive: data.device.is_active }
        : null,
    });
  } catch {
    res.json({ isPlaying: false });
  }
});

// Top Artists
router.get("/spotify/top-artists", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { time_range = "medium_term", limit = "50" } = req.query as Record<string, string>;
  const data = await spotifyFetch<{ items: SpotifyApiArtist[] }>(
    userId,
    `/me/top/artists?time_range=${time_range}&limit=${Math.min(Number(limit), 50)}`
  );
  res.json((data.items ?? []).map((a, i) => mapArtist(a, i + 1)));
});

// Top Tracks
router.get("/spotify/top-tracks", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { time_range = "medium_term", limit = "50" } = req.query as Record<string, string>;
  const data = await spotifyFetch<{ items: SpotifyApiTrack[] }>(
    userId,
    `/me/top/tracks?time_range=${time_range}&limit=${Math.min(Number(limit), 50)}`
  );
  res.json((data.items ?? []).map((t, i) => mapTrack(t, i + 1)));
});

// Recently Played
router.get("/spotify/recently-played", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { limit = "50" } = req.query as Record<string, string>;
  const data = await spotifyFetch<{ items: { track: SpotifyApiTrack; played_at: string }[] }>(
    userId,
    `/me/player/recently-played?limit=${Math.min(Number(limit), 50)}`
  );
  const items = (data.items ?? []).map((item) => ({
    track: mapTrack(item.track),
    playedAt: item.played_at,
  }));
  res.json(items);
});

// Playlists
router.get("/spotify/playlists", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { limit = "50" } = req.query as Record<string, string>;
  const [meData, data] = await Promise.all([
    spotifyFetch<any>(userId, "/me"),
    spotifyFetch<{ items: any[] }>(userId, `/me/playlists?limit=${Math.min(Number(limit), 50)}`),
  ]);
  const mySpotifyId = meData?.id ?? userId;
  const items = (data.items ?? []).map((pl) => ({
    id: pl.id,
    name: pl.name,
    description: pl.description ?? null,
    owner: pl.owner?.display_name ?? pl.owner?.id ?? "",
    tracksTotal: pl.tracks?.total ?? 0,
    images: (pl.images ?? []).map((img: any) => ({ url: img.url, width: img.width ?? null, height: img.height ?? null })),
    spotifyUrl: pl.external_urls?.spotify ?? "",
    isOwned: pl.owner?.id === mySpotifyId,
  }));
  res.json(items);
});

// Saved Tracks
router.get("/spotify/saved-tracks", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { limit = "50", offset = "0" } = req.query as Record<string, string>;
  const data = await spotifyFetch<{ total: number; items: { track: SpotifyApiTrack }[] }>(
    userId,
    `/me/tracks?limit=${Math.min(Number(limit), 50)}&offset=${Number(offset)}`
  );
  res.json({
    total: data.total ?? 0,
    items: (data.items ?? []).map((item) => mapTrack(item.track)),
  });
});

// Saved Albums
router.get("/spotify/saved-albums", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { limit = "50", offset = "0" } = req.query as Record<string, string>;
  const data = await spotifyFetch<{ total: number; items: { album: SpotifyApiAlbum }[] }>(
    userId,
    `/me/albums?limit=${Math.min(Number(limit), 50)}&offset=${Number(offset)}`
  );
  res.json({
    total: data.total ?? 0,
    items: (data.items ?? []).map((item) => mapAlbum(item.album)),
  });
});

// Followed Artists
router.get("/spotify/followed-artists", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const data = await spotifyFetch<{ artists: { items: SpotifyApiArtist[]; total: number } }>(
    userId,
    "/me/following?type=artist&limit=50"
  );
  res.json((data.artists?.items ?? []).map((a) => mapArtist(a)));
});

// Genre Distribution
router.get("/spotify/genres", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { time_range = "medium_term" } = req.query as Record<string, string>;
  const data = await spotifyFetch<{ items: SpotifyApiArtist[] }>(
    userId,
    `/me/top/artists?time_range=${time_range}&limit=50`
  );
  const genreCount: Record<string, number> = {};
  for (const artist of data.items ?? []) {
    for (const genre of artist.genres ?? []) {
      genreCount[genre] = (genreCount[genre] ?? 0) + 1;
    }
  }
  const total = Object.values(genreCount).reduce((s, c) => s + c, 0);
  const sorted = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([genre, count]) => ({
      genre,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }));
  res.json(sorted);
});

// Stats overview
router.get("/spotify/stats", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const [
    topArtistsShortData,
    topArtistsMediumData,
    topArtistsLongData,
    topTracksShortData,
    topTracksMediumData,
    topTracksLongData,
    savedTracksData,
    savedAlbumsData,
    followedData,
    playlistsData,
    recentData,
  ] = await Promise.all([
    spotifyFetch<{ items: SpotifyApiArtist[] }>(userId, "/me/top/artists?time_range=short_term&limit=50"),
    spotifyFetch<{ items: SpotifyApiArtist[] }>(userId, "/me/top/artists?time_range=medium_term&limit=50"),
    spotifyFetch<{ items: SpotifyApiArtist[] }>(userId, "/me/top/artists?time_range=long_term&limit=50"),
    spotifyFetch<{ items: SpotifyApiTrack[] }>(userId, "/me/top/tracks?time_range=short_term&limit=50"),
    spotifyFetch<{ items: SpotifyApiTrack[] }>(userId, "/me/top/tracks?time_range=medium_term&limit=50"),
    spotifyFetch<{ items: SpotifyApiTrack[] }>(userId, "/me/top/tracks?time_range=long_term&limit=50"),
    spotifyFetch<{ total: number }>(userId, "/me/tracks?limit=1"),
    spotifyFetch<{ total: number }>(userId, "/me/albums?limit=1"),
    spotifyFetch<{ artists: { total: number } }>(userId, "/me/following?type=artist&limit=1"),
    spotifyFetch<{ total: number }>(userId, "/me/playlists?limit=1"),
    spotifyFetch<{ items: any[] }>(userId, "/me/player/recently-played?limit=50"),
  ]);

  const topArtistsLong = (topArtistsLongData.items ?? []).map((a, i) => mapArtist(a, i + 1));
  const topTracksLong = (topTracksLongData.items ?? []).map((t, i) => mapTrack(t, i + 1));
  const recentItems = recentData.items ?? [];

  const uniqueArtists = new Set<string>();
  const uniqueAlbums = new Set<string>();
  for (const item of recentItems) {
    if (item.track?.artists) for (const a of item.track.artists) uniqueArtists.add(a.id);
    if (item.track?.album) uniqueAlbums.add(item.track.album.id);
  }
  for (const a of topArtistsLong) uniqueArtists.add(a.id);
  for (const t of topTracksLong) {
    uniqueAlbums.add(t.album.id);
    for (const a of t.artists) uniqueArtists.add(a.id);
  }

  const allGenres = new Set<string>();
  for (const a of topArtistsLong) for (const g of a.genres) allGenres.add(g);

  const estimatedMinutes = recentItems.reduce((sum: number, item: any) => sum + (item.track?.duration_ms ?? 0), 0) / 60000;

  res.json({
    topArtistsShort: (topArtistsShortData.items ?? []).map((a, i) => mapArtist(a, i + 1)),
    topArtistsMedium: (topArtistsMediumData.items ?? []).map((a, i) => mapArtist(a, i + 1)),
    topArtistsLong,
    topTracksShort: (topTracksShortData.items ?? []).map((t, i) => mapTrack(t, i + 1)),
    topTracksMedium: (topTracksMediumData.items ?? []).map((t, i) => mapTrack(t, i + 1)),
    topTracksLong,
    savedTracksTotal: savedTracksData.total ?? 0,
    savedAlbumsTotal: savedAlbumsData.total ?? 0,
    followedArtistsTotal: followedData.artists?.total ?? 0,
    playlistsTotal: playlistsData.total ?? 0,
    recentTracksCount: recentItems.length,
    uniqueArtistsCount: uniqueArtists.size,
    uniqueAlbumsCount: uniqueAlbums.size,
    uniqueGenresCount: allGenres.size,
    estimatedMinutesListened: Math.round(estimatedMinutes),
  });
});

// Insights
router.get("/spotify/insights", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const [
    topArtistsMedium,
    topArtistsShort,
    topTracksLong,
    recentData,
  ] = await Promise.all([
    spotifyFetch<{ items: SpotifyApiArtist[] }>(userId, "/me/top/artists?time_range=medium_term&limit=50"),
    spotifyFetch<{ items: SpotifyApiArtist[] }>(userId, "/me/top/artists?time_range=short_term&limit=5"),
    spotifyFetch<{ items: SpotifyApiTrack[] }>(userId, "/me/top/tracks?time_range=long_term&limit=50"),
    spotifyFetch<{ items: { track: SpotifyApiTrack; played_at: string }[] }>(userId, "/me/player/recently-played?limit=50"),
  ]);

  const allTimeTopArtist = mapArtist((topArtistsMedium.items ?? [])[0] ?? (topArtistsShort.items ?? [])[0]);
  const monthTopArtist = mapArtist((topArtistsShort.items ?? [])[0]);
  const mostPlayedTrack = mapTrack((topTracksLong.items ?? [])[0]);
  const mostPlayedAlbum = topTracksLong.items?.[0]?.album ? mapAlbum(topTracksLong.items[0].album) : null;

  const genreCount: Record<string, number> = {};
  for (const artist of topArtistsMedium.items ?? []) {
    for (const genre of artist.genres ?? []) {
      genreCount[genre] = (genreCount[genre] ?? 0) + 1;
    }
  }
  const dominantGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";

  const hourCount: Record<number, number> = {};
  const dayCount: Record<number, number> = {};
  const monthCount: Record<number, number> = {};
  for (const item of recentData.items ?? []) {
    const d = new Date(item.played_at);
    const h = d.getHours();
    const day = d.getDay();
    const month = d.getMonth();
    hourCount[h] = (hourCount[h] ?? 0) + 1;
    dayCount[day] = (dayCount[day] ?? 0) + 1;
    monthCount[month] = (monthCount[month] ?? 0) + 1;
  }

  const mostActiveHour = Number(Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 20);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const mostActiveDayOfWeek = dayNames[Number(Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 5)];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const mostActiveMonth = monthNames[Number(Object.entries(monthCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0)];

  // Decade from release dates
  const decadeCount: Record<string, number> = {};
  for (const track of topTracksLong.items ?? []) {
    const year = parseInt(track.album.release_date?.split("-")[0] ?? "0");
    if (year > 0) {
      const decade = `${Math.floor(year / 10) * 10}s`;
      decadeCount[decade] = (decadeCount[decade] ?? 0) + 1;
    }
  }
  const favoriteDecade = Object.entries(decadeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "2010s";

  const insights = [
    { title: "Top Genre", description: `${dominantGenre} dominates your listening habits`, emoji: "🎵" },
    { title: "Most Active Time", description: `You listen most around ${mostActiveHour}:00`, emoji: "⏰" },
    { title: "Favorite Day", description: `${mostActiveDayOfWeek} is your most musical day`, emoji: "📅" },
    { title: "Decade Fan", description: `The ${favoriteDecade} era resonates most with you`, emoji: "🕰️" },
    { title: "Top Artist", description: `${allTimeTopArtist.name} is your most listened artist`, emoji: "🌟" },
  ];

  res.json({
    allTimeTopArtist,
    monthTopArtist,
    mostPlayedTrack,
    mostPlayedAlbum,
    dominantGenre,
    mostActiveHour,
    mostActiveDayOfWeek,
    mostActiveMonth,
    favoriteDecade,
    insights,
  });
});

// Wrapped
router.get("/spotify/wrapped", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  const [topArtists, topTracks, recentData] = await Promise.all([
    spotifyFetch<{ items: SpotifyApiArtist[] }>(userId, "/me/top/artists?time_range=long_term&limit=10"),
    spotifyFetch<{ items: SpotifyApiTrack[] }>(userId, "/me/top/tracks?time_range=long_term&limit=10"),
    spotifyFetch<{ items: { track: SpotifyApiTrack; played_at: string }[] }>(userId, "/me/player/recently-played?limit=50"),
  ]);

  const genreCount: Record<string, number> = {};
  for (const artist of topArtists.items ?? []) {
    for (const genre of artist.genres ?? []) {
      genreCount[genre] = (genreCount[genre] ?? 0) + 1;
    }
  }
  const total = Object.values(genreCount).reduce((s, c) => s + c, 0);
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, count]) => ({ genre, count, percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 }));

  // Albums from top tracks
  const albumMap = new Map<string, SpotifyApiAlbum>();
  for (const t of topTracks.items ?? []) {
    if (!albumMap.has(t.album.id)) albumMap.set(t.album.id, t.album);
  }
  const topAlbums = [...albumMap.values()].slice(0, 5).map(mapAlbum);

  const totalMs = (recentData.items ?? []).reduce((sum, item) => sum + (item.track?.duration_ms ?? 0), 0);
  const totalMinutes = Math.round(totalMs / 60000);

  res.json({
    year,
    topArtists: (topArtists.items ?? []).slice(0, 5).map((a, i) => mapArtist(a, i + 1)),
    topTracks: (topTracks.items ?? []).slice(0, 5).map((t, i) => mapTrack(t, i + 1)),
    topGenres,
    topAlbums,
    totalMinutesListened: totalMinutes,
    newDiscoveries: Math.floor((topArtists.items?.length ?? 0) * 0.3),
    minutesPerDay: totalMinutes > 0 ? Math.round((totalMinutes / 30) * 10) / 10 : null,
  });
});

// Artist Detail
router.get("/spotify/artist/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [artist, topTracksData, relatedData, albumsData] = await Promise.all([
    spotifyFetch<SpotifyApiArtist>(userId, `/artists/${rawId}`),
    spotifyFetch<{ tracks: SpotifyApiTrack[] }>(userId, `/artists/${rawId}/top-tracks?market=from_token`),
    spotifyFetch<{ artists: SpotifyApiArtist[] }>(userId, `/artists/${rawId}/related-artists`),
    spotifyFetch<{ items: SpotifyApiAlbum[] }>(userId, `/artists/${rawId}/albums?limit=20&include_groups=album,single`),
  ]);

  // check user's top artists rank
  const topData = await spotifyFetch<{ items: SpotifyApiArtist[] }>(userId, "/me/top/artists?time_range=long_term&limit=50");
  const userRank = (topData.items ?? []).findIndex((a) => a.id === rawId);

  res.json({
    artist: mapArtist(artist),
    topTracks: (topTracksData.tracks ?? []).slice(0, 10).map((t) => mapTrack(t)),
    relatedArtists: (relatedData.artists ?? []).slice(0, 10).map((a) => mapArtist(a)),
    albums: (albumsData.items ?? []).slice(0, 10).map(mapAlbum),
    userRank: userRank >= 0 ? userRank + 1 : null,
  });
});

// Album Detail
router.get("/spotify/album/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const album = await spotifyFetch<SpotifyApiAlbum & { tracks: { items: any[] } }>(userId, `/albums/${rawId}`);
  const tracks = (album.tracks?.items ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    artists: t.artists.map((a: any) => ({ id: a.id, name: a.name })),
    album: mapAlbum(album),
    durationMs: t.duration_ms,
    popularity: 0,
    spotifyUrl: t.external_urls?.spotify ?? "",
    previewUrl: t.preview_url ?? null,
    rank: null,
  }));
  res.json({ album: mapAlbum(album), tracks });
});

// Track Detail
router.get("/spotify/track/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [track, features] = await Promise.all([
    spotifyFetch<SpotifyApiTrack>(userId, `/tracks/${rawId}`),
    spotifyFetch<any>(userId, `/audio-features/${rawId}`).catch(() => null),
  ]);
  res.json({
    track: mapTrack(track),
    audioFeatures: features
      ? {
          danceability: features.danceability ?? 0,
          energy: features.energy ?? 0,
          valence: features.valence ?? 0,
          tempo: features.tempo ?? 0,
          acousticness: features.acousticness ?? 0,
          instrumentalness: features.instrumentalness ?? 0,
          speechiness: features.speechiness ?? 0,
          loudness: features.loudness ?? 0,
        }
      : { danceability: 0, energy: 0, valence: 0, tempo: 0, acousticness: 0, instrumentalness: 0, speechiness: 0, loudness: 0 },
  });
});

// Sync
router.post("/spotify/sync", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  try {
    const recentData = await spotifyFetch<{ items: { track: SpotifyApiTrack; played_at: string }[] }>(
      userId,
      "/me/player/recently-played?limit=50"
    );
    const items = recentData.items ?? [];

    for (const item of items) {
      const t = item.track;
      if (!t) continue;
      await db
        .insert(listeningHistoryTable)
        .values({
          userId,
          trackId: t.id,
          trackName: t.name,
          artistId: t.artists[0]?.id ?? "",
          artistName: t.artists[0]?.name ?? "",
          albumId: t.album.id,
          albumName: t.album.name,
          albumImageUrl: t.album.images?.[0]?.url ?? null,
          durationMs: t.duration_ms,
          playedAt: new Date(item.played_at),
        })
        .onConflictDoNothing();
    }

    res.json({ success: true, message: `Synced ${items.length} recent tracks` });
  } catch (err) {
    req.log.error({ err }, "Sync error");
    res.json({ success: false, message: "Sync failed" });
  }
});

// Listening Activity
router.get("/spotify/activity", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const recentData = await spotifyFetch<{ items: { track: SpotifyApiTrack; played_at: string }[] }>(
    userId,
    "/me/player/recently-played?limit=50"
  );
  const items = recentData.items ?? [];

  const byHourMap: Record<number, number> = {};
  const byDayMap: Record<number, number> = {};
  const byMonthMap: Record<number, number> = {};
  const byDateMap: Record<string, number> = {};

  for (const item of items) {
    const d = new Date(item.played_at);
    const h = d.getHours();
    const day = d.getDay();
    const month = d.getMonth();
    const dateKey = d.toISOString().split("T")[0];
    byHourMap[h] = (byHourMap[h] ?? 0) + 1;
    byDayMap[day] = (byDayMap[day] ?? 0) + 1;
    byMonthMap[month] = (byMonthMap[month] ?? 0) + 1;
    byDateMap[dateKey] = (byDateMap[dateKey] ?? 0) + 1;
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  res.json({
    byHour: Array.from({ length: 24 }, (_, h) => ({ label: `${h}:00`, count: byHourMap[h] ?? 0 })),
    byDayOfWeek: Array.from({ length: 7 }, (_, d) => ({ label: dayNames[d], count: byDayMap[d] ?? 0 })),
    byMonth: Array.from({ length: 12 }, (_, m) => ({ label: monthNames[m], count: byMonthMap[m] ?? 0 })),
    timeline: Object.entries(byDateMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count })),
  });
});

export default router;

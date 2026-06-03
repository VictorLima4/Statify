import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  spotifyFetch,
  mapArtist,
  mapTrack,
  mapAlbum,
  mapImage,
  type SpotifyApiArtist,
  type SpotifyApiTrack,
  type SpotifyApiAlbum,
} from "../lib/spotify";
import { db, listeningHistoryTable, usersTable } from "@workspace/db";
import { eq, desc, sql, and, gte, lt } from "drizzle-orm";

const router: IRouter = Router();

router.use("/spotify", requireAuth);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Process-lifetime artist enrichment cache (name → Spotify data) */
const artistEnrichCache = new Map<
  string,
  {
    id: string;
    images: ReturnType<typeof mapImage>[];
    genres: string[];
    followers: number;
    popularity: number;
    spotifyUrl: string;
  } | null
>();

function timeRangeCutoff(timeRange: string): Date | null {
  if (timeRange === "short_term")
    return new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  if (timeRange === "medium_term")
    return new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  return null; // long_term = all time
}

/** Look up a single artist on Spotify by name (cached per process) */
async function enrichArtistByName(userId: string, artistName: string) {
  if (artistEnrichCache.has(artistName))
    return artistEnrichCache.get(artistName) ?? null;

  try {
    const result = await spotifyFetch<{
      artists: { items: SpotifyApiArtist[] };
    }>(userId, `/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`);

    const artist = result.artists?.items?.[0];
    if (!artist) {
      artistEnrichCache.set(artistName, null);
      return null;
    }
    const enriched = {
      id: artist.id,
      images: (artist.images ?? []).map(mapImage),
      genres: artist.genres ?? [],
      followers: artist.followers?.total ?? 0,
      popularity: artist.popularity ?? 0,
      spotifyUrl: artist.external_urls?.spotify ?? "",
    };
    artistEnrichCache.set(artistName, enriched);
    return enriched;
  } catch {
    artistEnrichCache.set(artistName, null);
    return null;
  }
}

/** Batch-fetch up to 50 tracks from Spotify by ID, returns Map<id, track> */
async function batchFetchTracks(
  userId: string,
  trackIds: string[]
): Promise<Map<string, SpotifyApiTrack>> {
  const result = new Map<string, SpotifyApiTrack>();
  if (trackIds.length === 0) return result;

  const chunks: string[][] = [];
  for (let i = 0; i < trackIds.length; i += 50)
    chunks.push(trackIds.slice(i, i + 50));

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const data = await spotifyFetch<{ tracks: SpotifyApiTrack[] }>(
          userId,
          `/tracks?ids=${chunk.join(",")}`
        );
        for (const t of data.tracks ?? []) {
          if (t) result.set(t.id, t);
        }
      } catch {
        // non-critical
      }
    })
  );
  return result;
}

// ─── Now Playing ─────────────────────────────────────────────────────────────

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
        ? {
            name: data.device.name,
            type: data.device.type,
            isActive: data.device.is_active,
          }
        : null,
    });
  } catch {
    res.json({ isPlaying: false });
  }
});

// ─── Top Artists (DB-powered) ─────────────────────────────────────────────────

router.get("/spotify/top-artists", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { time_range = "medium_term", limit = "50" } = req.query as Record<string, string>;
  const cutoff = timeRangeCutoff(time_range);
  const limitN = Math.min(Number(limit), 50);

  const condition = cutoff
    ? and(eq(listeningHistoryTable.userId, userId), gte(listeningHistoryTable.playedAt, cutoff))
    : eq(listeningHistoryTable.userId, userId);

  const rows = await db
    .select({
      artistName: listeningHistoryTable.artistName,
      streams: sql<number>`count(*)::int`,
      totalMs: sql<number>`sum(duration_ms)::bigint`,
    })
    .from(listeningHistoryTable)
    .where(condition)
    .groupBy(listeningHistoryTable.artistName)
    .orderBy(sql`count(*) desc`)
    .limit(limitN);

  // Enrich all artists in parallel (cached after first call)
  const enriched = await Promise.all(
    rows.map((r) => enrichArtistByName(userId, r.artistName))
  );

  const result = rows.map((row, i) => {
    const sp = enriched[i];
    return {
      id: sp?.id ?? row.artistName,
      name: row.artistName,
      genres: sp?.genres ?? [],
      popularity: sp?.popularity ?? 0,
      followers: sp?.followers ?? 0,
      images: sp?.images ?? [],
      spotifyUrl: sp?.spotifyUrl ?? "",
      rank: i + 1,
      streamCount: row.streams,
      minutesListened: Math.round((row.totalMs / 60000) * 10) / 10,
    };
  });

  res.json(result);
});

// ─── Top Tracks (DB-powered) ─────────────────────────────────────────────────

router.get("/spotify/top-tracks", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { time_range = "medium_term", limit = "50" } = req.query as Record<string, string>;
  const cutoff = timeRangeCutoff(time_range);
  const limitN = Math.min(Number(limit), 50);

  const condition = cutoff
    ? and(eq(listeningHistoryTable.userId, userId), gte(listeningHistoryTable.playedAt, cutoff))
    : eq(listeningHistoryTable.userId, userId);

  const rows = await db
    .select({
      trackId: listeningHistoryTable.trackId,
      trackName: listeningHistoryTable.trackName,
      artistName: listeningHistoryTable.artistName,
      streams: sql<number>`count(*)::int`,
      totalMs: sql<number>`sum(duration_ms)::bigint`,
    })
    .from(listeningHistoryTable)
    .where(condition)
    .groupBy(
      listeningHistoryTable.trackId,
      listeningHistoryTable.trackName,
      listeningHistoryTable.artistName
    )
    .orderBy(sql`count(*) desc`)
    .limit(limitN);

  const trackIds = rows.map((r) => r.trackId);
  const trackMap = await batchFetchTracks(userId, trackIds);

  const result = rows.map((row, i) => {
    const sp = trackMap.get(row.trackId);
    if (sp) {
      return {
        ...mapTrack(sp, i + 1),
        streamCount: row.streams,
        minutesListened: Math.round((row.totalMs / 60000) * 10) / 10,
      };
    }
    // Fallback when Spotify lookup fails
    return {
      id: row.trackId,
      name: row.trackName,
      artists: [{ id: row.artistName, name: row.artistName }],
      album: { id: "", name: "", artists: [], images: [], releaseDate: "", totalTracks: 0, spotifyUrl: "" },
      durationMs: Math.round(row.totalMs / row.streams),
      popularity: 0,
      spotifyUrl: `https://open.spotify.com/track/${row.trackId}`,
      previewUrl: null,
      rank: i + 1,
      streamCount: row.streams,
      minutesListened: Math.round((row.totalMs / 60000) * 10) / 10,
    };
  });

  res.json(result);
});

// ─── Recently Played (DB-powered) ────────────────────────────────────────────

router.get("/spotify/recently-played", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { limit = "50" } = req.query as Record<string, string>;

  const rows = await db
    .select()
    .from(listeningHistoryTable)
    .where(eq(listeningHistoryTable.userId, userId))
    .orderBy(desc(listeningHistoryTable.playedAt))
    .limit(Math.min(Number(limit), 50));

  // Batch enrich with Spotify for images
  const uniqueIds = [...new Set(rows.map((r) => r.trackId))];
  const trackMap = await batchFetchTracks(userId, uniqueIds);

  const items = rows.map((row) => {
    const sp = trackMap.get(row.trackId);
    return {
      track: sp
        ? mapTrack(sp)
        : {
            id: row.trackId,
            name: row.trackName,
            artists: [{ id: row.artistId, name: row.artistName }],
            album: {
              id: row.albumId,
              name: row.albumName,
              artists: [{ id: row.artistId, name: row.artistName }],
              images: row.albumImageUrl ? [{ url: row.albumImageUrl, width: null, height: null }] : [],
              releaseDate: "",
              totalTracks: 0,
              spotifyUrl: "",
            },
            durationMs: row.durationMs,
            popularity: 0,
            spotifyUrl: `https://open.spotify.com/track/${row.trackId}`,
            previewUrl: null,
            rank: null,
          },
      playedAt: row.playedAt.toISOString(),
    };
  });

  res.json(items);
});

// ─── Playlists ────────────────────────────────────────────────────────────────

router.get("/spotify/playlists", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { limit = "50" } = req.query as Record<string, string>;
  const [meData, data] = await Promise.all([
    spotifyFetch<any>(userId, "/me"),
    spotifyFetch<{ items: any[] }>(
      userId,
      `/me/playlists?limit=${Math.min(Number(limit), 50)}`
    ),
  ]);
  const mySpotifyId = meData?.id ?? userId;
  const items = (data.items ?? []).map((pl) => ({
    id: pl.id,
    name: pl.name,
    description: pl.description ?? null,
    owner: pl.owner?.display_name ?? pl.owner?.id ?? "",
    tracksTotal: pl.tracks?.total ?? 0,
    images: (pl.images ?? []).map((img: any) => ({
      url: img.url,
      width: img.width ?? null,
      height: img.height ?? null,
    })),
    spotifyUrl: pl.external_urls?.spotify ?? "",
    isOwned: pl.owner?.id === mySpotifyId,
  }));
  res.json(items);
});

// ─── Saved Tracks ─────────────────────────────────────────────────────────────

router.get("/spotify/saved-tracks", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { limit = "50", offset = "0" } = req.query as Record<string, string>;
  const data = await spotifyFetch<{
    total: number;
    items: { track: SpotifyApiTrack }[];
  }>(
    userId,
    `/me/tracks?limit=${Math.min(Number(limit), 50)}&offset=${Number(offset)}`
  );
  res.json({
    total: data.total ?? 0,
    items: (data.items ?? []).map((item) => mapTrack(item.track)),
  });
});

// ─── Saved Albums ─────────────────────────────────────────────────────────────

router.get("/spotify/saved-albums", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { limit = "50", offset = "0" } = req.query as Record<string, string>;
  const data = await spotifyFetch<{
    total: number;
    items: { album: SpotifyApiAlbum }[];
  }>(
    userId,
    `/me/albums?limit=${Math.min(Number(limit), 50)}&offset=${Number(offset)}`
  );
  res.json({
    total: data.total ?? 0,
    items: (data.items ?? []).map((item) => mapAlbum(item.album)),
  });
});

// ─── Followed Artists ─────────────────────────────────────────────────────────

router.get("/spotify/followed-artists", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const data = await spotifyFetch<{
    artists: { items: SpotifyApiArtist[]; total: number };
  }>(userId, "/me/following?type=artist&limit=50");
  res.json((data.artists?.items ?? []).map((a) => mapArtist(a)));
});

// ─── Genre Distribution (DB-powered) ─────────────────────────────────────────

router.get("/spotify/genres", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { time_range = "medium_term" } = req.query as Record<string, string>;
  const cutoff = timeRangeCutoff(time_range);

  const condition = cutoff
    ? and(eq(listeningHistoryTable.userId, userId), gte(listeningHistoryTable.playedAt, cutoff))
    : eq(listeningHistoryTable.userId, userId);

  // Get top 30 artists from DB for genre enrichment
  const topArtistRows = await db
    .select({
      artistName: listeningHistoryTable.artistName,
      streams: sql<number>`count(*)::int`,
    })
    .from(listeningHistoryTable)
    .where(condition)
    .groupBy(listeningHistoryTable.artistName)
    .orderBy(sql`count(*) desc`)
    .limit(30);

  // Enrich in parallel (cached)
  const enriched = await Promise.all(
    topArtistRows.map((r) => enrichArtistByName(userId, r.artistName))
  );

  const genreCount: Record<string, number> = {};
  for (let i = 0; i < enriched.length; i++) {
    const artistData = enriched[i];
    const streams = topArtistRows[i].streams;
    for (const genre of artistData?.genres ?? []) {
      genreCount[genre] = (genreCount[genre] ?? 0) + streams;
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

// ─── Stats Overview (DB-powered) ─────────────────────────────────────────────

router.get("/spotify/stats", async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const shortCutoff = timeRangeCutoff("short_term")!;
  const mediumCutoff = timeRangeCutoff("medium_term")!;

  // Fetch top artists for all time ranges (DB)
  async function getTopArtists(cutoff: Date | null, lim: number) {
    const condition = cutoff
      ? and(eq(listeningHistoryTable.userId, userId), gte(listeningHistoryTable.playedAt, cutoff))
      : eq(listeningHistoryTable.userId, userId);

    return db
      .select({
        artistName: listeningHistoryTable.artistName,
        streams: sql<number>`count(*)::int`,
        totalMs: sql<number>`sum(duration_ms)::bigint`,
      })
      .from(listeningHistoryTable)
      .where(condition)
      .groupBy(listeningHistoryTable.artistName)
      .orderBy(sql`count(*) desc`)
      .limit(lim);
  }

  async function getTopTracks(cutoff: Date | null, lim: number) {
    const condition = cutoff
      ? and(eq(listeningHistoryTable.userId, userId), gte(listeningHistoryTable.playedAt, cutoff))
      : eq(listeningHistoryTable.userId, userId);

    return db
      .select({
        trackId: listeningHistoryTable.trackId,
        trackName: listeningHistoryTable.trackName,
        artistName: listeningHistoryTable.artistName,
        streams: sql<number>`count(*)::int`,
        totalMs: sql<number>`sum(duration_ms)::bigint`,
      })
      .from(listeningHistoryTable)
      .where(condition)
      .groupBy(
        listeningHistoryTable.trackId,
        listeningHistoryTable.trackName,
        listeningHistoryTable.artistName
      )
      .orderBy(sql`count(*) desc`)
      .limit(lim);
  }

  const [
    artistsShortRows, artistsMediumRows, artistsLongRows,
    tracksShortRows, tracksMediumRows, tracksLongRows,
    totalStatsRow,
    savedTracksData, savedAlbumsData, followedData, playlistsData,
  ] = await Promise.all([
    getTopArtists(shortCutoff, 50),
    getTopArtists(mediumCutoff, 50),
    getTopArtists(null, 50),
    getTopTracks(shortCutoff, 50),
    getTopTracks(mediumCutoff, 50),
    getTopTracks(null, 50),
    db
      .select({
        totalStreams: sql<number>`count(*)::int`,
        totalMs: sql<number>`sum(duration_ms)::bigint`,
        uniqueArtists: sql<number>`count(distinct artist_name)::int`,
        uniqueTracks: sql<number>`count(distinct track_id)::int`,
        uniqueAlbums: sql<number>`count(distinct album_name)::int`,
      })
      .from(listeningHistoryTable)
      .where(eq(listeningHistoryTable.userId, userId)),
    spotifyFetch<{ total: number }>(userId, "/me/tracks?limit=1").catch(() => ({ total: 0 })),
    spotifyFetch<{ total: number }>(userId, "/me/albums?limit=1").catch(() => ({ total: 0 })),
    spotifyFetch<{ artists: { total: number } }>(userId, "/me/following?type=artist&limit=1").catch(() => ({ artists: { total: 0 } })),
    spotifyFetch<{ total: number }>(userId, "/me/playlists?limit=1").catch(() => ({ total: 0 })),
  ]);

  // Enrich top-50 long-term artists for display (parallel, cached)
  const allArtistNames = [
    ...new Set([
      ...artistsLongRows.map((r) => r.artistName),
    ]),
  ].slice(0, 50);
  const enrichedMap = new Map<string, Awaited<ReturnType<typeof enrichArtistByName>>>();
  await Promise.all(
    allArtistNames.map(async (name) => {
      enrichedMap.set(name, await enrichArtistByName(userId, name));
    })
  );

  function buildArtistList(rows: typeof artistsLongRows) {
    return rows.map((row, i) => {
      const sp = enrichedMap.get(row.artistName);
      return {
        id: sp?.id ?? row.artistName,
        name: row.artistName,
        genres: sp?.genres ?? [],
        popularity: sp?.popularity ?? 0,
        followers: sp?.followers ?? 0,
        images: sp?.images ?? [],
        spotifyUrl: sp?.spotifyUrl ?? "",
        rank: i + 1,
        streamCount: row.streams,
        minutesListened: Math.round((row.totalMs / 60000) * 10) / 10,
      };
    });
  }

  // Batch fetch tracks for long-term top tracks
  const allTrackIds = [...new Set(tracksLongRows.map((r) => r.trackId))];
  const trackMap = await batchFetchTracks(userId, allTrackIds);

  function buildTrackList(rows: typeof tracksLongRows) {
    return rows.map((row, i) => {
      const sp = trackMap.get(row.trackId);
      if (sp) {
        return { ...mapTrack(sp, i + 1), streamCount: row.streams };
      }
      return {
        id: row.trackId, name: row.trackName,
        artists: [{ id: row.artistName, name: row.artistName }],
        album: { id: "", name: "", artists: [], images: [], releaseDate: "", totalTracks: 0, spotifyUrl: "" },
        durationMs: 0, popularity: 0,
        spotifyUrl: `https://open.spotify.com/track/${row.trackId}`,
        previewUrl: null, rank: i + 1, streamCount: row.streams,
      };
    });
  }

  const totals = totalStatsRow[0] ?? { totalStreams: 0, totalMs: 0, uniqueArtists: 0, uniqueTracks: 0, uniqueAlbums: 0 };

  res.json({
    topArtistsShort: buildArtistList(artistsShortRows),
    topArtistsMedium: buildArtistList(artistsMediumRows),
    topArtistsLong: buildArtistList(artistsLongRows),
    topTracksShort: buildTrackList(tracksShortRows),
    topTracksMedium: buildTrackList(tracksMediumRows),
    topTracksLong: buildTrackList(tracksLongRows),
    savedTracksTotal: (savedTracksData as any).total ?? 0,
    savedAlbumsTotal: (savedAlbumsData as any).total ?? 0,
    followedArtistsTotal: (followedData as any).artists?.total ?? 0,
    playlistsTotal: (playlistsData as any).total ?? 0,
    totalStreams: totals.totalStreams,
    totalMinutesListened: Math.round(totals.totalMs / 60000),
    uniqueArtistsCount: totals.uniqueArtists,
    uniqueTracksCount: totals.uniqueTracks,
    uniqueAlbumsCount: totals.uniqueAlbums,
    // legacy compat
    recentTracksCount: 50,
    uniqueGenresCount: 0,
    estimatedMinutesListened: Math.round(totals.totalMs / 60000),
  });
});

// ─── Insights (DB-powered) ────────────────────────────────────────────────────

router.get("/spotify/insights", async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [hourRows, dayRows, monthRows, topArtistRow, topTrackRow] = await Promise.all([
    db
      .select({
        hour: sql<number>`extract(hour from played_at at time zone 'UTC')::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(listeningHistoryTable)
      .where(eq(listeningHistoryTable.userId, userId))
      .groupBy(sql`extract(hour from played_at at time zone 'UTC')`)
      .orderBy(sql`count(*) desc`),
    db
      .select({
        dow: sql<number>`extract(dow from played_at at time zone 'UTC')::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(listeningHistoryTable)
      .where(eq(listeningHistoryTable.userId, userId))
      .groupBy(sql`extract(dow from played_at at time zone 'UTC')`)
      .orderBy(sql`count(*) desc`),
    db
      .select({
        month: sql<number>`extract(month from played_at at time zone 'UTC')::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(listeningHistoryTable)
      .where(eq(listeningHistoryTable.userId, userId))
      .groupBy(sql`extract(month from played_at at time zone 'UTC')`)
      .orderBy(sql`count(*) desc`),
    db
      .select({ artistName: listeningHistoryTable.artistName })
      .from(listeningHistoryTable)
      .where(eq(listeningHistoryTable.userId, userId))
      .groupBy(listeningHistoryTable.artistName)
      .orderBy(sql`count(*) desc`)
      .limit(1),
    db
      .select({ trackId: listeningHistoryTable.trackId, trackName: listeningHistoryTable.trackName, artistName: listeningHistoryTable.artistName })
      .from(listeningHistoryTable)
      .where(eq(listeningHistoryTable.userId, userId))
      .groupBy(listeningHistoryTable.trackId, listeningHistoryTable.trackName, listeningHistoryTable.artistName)
      .orderBy(sql`count(*) desc`)
      .limit(1),
  ]);

  const mostActiveHour = hourRows[0]?.hour ?? 20;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const mostActiveDayOfWeek = dayNames[dayRows[0]?.dow ?? 5];
  const mostActiveMonth = monthNames[(monthRows[0]?.month ?? 1) - 1];

  const topArtistName = topArtistRow[0]?.artistName ?? "Unknown";
  const topTrackId = topTrackRow[0]?.trackId ?? null;

  const [topArtistEnriched, topTrackSpotify] = await Promise.all([
    enrichArtistByName(userId, topArtistName),
    topTrackId ? batchFetchTracks(userId, [topTrackId]) : Promise.resolve(new Map<string, SpotifyApiTrack>()),
  ]);

  const allTimeTopArtist = {
    id: topArtistEnriched?.id ?? topArtistName,
    name: topArtistName,
    genres: topArtistEnriched?.genres ?? [],
    popularity: topArtistEnriched?.popularity ?? 0,
    followers: topArtistEnriched?.followers ?? 0,
    images: topArtistEnriched?.images ?? [],
    spotifyUrl: topArtistEnriched?.spotifyUrl ?? "",
    rank: 1,
  };

  let mostPlayedTrack = null;
  let mostPlayedAlbum = null;
  if (topTrackId) {
    const sp = topTrackSpotify.get(topTrackId);
    if (sp) {
      mostPlayedTrack = mapTrack(sp, 1);
      mostPlayedAlbum = mapAlbum(sp.album);
    } else {
      mostPlayedTrack = {
        id: topTrackRow[0]!.trackId, name: topTrackRow[0]!.trackName,
        artists: [{ id: topArtistName, name: topArtistName }],
        album: { id: "", name: "", artists: [], images: [], releaseDate: "", totalTracks: 0, spotifyUrl: "" },
        durationMs: 0, popularity: 0,
        spotifyUrl: `https://open.spotify.com/track/${topTrackRow[0]!.trackId}`,
        previewUrl: null, rank: 1,
      };
    }
  }

  // Genre from top 20 artists
  const top20ArtistRows = await db
    .select({ artistName: listeningHistoryTable.artistName, streams: sql<number>`count(*)::int` })
    .from(listeningHistoryTable)
    .where(eq(listeningHistoryTable.userId, userId))
    .groupBy(listeningHistoryTable.artistName)
    .orderBy(sql`count(*) desc`)
    .limit(20);

  const genreEnriched = await Promise.all(top20ArtistRows.map((r) => enrichArtistByName(userId, r.artistName)));
  const genreCount: Record<string, number> = {};
  for (const a of genreEnriched) {
    for (const g of a?.genres ?? []) {
      genreCount[g] = (genreCount[g] ?? 0) + 1;
    }
  }
  const dominantGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";

  const insights = [
    { title: "Top Genre", description: `${dominantGenre} dominates your listening habits`, emoji: "🎵" },
    { title: "Most Active Time", description: `You listen most around ${mostActiveHour}:00`, emoji: "⏰" },
    { title: "Favorite Day", description: `${mostActiveDayOfWeek} is your most musical day`, emoji: "📅" },
    { title: "Top Artist", description: `${topArtistName} is your most-played artist of all time`, emoji: "🌟" },
    { title: "Peak Month", description: `${mostActiveMonth} is when you listen the most`, emoji: "📅" },
  ];

  res.json({
    allTimeTopArtist,
    monthTopArtist: allTimeTopArtist,
    mostPlayedTrack,
    mostPlayedAlbum,
    dominantGenre,
    mostActiveHour,
    mostActiveDayOfWeek,
    mostActiveMonth,
    favoriteDecade: "2010s",
    insights,
  });
});

// ─── Wrapped (DB-powered) ─────────────────────────────────────────────────────

router.get("/spotify/wrapped", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const yearCondition = and(
    eq(listeningHistoryTable.userId, userId),
    gte(listeningHistoryTable.playedAt, startDate),
    lt(listeningHistoryTable.playedAt, endDate)
  );

  const [artistRows, trackRows, totalRow] = await Promise.all([
    db
      .select({
        artistName: listeningHistoryTable.artistName,
        streams: sql<number>`count(*)::int`,
        totalMs: sql<number>`sum(duration_ms)::bigint`,
      })
      .from(listeningHistoryTable)
      .where(yearCondition)
      .groupBy(listeningHistoryTable.artistName)
      .orderBy(sql`count(*) desc`)
      .limit(5),
    db
      .select({
        trackId: listeningHistoryTable.trackId,
        trackName: listeningHistoryTable.trackName,
        artistName: listeningHistoryTable.artistName,
        albumName: listeningHistoryTable.albumName,
        streams: sql<number>`count(*)::int`,
        totalMs: sql<number>`sum(duration_ms)::bigint`,
      })
      .from(listeningHistoryTable)
      .where(yearCondition)
      .groupBy(
        listeningHistoryTable.trackId,
        listeningHistoryTable.trackName,
        listeningHistoryTable.artistName,
        listeningHistoryTable.albumName
      )
      .orderBy(sql`count(*) desc`)
      .limit(10),
    db
      .select({
        totalMs: sql<number>`sum(duration_ms)::bigint`,
        totalStreams: sql<number>`count(*)::int`,
      })
      .from(listeningHistoryTable)
      .where(yearCondition),
  ]);

  const totalMinutes = Math.round((totalRow[0]?.totalMs ?? 0) / 60000);
  const totalStreams = totalRow[0]?.totalStreams ?? 0;

  // Enrich artists and tracks in parallel
  const [enrichedArtists, trackMap] = await Promise.all([
    Promise.all(artistRows.map((r) => enrichArtistByName(userId, r.artistName))),
    batchFetchTracks(userId, trackRows.map((r) => r.trackId)),
  ]);

  const topArtists = artistRows.map((row, i) => {
    const sp = enrichedArtists[i];
    return {
      id: sp?.id ?? row.artistName,
      name: row.artistName,
      genres: sp?.genres ?? [],
      popularity: sp?.popularity ?? 0,
      followers: sp?.followers ?? 0,
      images: sp?.images ?? [],
      spotifyUrl: sp?.spotifyUrl ?? "",
      rank: i + 1,
      streamCount: row.streams,
    };
  });

  const top5Tracks = trackRows.slice(0, 5).map((row, i) => {
    const sp = trackMap.get(row.trackId);
    if (sp) return { ...mapTrack(sp, i + 1), streamCount: row.streams };
    return {
      id: row.trackId, name: row.trackName,
      artists: [{ id: row.artistName, name: row.artistName }],
      album: { id: "", name: row.albumName, artists: [], images: [], releaseDate: "", totalTracks: 0, spotifyUrl: "" },
      durationMs: 0, popularity: 0,
      spotifyUrl: `https://open.spotify.com/track/${row.trackId}`,
      previewUrl: null, rank: i + 1, streamCount: row.streams,
    };
  });

  // Albums from top tracks
  const albumMap = new Map<string, any>();
  for (const row of trackRows) {
    const sp = trackMap.get(row.trackId);
    if (sp && !albumMap.has(sp.album.id)) albumMap.set(sp.album.id, mapAlbum(sp.album));
  }
  const topAlbums = [...albumMap.values()].slice(0, 5);

  // Genres from enriched artists
  const genreCount: Record<string, number> = {};
  for (let i = 0; i < artistRows.length; i++) {
    for (const g of enrichedArtists[i]?.genres ?? []) {
      genreCount[g] = (genreCount[g] ?? 0) + artistRows[i].streams;
    }
  }
  const genreTotal = Object.values(genreCount).reduce((s, c) => s + c, 0);
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, count]) => ({
      genre,
      count,
      percentage: genreTotal > 0 ? Math.round((count / genreTotal) * 1000) / 10 : 0,
    }));

  res.json({
    year,
    topArtists,
    topTracks: top5Tracks,
    topGenres,
    topAlbums,
    totalMinutesListened: totalMinutes,
    totalStreams,
    newDiscoveries: Math.round(totalStreams * 0.05),
    minutesPerDay: totalMinutes > 0 ? Math.round((totalMinutes / 365) * 10) / 10 : null,
  });
});

// ─── Activity (DB-powered, full history) ─────────────────────────────────────

router.get("/spotify/activity", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { year } = req.query as Record<string, string>;

  let condition = eq(listeningHistoryTable.userId, userId);
  if (year) {
    const y = parseInt(year);
    const start = new Date(y, 0, 1);
    const end = new Date(y + 1, 0, 1);
    condition = and(
      eq(listeningHistoryTable.userId, userId),
      gte(listeningHistoryTable.playedAt, start),
      lt(listeningHistoryTable.playedAt, end)
    ) as typeof condition;
  }

  const [hourRows, dayRows, monthRows, timelineRows] = await Promise.all([
    db
      .select({
        hour: sql<number>`extract(hour from played_at at time zone 'UTC')::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(listeningHistoryTable)
      .where(condition)
      .groupBy(sql`extract(hour from played_at at time zone 'UTC')`),
    db
      .select({
        dow: sql<number>`extract(dow from played_at at time zone 'UTC')::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(listeningHistoryTable)
      .where(condition)
      .groupBy(sql`extract(dow from played_at at time zone 'UTC')`),
    db
      .select({
        month: sql<number>`extract(month from played_at at time zone 'UTC')::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(listeningHistoryTable)
      .where(condition)
      .groupBy(sql`extract(month from played_at at time zone 'UTC')`),
    db
      .select({
        date: sql<string>`to_char(played_at at time zone 'UTC', 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(listeningHistoryTable)
      .where(condition)
      .groupBy(sql`to_char(played_at at time zone 'UTC', 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(played_at at time zone 'UTC', 'YYYY-MM-DD')`),
  ]);

  const hourMap: Record<number, number> = {};
  for (const r of hourRows) hourMap[r.hour] = r.count;

  const dayMap: Record<number, number> = {};
  for (const r of dayRows) dayMap[r.dow] = r.count;

  const monthMap: Record<number, number> = {};
  for (const r of monthRows) monthMap[r.month] = r.count;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  res.json({
    byHour: Array.from({ length: 24 }, (_, h) => ({ label: `${h}:00`, count: hourMap[h] ?? 0 })),
    byDayOfWeek: Array.from({ length: 7 }, (_, d) => ({ label: dayNames[d], count: dayMap[d] ?? 0 })),
    byMonth: Array.from({ length: 12 }, (_, m) => ({ label: monthNames[m], count: monthMap[m + 1] ?? 0 })),
    timeline: timelineRows.map((r) => ({ date: r.date, count: r.count })),
  });
});

// ─── Sound Capsule (DB-powered) ───────────────────────────────────────────────

router.get("/spotify/capsule", async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = ((req.query.month as string) || defaultMonth).trim();

  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 1);

  const [rows, allMonthsRows] = await Promise.all([
    db
      .select()
      .from(listeningHistoryTable)
      .where(
        and(
          eq(listeningHistoryTable.userId, userId),
          gte(listeningHistoryTable.playedAt, startDate),
          lt(listeningHistoryTable.playedAt, endDate)
        )
      ),
    db
      .selectDistinct({ m: sql<string>`to_char(played_at AT TIME ZONE 'UTC', 'YYYY-MM')` })
      .from(listeningHistoryTable)
      .where(eq(listeningHistoryTable.userId, userId))
      .orderBy(sql`to_char(played_at AT TIME ZONE 'UTC', 'YYYY-MM') desc`),
  ]);

  const availableMonths = allMonthsRows.map((r) => r.m).filter(Boolean);

  if (rows.length === 0) {
    res.json({ month, availableMonths, totalMinutes: 0, totalStreams: 0, topArtists: [], topTracks: [], topAlbums: [], topGenres: [] });
    return;
  }

  const totalStreams = rows.length;
  const totalMinutes = Math.round(rows.reduce((s, r) => s + r.durationMs, 0) / 60000);

  const artistAgg = new Map<string, { name: string; streams: number; totalMs: number; imageUrl: string | null }>();
  for (const row of rows) {
    const cur = artistAgg.get(row.artistId) ?? { name: row.artistName, streams: 0, totalMs: 0, imageUrl: null };
    cur.streams++;
    cur.totalMs += row.durationMs;
    artistAgg.set(row.artistId, cur);
  }
  const topArtists = [...artistAgg.entries()]
    .sort((a, b) => b[1].streams - a[1].streams)
    .slice(0, 10)
    .map(([id, d]) => ({ id, name: d.name, imageUrl: d.imageUrl, streams: d.streams, minutesListened: Math.round((d.totalMs / 60000) * 10) / 10 }));

  const trackAgg = new Map<string, { name: string; artistName: string; albumName: string; streams: number; totalMs: number }>();
  for (const row of rows) {
    const cur = trackAgg.get(row.trackId) ?? { name: row.trackName, artistName: row.artistName, albumName: row.albumName, streams: 0, totalMs: 0 };
    cur.streams++;
    cur.totalMs += row.durationMs;
    trackAgg.set(row.trackId, cur);
  }
  const topTracks = [...trackAgg.entries()]
    .sort((a, b) => b[1].streams - a[1].streams)
    .slice(0, 10)
    .map(([id, d]) => ({ id, name: d.name, artistName: d.artistName, albumName: d.albumName, streams: d.streams, minutesListened: Math.round((d.totalMs / 60000) * 10) / 10 }));

  const albumAgg = new Map<string, { name: string; artistName: string; streams: number; totalMs: number }>();
  for (const row of rows) {
    const cur = albumAgg.get(row.albumId) ?? { name: row.albumName, artistName: row.artistName, streams: 0, totalMs: 0 };
    cur.streams++;
    cur.totalMs += row.durationMs;
    albumAgg.set(row.albumId, cur);
  }
  const topAlbums = [...albumAgg.entries()]
    .sort((a, b) => b[1].streams - a[1].streams)
    .slice(0, 10)
    .map(([id, d]) => ({ id, name: d.name, artistName: d.artistName, streams: d.streams, minutesListened: Math.round((d.totalMs / 60000) * 10) / 10 }));

  // Genres from enriched top-5 artists
  const top5ArtistNames = topArtists.slice(0, 5).map((a) => a.name);
  const genreEnriched = await Promise.all(top5ArtistNames.map((n) => enrichArtistByName(userId, n)));
  const genreCount: Record<string, number> = {};
  for (let i = 0; i < genreEnriched.length; i++) {
    const streams = topArtists[i].streams;
    for (const g of genreEnriched[i]?.genres ?? []) {
      genreCount[g] = (genreCount[g] ?? 0) + streams;
    }
  }
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre, count]) => ({ genre, count }));

  res.json({ month, availableMonths, totalMinutes, totalStreams, topArtists, topTracks, topAlbums, topGenres });
});

// ─── Artist Detail ────────────────────────────────────────────────────────────

router.get("/spotify/artist/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [artistRes, topTracksRes, relatedRes, albumsRes] = await Promise.allSettled([
    spotifyFetch<SpotifyApiArtist>(userId, `/artists/${rawId}`),
    spotifyFetch<{ tracks: SpotifyApiTrack[] }>(userId, `/artists/${rawId}/top-tracks?market=from_token`),
    spotifyFetch<{ artists: SpotifyApiArtist[] }>(userId, `/artists/${rawId}/related-artists`),
    spotifyFetch<{ items: SpotifyApiAlbum[] }>(userId, `/artists/${rawId}/albums?limit=20&include_groups=album,single`),
  ]);

  if (artistRes.status === "rejected") {
    res.status(404).json({ error: "Artist not found" });
    return;
  }

  const artist = artistRes.value;
  const topTracksData = topTracksRes.status === "fulfilled" ? topTracksRes.value : { tracks: [] };
  const relatedData = relatedRes.status === "fulfilled" ? relatedRes.value : { artists: [] };
  const albumsData = albumsRes.status === "fulfilled" ? albumsRes.value : { items: [] };

  // Get user's DB stats for this artist
  let userRank: number | null = null;
  let userStreams: number | null = null;
  let userMinutes: number | null = null;
  try {
    const statsRow = await db
      .select({
        streams: sql<number>`count(*)::int`,
        totalMs: sql<number>`sum(duration_ms)::bigint`,
      })
      .from(listeningHistoryTable)
      .where(and(eq(listeningHistoryTable.userId, userId), eq(listeningHistoryTable.artistName, artist.name)));

    userStreams = statsRow[0]?.streams ?? 0;
    userMinutes = Math.round((statsRow[0]?.totalMs ?? 0) / 60000);

    // Rank: how many artists have more streams than this one?
    if (userStreams > 0) {
      const rankRow = await db
        .select({ artistName: listeningHistoryTable.artistName, streams: sql<number>`count(*)::int` })
        .from(listeningHistoryTable)
        .where(eq(listeningHistoryTable.userId, userId))
        .groupBy(listeningHistoryTable.artistName)
        .having(sql`count(*) > ${userStreams}`);
      userRank = rankRow.length + 1;
    }
  } catch {
    // non-critical
  }

  res.json({
    artist: mapArtist(artist),
    topTracks: (topTracksData.tracks ?? []).slice(0, 10).map((t) => mapTrack(t)),
    relatedArtists: (relatedData.artists ?? []).slice(0, 10).map((a) => mapArtist(a)),
    albums: (albumsData.items ?? []).slice(0, 10).map(mapAlbum),
    userRank,
    userStreams,
    userMinutes,
  });
});

// ─── Album Detail ─────────────────────────────────────────────────────────────

router.get("/spotify/album/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const album = await spotifyFetch<SpotifyApiAlbum & { tracks: { items: any[] } }>(
    userId,
    `/albums/${rawId}`
  );
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

// ─── Track Detail ─────────────────────────────────────────────────────────────

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

// ─── Sync ─────────────────────────────────────────────────────────────────────

router.post("/spotify/sync", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  try {
    const recentData = await spotifyFetch<{
      items: { track: SpotifyApiTrack; played_at: string }[];
    }>(userId, "/me/player/recently-played?limit=50");
    const items = recentData.items ?? [];

    let inserted = 0;
    for (const item of items) {
      const t = item.track;
      if (!t) continue;
      const existing = await db
        .select({ id: listeningHistoryTable.id })
        .from(listeningHistoryTable)
        .where(
          and(
            eq(listeningHistoryTable.userId, userId),
            eq(listeningHistoryTable.trackId, t.id),
            eq(listeningHistoryTable.playedAt, new Date(item.played_at))
          )
        )
        .limit(1);
      if (existing.length > 0) continue;
      await db.insert(listeningHistoryTable).values({
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
      });
      inserted++;
    }

    res.json({ success: true, message: `Synced ${inserted} new tracks (${items.length} checked)` });
  } catch (err) {
    req.log.error({ err }, "Sync error");
    res.json({ success: false, message: "Sync failed" });
  }
});

export default router;

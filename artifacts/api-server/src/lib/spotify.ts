import { logger } from "./logger";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const SPOTIFY_AUTH_BASE = "https://accounts.spotify.com";

export const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-top-read",
  "user-read-recently-played",
  "user-follow-read",
  "user-library-read",
  "user-read-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

export function getSpotifyAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: SPOTIFY_SCOPES,
    redirect_uri: getRedirectUri(),
    state,
  });
  return `${SPOTIFY_AUTH_BASE}/authorize?${params.toString()}`;
}

export function getRedirectUri(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domain) {
    return `https://${domain}/api/auth/callback`;
  }
  return "http://localhost:5000/api/auth/callback";
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${SPOTIFY_AUTH_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${SPOTIFY_AUTH_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  return response.json();
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) throw new Error("User not found");

  const now = new Date();
  const expiresAt = new Date(user.tokenExpiresAt);

  if (expiresAt.getTime() - now.getTime() > 60 * 1000) {
    return user.accessToken;
  }

  logger.info({ userId }, "Refreshing Spotify access token");

  try {
    const tokens = await refreshAccessToken(user.refreshToken);
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await db
      .update(usersTable)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? user.refreshToken,
        tokenExpiresAt: newExpiresAt,
      })
      .where(eq(usersTable.id, userId));

    return tokens.access_token;
  } catch (err) {
    logger.error({ err, userId }, "Failed to refresh token");
    throw err;
  }
}

export async function spotifyFetch<T>(
  userId: string,
  path: string,
  options?: RequestInit
): Promise<T> {
  const accessToken = await getValidAccessToken(userId);

  const response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (response.status === 204) {
    return null as T;
  }

  if (!response.ok) {
    const err = await response.text();
    logger.warn({ status: response.status, path, err }, "Spotify API error");
    throw new Error(`Spotify API error ${response.status}: ${err}`);
  }

  return response.json();
}

export function mapImage(img: { url: string; width?: number | null; height?: number | null }) {
  return { url: img.url, width: img.width ?? null, height: img.height ?? null };
}

export function mapArtistRef(a: { id: string; name: string }) {
  return { id: a.id, name: a.name };
}

export function mapAlbum(album: SpotifyApiAlbum) {
  return {
    id: album.id,
    name: album.name,
    artists: album.artists.map(mapArtistRef),
    images: album.images.map(mapImage),
    releaseDate: album.release_date ?? "",
    totalTracks: album.total_tracks ?? 0,
    spotifyUrl: album.external_urls?.spotify ?? "",
  };
}

export function mapTrack(track: SpotifyApiTrack, rank?: number) {
  return {
    id: track.id,
    name: track.name,
    artists: track.artists.map(mapArtistRef),
    album: mapAlbum(track.album),
    durationMs: track.duration_ms,
    popularity: track.popularity ?? 0,
    spotifyUrl: track.external_urls?.spotify ?? "",
    previewUrl: track.preview_url ?? null,
    rank: rank ?? null,
  };
}

export function mapArtist(artist: SpotifyApiArtist, rank?: number) {
  return {
    id: artist.id,
    name: artist.name,
    genres: artist.genres ?? [],
    popularity: artist.popularity ?? 0,
    followers: artist.followers?.total ?? 0,
    images: (artist.images ?? []).map(mapImage),
    spotifyUrl: artist.external_urls?.spotify ?? "",
    rank: rank ?? null,
  };
}

// Spotify API types
export interface SpotifyApiImage {
  url: string;
  width?: number | null;
  height?: number | null;
}

export interface SpotifyApiArtist {
  id: string;
  name: string;
  genres?: string[];
  popularity?: number;
  followers?: { total: number };
  images?: SpotifyApiImage[];
  external_urls?: { spotify: string };
}

export interface SpotifyApiAlbum {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  images: SpotifyApiImage[];
  release_date?: string;
  total_tracks?: number;
  external_urls?: { spotify: string };
}

export interface SpotifyApiTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: SpotifyApiAlbum;
  duration_ms: number;
  popularity?: number;
  external_urls?: { spotify: string };
  preview_url?: string | null;
}

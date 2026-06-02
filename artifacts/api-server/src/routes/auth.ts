import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getSpotifyAuthUrl,
  exchangeCodeForTokens,
  spotifyFetch,
  mapImage,
} from "../lib/spotify";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/auth/login-url", (_req, res): void => {
  const state = crypto.randomBytes(16).toString("hex");
  const url = getSpotifyAuthUrl(state);
  res.json({ url });
});

router.get("/auth/callback", async (req, res): Promise<void> => {
  const { code, error } = req.query as { code?: string; error?: string };

  const frontendBase = req.protocol + "://" + req.get("host");

  if (error || !code) {
    req.log.warn({ error }, "Spotify auth error");
    res.redirect(`${frontendBase}/?error=spotify_auth_failed`);
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const profile = await fetchSpotifyMe(tokens.access_token);

    const userData = {
      id: profile.id,
      displayName: profile.display_name ?? profile.id,
      email: profile.email ?? "",
      country: profile.country ?? "",
      product: profile.product ?? "free",
      followers: profile.followers?.total ?? 0,
      images: (profile.images ?? []).map(mapImage),
      spotifyUrl: profile.external_urls?.spotify ?? null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt,
    };

    await db
      .insert(usersTable)
      .values(userData)
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          displayName: userData.displayName,
          email: userData.email,
          country: userData.country,
          product: userData.product,
          followers: userData.followers,
          images: userData.images,
          spotifyUrl: userData.spotifyUrl,
          accessToken: userData.accessToken,
          refreshToken: userData.refreshToken,
          tokenExpiresAt: userData.tokenExpiresAt,
        },
      });

    req.session.userId = profile.id;

    req.log.info({ userId: profile.id }, "User logged in");
    res.redirect(`${frontendBase}/dashboard`);
  } catch (err) {
    logger.error({ err }, "Auth callback error");
    res.redirect(`${frontendBase}/?error=auth_failed`);
  }
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    country: user.country,
    product: user.product,
    followers: user.followers,
    images: user.images,
    spotifyUrl: user.spotifyUrl ?? null,
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

async function fetchSpotifyMe(accessToken: string) {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Spotify profile");
  return res.json();
}

export default router;

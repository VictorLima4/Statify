import { pgTable, text, integer, timestamp, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const listeningHistoryTable = pgTable("listening_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  trackId: text("track_id").notNull(),
  trackName: text("track_name").notNull(),
  artistId: text("artist_id").notNull(),
  artistName: text("artist_name").notNull(),
  albumId: text("album_id").notNull(),
  albumName: text("album_name").notNull(),
  albumImageUrl: text("album_image_url"),
  durationMs: integer("duration_ms").notNull(),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertListeningHistorySchema = createInsertSchema(listeningHistoryTable).omit({ id: true, createdAt: true });
export type InsertListeningHistory = z.infer<typeof insertListeningHistorySchema>;
export type ListeningHistory = typeof listeningHistoryTable.$inferSelect;

import { db, listeningHistoryTable } from "@workspace/db";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, "../../");
const FILES_DIR = path.join(WORKSPACE_ROOT, "attached_assets");
const USER_ID = process.argv[2] ?? "12147396588";
const CHUNK_SIZE = 500;

function stableId(input: string): string {
  return crypto.createHash("md5").update(input).digest("hex").slice(0, 22);
}

interface EndsongEntry {
  ts: string;
  ms_played: number;
  master_metadata_track_name: string | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
  spotify_track_uri: string | null;
}

async function main() {
  const allFiles = fs
    .readdirSync(FILES_DIR)
    .filter((f) => f.startsWith("endsong_") && f.endsWith(".json"))
    .sort((a, b) => {
      const numA = parseInt(a.replace("endsong_", "").split("_")[0]);
      const numB = parseInt(b.replace("endsong_", "").split("_")[0]);
      return numA - numB;
    });

  if (allFiles.length === 0) {
    console.error(`No endsong_*.json files found in ${FILES_DIR}`);
    process.exit(1);
  }

  console.log(`Found ${allFiles.length} files for userId=${USER_ID}`);
  console.log("Files:", allFiles.join(", "));
  console.log();

  const seenKey = new Set<string>();
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalInserted = 0;

  for (const file of allFiles) {
    const filePath = path.join(FILES_DIR, file);
    const stat = fs.statSync(filePath);
    process.stdout.write(
      `Processing ${file} (${(stat.size / 1024 / 1024).toFixed(1)}MB)...`
    );

    const raw = fs.readFileSync(filePath, "utf-8");
    const entries: EndsongEntry[] = JSON.parse(raw);

    const rows: Array<{
      userId: string;
      trackId: string;
      trackName: string;
      artistId: string;
      artistName: string;
      albumId: string;
      albumName: string;
      albumImageUrl: null;
      durationMs: number;
      playedAt: Date;
    }> = [];

    for (const entry of entries) {
      totalProcessed++;

      if (
        !entry.master_metadata_track_name ||
        !entry.spotify_track_uri ||
        !entry.spotify_track_uri.startsWith("spotify:track:")
      ) {
        totalSkipped++;
        continue;
      }

      const trackId = entry.spotify_track_uri.replace("spotify:track:", "");
      const playedAt = new Date(entry.ts);
      const dedupeKey = `${USER_ID}|${trackId}|${entry.ts}`;

      if (seenKey.has(dedupeKey)) {
        totalSkipped++;
        continue;
      }
      seenKey.add(dedupeKey);

      const artistName = entry.master_metadata_album_artist_name ?? "Unknown Artist";
      const albumName = entry.master_metadata_album_album_name ?? "Unknown Album";

      rows.push({
        userId: USER_ID,
        trackId,
        trackName: entry.master_metadata_track_name,
        artistId: stableId(artistName),
        artistName,
        albumId: stableId(`${artistName}::${albumName}`),
        albumName,
        albumImageUrl: null,
        durationMs: entry.ms_played ?? 0,
        playedAt,
      });
    }

    let fileInserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      await db.insert(listeningHistoryTable).values(chunk);
      fileInserted += chunk.length;
    }

    totalInserted += fileInserted;
    console.log(
      ` ${entries.length} entries → ${fileInserted} inserted, ${entries.length - fileInserted} skipped`
    );
  }

  console.log();
  console.log("=== Import complete ===");
  console.log(`Total entries processed : ${totalProcessed}`);
  console.log(`Total inserted          : ${totalInserted}`);
  console.log(`Total skipped           : ${totalSkipped}`);
  console.log(`Unique dedup keys       : ${seenKey.size}`);

  await db.$client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});

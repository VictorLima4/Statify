import { useGetSavedTracks, useGetSavedAlbums, useGetFollowedArtists, useGetPlaylists, SavedTracksResponse, SavedAlbumsResponse, SpotifyArtist, SpotifyPlaylist } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Music, Disc, Mic2, ListMusic } from "lucide-react";

export default function Library() {
  const { data: savedTracks, isLoading: loadingTracks } = useGetSavedTracks({ limit: 20 });
  const { data: savedAlbums, isLoading: loadingAlbums } = useGetSavedAlbums({ limit: 20 });
  const { data: followedArtists, isLoading: loadingArtists } = useGetFollowedArtists();
  const { data: playlists, isLoading: loadingPlaylists } = useGetPlaylists({ limit: 20 });

  const tracksData = savedTracks as SavedTracksResponse | undefined;
  const albumsData = savedAlbums as SavedAlbumsResponse | undefined;
  const artistsList = followedArtists as SpotifyArtist[] | undefined;
  const playlistsList = playlists as SpotifyPlaylist[] | undefined;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-black tracking-tight mb-2">Library</h1>
        <p className="text-muted-foreground text-lg">Everything you've saved on Spotify.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Saved Tracks */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Music className="w-5 h-5 text-primary" /> Saved Tracks</span>
              {tracksData?.total != null && (
                <span className="text-sm font-normal text-muted-foreground">{tracksData.total.toLocaleString()} total</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingTracks ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)
            ) : tracksData?.items?.slice(0, 10).map((track) => (
              <Link key={track.id} href={`/track/${track.id}`}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 transition-colors group">
                <img src={track.album?.images?.[0]?.url} alt={track.name} className="w-10 h-10 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{track.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artists?.map((a) => a.name).join(", ")}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Saved Albums */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Disc className="w-5 h-5 text-[#9b59b6]" /> Saved Albums</span>
              {albumsData?.total != null && (
                <span className="text-sm font-normal text-muted-foreground">{albumsData.total.toLocaleString()} total</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingAlbums ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)
            ) : albumsData?.items?.slice(0, 10).map((album) => (
              <Link key={album.id} href={`/album/${album.id}`}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 transition-colors group">
                <img src={album.images?.[0]?.url} alt={album.name} className="w-10 h-10 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{album.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {album.artists?.map((a) => a.name).join(", ")} · {album.releaseDate?.split("-")[0]}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Followed Artists */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Mic2 className="w-5 h-5 text-[#FF6B35]" /> Followed Artists</span>
              {artistsList && (
                <span className="text-sm font-normal text-muted-foreground">{artistsList.length} shown</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingArtists ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {artistsList?.slice(0, 12).map((artist) => (
                  <Link key={artist.id} href={`/artist/${artist.id}`}
                    className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors text-center group">
                    <img src={artist.images?.[0]?.url} alt={artist.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-transparent group-hover:border-primary transition-colors" />
                    <p className="text-xs font-medium truncate w-full group-hover:text-primary transition-colors">{artist.name}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Playlists */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><ListMusic className="w-5 h-5 text-[#4FC3F7]" /> Playlists</span>
              {playlistsList && (
                <span className="text-sm font-normal text-muted-foreground">{playlistsList.length} shown</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingPlaylists ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)
            ) : playlistsList?.slice(0, 10).map((pl) => (
              <div key={pl.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 transition-colors">
                {pl.images?.[0]?.url ? (
                  <img src={pl.images[0].url} alt={pl.name} className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                    <ListMusic className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pl.name}</p>
                  <p className="text-xs text-muted-foreground">{pl.tracksTotal} tracks · {pl.owner}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

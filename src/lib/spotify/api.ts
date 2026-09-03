const API_BASE = 'https://api.spotify.com/v1';

interface SpotifyArtist {
	name: string;
}

interface SpotifyImage {
	url: string;
}

interface SpotifyAlbum {
	name: string;
	images?: SpotifyImage[];
}

interface SpotifyTrack {
	id: string;
	uri: string;
	name: string;
	artists: SpotifyArtist[];
	album: SpotifyAlbum;
	duration_ms: number;
}

interface SimplifiedTrack {
	id: string;
	uri: string;
	name: string;
	artists: string[];
	album: string;
	albumImage: string | null;
	durationMs: number;
}

function simplifyTrack(track: SpotifyTrack): SimplifiedTrack {
	return {
		id: track.id,
		uri: track.uri,
		name: track.name,
		artists: track.artists.map((artist) => artist.name),
		album: track.album?.name,
		// Spotify lists album art largest-first; the middle size (~300px) is
		// plenty for a chat card and lighter than the full-size cover.
		albumImage: track.album?.images?.[1]?.url ?? track.album?.images?.[0]?.url ?? null,
		durationMs: track.duration_ms,
	};
}

interface SpotifyArtistResult {
	id: string;
	uri: string;
	name: string;
	genres: string[];
}

interface SpotifyAlbumResult {
	id: string;
	uri: string;
	name: string;
	artists: SpotifyArtist[];
}

function clampLimit(limit: number | undefined, fallback: number, max = 50): number {
	if (!limit || Number.isNaN(limit)) return fallback;
	return Math.min(Math.max(1, Math.floor(limit)), max);
}

async function spotifyFetch(accessToken: string, path: string, init?: RequestInit): Promise<any> {
	const response = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
			...init?.headers,
		},
	});

	if (!response.ok) {
		const body = await response.text();
		console.error(`[spotify] ${init?.method ?? 'GET'} ${path} -> ${response.status}: ${body}`);
		throw new Error(`Spotify API error (${response.status}): ${body}`);
	}

	if (response.status === 204) return null;
	return response.json();
}

export interface SearchOptions {
	query: string;
	types?: Array<'track' | 'artist' | 'album'>;
	limit?: number;
}

export async function searchSpotify(accessToken: string, { query, types, limit }: SearchOptions) {
	const searchTypes = types && types.length > 0 ? types : ['track'];
	const params = new URLSearchParams({
		q: query,
		type: searchTypes.join(','),
		limit: String(clampLimit(limit, 10, 10)),
	});

	const data = await spotifyFetch(accessToken, `/search?${params.toString()}`);

	return {
		tracks: (data.tracks?.items ?? []).map(simplifyTrack),
		artists: (data.artists?.items ?? []).map(
			(artist: SpotifyArtistResult) => ({ id: artist.id, uri: artist.uri, name: artist.name, genres: artist.genres })
		),
		albums: (data.albums?.items ?? []).map((album: SpotifyAlbumResult) => ({
			id: album.id,
			uri: album.uri,
			name: album.name,
			artists: album.artists.map((artist) => artist.name),
		})),
	};
}

export interface CreatePlaylistOptions {
	name: string;
	description?: string;
	trackUris?: string[];
}

export async function createPlaylist(accessToken: string, { name, description, trackUris }: CreatePlaylistOptions) {
	const playlist = await spotifyFetch(accessToken, '/me/playlists', {
		method: 'POST',
		body: JSON.stringify({ name, description, public: false }),
	});

	if (trackUris && trackUris.length > 0) {
		await addTracksToPlaylist(accessToken, { playlistId: playlist.id, trackUris });
	}

	return {
		id: playlist.id,
		name: playlist.name,
		url: playlist.external_urls?.spotify,
		trackCount: trackUris?.length ?? 0,
	};
}

export interface AddTracksOptions {
	playlistId: string;
	trackUris: string[];
}

export async function addTracksToPlaylist(accessToken: string, { playlistId, trackUris }: AddTracksOptions) {
	await spotifyFetch(accessToken, `/playlists/${playlistId}/items`, {
		method: 'POST',
		body: JSON.stringify({ uris: trackUris }),
	});

	return { added: trackUris.length };
}

export interface LibraryOptions {
	source?: 'saved' | 'top';
	timeRange?: 'short_term' | 'medium_term' | 'long_term';
	limit?: number;
}

export async function getLibraryTracks(accessToken: string, { source, timeRange, limit }: LibraryOptions) {
	const resolvedLimit = clampLimit(limit, 20);

	if (source === 'top') {
		const params = new URLSearchParams({
			limit: String(resolvedLimit),
			time_range: timeRange ?? 'medium_term',
		});
		const data = await spotifyFetch(accessToken, `/me/top/tracks?${params.toString()}`);
		return (data.items as SpotifyTrack[]).map(simplifyTrack);
	}

	const params = new URLSearchParams({ limit: String(resolvedLimit) });
	const data = await spotifyFetch(accessToken, `/me/tracks?${params.toString()}`);
	return (data.items as Array<{ track: SpotifyTrack }>).map((item) => simplifyTrack(item.track));
}

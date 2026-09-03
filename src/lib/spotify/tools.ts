import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import type { AstroCookies } from 'astro';
import { getValidAccessToken } from './auth';
import {
	addTracksToPlaylist,
	createPlaylist,
	getLibraryTracks,
	searchSpotify,
	type AddTracksOptions,
	type CreatePlaylistOptions,
	type LibraryOptions,
	type SearchOptions,
} from './api';

function notConnectedResult() {
	return {
		error: 'not_connected',
		message:
			'The visitor has not connected Spotify yet. Tell them to click "Connect Spotify" above the chat, then try again.',
	};
}

function errorResult(err: unknown) {
	return { error: err instanceof Error ? err.message : 'Spotify API error' };
}

// Built per-request (closing over the visitor's cookies) rather than as a
// module-level constant, since each tool needs the current request's Spotify
// session to resolve an access token before it can call the Spotify API.
export function createSpotifyTools(cookies: AstroCookies): ToolSet {
	async function withAccessToken<T>(fn: (accessToken: string) => Promise<T>) {
		const accessToken = await getValidAccessToken(cookies);
		if (!accessToken) return notConnectedResult();
		try {
			return await fn(accessToken);
		} catch (err) {
			return errorResult(err);
		}
	}

	return {
		search_spotify: tool({
			description:
				'Search Spotify for tracks, artists, or albums by name. Returns matches with their Spotify URIs, which are needed to add tracks to a playlist.',
			inputSchema: z.object({
				query: z.string().describe('Search query, e.g. a song title or artist name.'),
				types: z
					.array(z.enum(['track', 'artist', 'album']))
					.optional()
					.describe('Which types of results to search for. Defaults to ["track"].'),
				limit: z.number().optional().describe('Max results to return (default 10, max 10).'),
			}),
			execute: async (args: SearchOptions) => withAccessToken((accessToken) => searchSpotify(accessToken, args)),
		}),

		create_playlist: tool({
			description:
				"Create a new private playlist in the visitor's Spotify account, optionally seeded with initial tracks. Requires the visitor to have connected Spotify.",
			inputSchema: z.object({
				name: z.string().describe('Playlist name.'),
				description: z.string().optional().describe('Optional playlist description.'),
				track_uris: z
					.array(z.string())
					.optional()
					.describe('Spotify track URIs (from search_spotify) to add immediately.'),
			}),
			execute: async (args: { name: string; description?: string; track_uris?: string[] }) => {
				const options: CreatePlaylistOptions = {
					name: args.name,
					description: args.description,
					trackUris: args.track_uris,
				};
				return withAccessToken((accessToken) => createPlaylist(accessToken, options));
			},
		}),

		add_tracks_to_playlist: tool({
			description: 'Add one or more tracks to an existing playlist by its Spotify playlist ID.',
			inputSchema: z.object({
				playlist_id: z.string().describe('The Spotify playlist ID to add tracks to.'),
				track_uris: z.array(z.string()).describe('Spotify track URIs (from search_spotify) to add.'),
			}),
			execute: async (args: { playlist_id: string; track_uris: string[] }) => {
				const options: AddTracksOptions = { playlistId: args.playlist_id, trackUris: args.track_uris };
				return withAccessToken((accessToken) => addTracksToPlaylist(accessToken, options));
			},
		}),

		get_library_tracks: tool({
			description:
				"Read the visitor's saved (liked) tracks or top tracks, for inspiration or as a candidate pool. Requires the visitor to have connected Spotify.",
			inputSchema: z.object({
				source: z
					.enum(['saved', 'top'])
					.optional()
					.describe('Which set of tracks to read. Defaults to "saved".'),
				time_range: z
					.enum(['short_term', 'medium_term', 'long_term'])
					.optional()
					.describe('Only applies when source is "top". Defaults to "medium_term".'),
				limit: z.number().optional().describe('Max results to return (default 20, max 50).'),
			}),
			execute: async (args: { source?: 'saved' | 'top'; time_range?: LibraryOptions['timeRange']; limit?: number }) => {
				const options: LibraryOptions = { source: args.source, timeRange: args.time_range, limit: args.limit };
				return withAccessToken((accessToken) => getLibraryTracks(accessToken, options));
			},
		}),

		// Pure UI signal — makes no Spotify API call. search_spotify and
		// get_library_tracks are often used just to think (checking many more
		// tracks than should ever reach the visitor), so the app only renders
		// track cards in the chat when this tool is called, never from raw
		// search/library output.
		present_songs: tool({
			description:
				'Show a curated set of tracks to the visitor as cards. Call this with ONLY the tracks you ' +
				'specifically want the visitor to see — never the full/raw output of search_spotify or ' +
				'get_library_tracks. Set mode to "seed_candidates" to offer a handful of tracks the visitor can pick ' +
				'a seed from (rendered as selectable cards with a confirm button). Set mode to "playlist_preview" to ' +
				'show the exact tracks you intend to add before creating the playlist (rendered read-only with a ' +
				'"Create Playlist" button) — you must call this before create_playlist and wait for the visitor to ' +
				'confirm; never call create_playlist in the same turn you show a preview. Accepts at most 30 tracks ' +
				'per call — if the visitor wants a bigger playlist than that, tell them 30 is the max for now. This ' +
				'tool does not modify anything in Spotify.',
			inputSchema: z.object({
				mode: z
					.enum(['seed_candidates', 'playlist_preview'])
					.describe(
						'"seed_candidates" lets the visitor pick a seed song from options. "playlist_preview" shows ' +
							'the final track list you intend to create, before you create it.',
					),
				tracks: z
					.array(
						z.object({
							uri: z.string().describe('Spotify track URI, from a prior search_spotify or get_library_tracks result.'),
							name: z.string(),
							artists: z.array(z.string()),
							albumImage: z.string().nullable().optional(),
						}),
					)
					.min(1)
					.max(30),
			}),
			execute: async ({
				mode,
				tracks,
			}: {
				mode: 'seed_candidates' | 'playlist_preview';
				tracks: Array<{ uri: string; name: string; artists: string[]; albumImage?: string | null }>;
			}) => ({ mode, tracks }),
		}),
	};
}

import type { AstroCookies, AstroCookieSetOptions } from 'astro';

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

const SCOPES =
	'user-read-private playlist-modify-public playlist-modify-private user-library-read user-top-read';

export const COOKIE_NAMES = {
	accessToken: 'djme_sp_access_token',
	refreshToken: 'djme_sp_refresh_token',
	expiresAt: 'djme_sp_expires_at',
	oauthState: 'djme_sp_oauth_state',
} as const;

const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 60; // 60 days
const OAUTH_STATE_MAX_AGE = 600; // 10 minutes
const EXPIRY_SAFETY_BUFFER_MS = 60_000;

const baseCookieOptions: AstroCookieSetOptions = {
	httpOnly: true,
	secure: import.meta.env.PROD,
	sameSite: 'lax',
	path: '/',
};

interface SpotifyTokenResponse {
	access_token: string;
	token_type: string;
	scope: string;
	expires_in: number;
	refresh_token?: string;
}

export function buildAuthorizeUrl(state: string): string {
	const params = new URLSearchParams({
		client_id: import.meta.env.SPOTIFY_CLIENT_ID,
		response_type: 'code',
		redirect_uri: import.meta.env.SPOTIFY_REDIRECT_URI,
		scope: SCOPES,
		state,
	});
	return `${AUTHORIZE_URL}?${params.toString()}`;
}

function basicAuthHeader(): string {
	const credentials = `${import.meta.env.SPOTIFY_CLIENT_ID}:${import.meta.env.SPOTIFY_CLIENT_SECRET}`;
	return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

async function requestToken(body: URLSearchParams): Promise<SpotifyTokenResponse> {
	const response = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: basicAuthHeader(),
		},
		body,
	});

	if (!response.ok) {
		throw new Error(`Spotify token request failed (${response.status})`);
	}

	return response.json();
}

export function exchangeCodeForTokens(code: string): Promise<SpotifyTokenResponse> {
	return requestToken(
		new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: import.meta.env.SPOTIFY_REDIRECT_URI,
		})
	);
}

export function refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse> {
	return requestToken(
		new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
		})
	);
}

function setTokenCookies(cookies: AstroCookies, tokens: SpotifyTokenResponse): void {
	const expiresAt = Date.now() + tokens.expires_in * 1000;

	cookies.set(COOKIE_NAMES.accessToken, tokens.access_token, {
		...baseCookieOptions,
		maxAge: tokens.expires_in,
	});
	cookies.set(COOKIE_NAMES.expiresAt, String(expiresAt), {
		...baseCookieOptions,
		maxAge: REFRESH_TOKEN_MAX_AGE,
	});
	if (tokens.refresh_token) {
		cookies.set(COOKIE_NAMES.refreshToken, tokens.refresh_token, {
			...baseCookieOptions,
			maxAge: REFRESH_TOKEN_MAX_AGE,
		});
	}
}

export function setOAuthStateCookie(cookies: AstroCookies, state: string): void {
	cookies.set(COOKIE_NAMES.oauthState, state, {
		...baseCookieOptions,
		maxAge: OAUTH_STATE_MAX_AGE,
	});
}

export function setSessionCookies(cookies: AstroCookies, tokens: SpotifyTokenResponse): void {
	setTokenCookies(cookies, tokens);
}

export function clearSessionCookies(cookies: AstroCookies): void {
	for (const name of Object.values(COOKIE_NAMES)) {
		cookies.delete(name, { path: '/' });
	}
}

/**
 * Returns a valid Spotify access token, refreshing it first if it's expired
 * or about to expire. Returns null if the visitor has never connected, or if
 * the refresh token has been revoked (in which case the session cookies are
 * cleared so the caller can treat this as a clean "disconnected" state).
 */
export async function getValidAccessToken(cookies: AstroCookies): Promise<string | null> {
	const refreshToken = cookies.get(COOKIE_NAMES.refreshToken)?.value;
	if (!refreshToken) return null;

	const accessToken = cookies.get(COOKIE_NAMES.accessToken)?.value;
	const expiresAt = Number(cookies.get(COOKIE_NAMES.expiresAt)?.value ?? 0);

	if (accessToken && Date.now() < expiresAt - EXPIRY_SAFETY_BUFFER_MS) {
		return accessToken;
	}

	try {
		const tokens = await refreshAccessToken(refreshToken);
		setTokenCookies(cookies, tokens);
		return tokens.access_token;
	} catch {
		clearSessionCookies(cookies);
		return null;
	}
}

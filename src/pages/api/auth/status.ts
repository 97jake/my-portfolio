export const prerender = false;

import type { APIRoute } from 'astro';
import { getValidAccessToken } from '../../../lib/spotify/auth';

export const GET: APIRoute = async ({ cookies }) => {
	const accessToken = await getValidAccessToken(cookies);
	if (!accessToken) {
		return Response.json({ connected: false });
	}

	const response = await fetch('https://api.spotify.com/v1/me', {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!response.ok) {
		return Response.json({ connected: false });
	}

	const profile = await response.json();
	return Response.json({ connected: true, displayName: profile.display_name as string | null });
};

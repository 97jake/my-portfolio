export const prerender = false;

import type { APIRoute } from 'astro';
import { clearSessionCookies } from '../../../lib/spotify/auth';

export const POST: APIRoute = ({ cookies }) => {
	clearSessionCookies(cookies);
	return Response.json({ connected: false });
};

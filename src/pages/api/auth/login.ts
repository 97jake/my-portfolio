export const prerender = false;

import type { APIRoute } from 'astro';
import { buildAuthorizeUrl, setOAuthStateCookie } from '../../../lib/spotify/auth';

export const GET: APIRoute = ({ cookies, redirect }) => {
	const state = crypto.randomUUID();
	setOAuthStateCookie(cookies, state);
	return redirect(buildAuthorizeUrl(state));
};

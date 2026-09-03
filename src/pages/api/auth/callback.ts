export const prerender = false;

import type { APIRoute } from 'astro';
import { COOKIE_NAMES, exchangeCodeForTokens, setSessionCookies } from '../../../lib/spotify/auth';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');

	const expectedState = cookies.get(COOKIE_NAMES.oauthState)?.value;
	cookies.delete(COOKIE_NAMES.oauthState, { path: '/' });

	if (error) {
		return redirect('/djme?spotify=denied');
	}

	if (!code || !state || state !== expectedState) {
		return redirect('/djme?spotify=error');
	}

	try {
		const tokens = await exchangeCodeForTokens(code);
		setSessionCookies(cookies, tokens);
		return redirect('/djme?spotify=connected');
	} catch {
		return redirect('/djme?spotify=error');
	}
};

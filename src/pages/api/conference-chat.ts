export const prerender = false;

import type { APIRoute } from 'astro';
import { isRateLimited } from '../../lib/rate-limit';

const MAX_QUESTION_LENGTH = 2000;

export const POST: APIRoute = async ({ request, clientAddress }) => {
	if (isRateLimited(clientAddress)) {
		return new Response(
			JSON.stringify({ error: "You're sending messages too fast. Please wait a bit and try again." }),
			{ status: 429 },
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
	}

	const question = (body as { question?: unknown })?.question;
	if (typeof question !== 'string' || question.length === 0 || question.length > MAX_QUESTION_LENGTH) {
		return new Response(JSON.stringify({ error: 'Invalid question' }), { status: 400 });
	}

	try {
		// Server-to-server call to the Render-hosted FastAPI backend. The
		// backend URL and shared secret never reach the browser -- the
		// browser only ever talks to this same-origin route.
		const backendRes = await fetch(`${import.meta.env.CONFERENCE_RAG_BACKEND_URL}/chat`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Internal-Key': import.meta.env.CONFERENCE_RAG_SHARED_SECRET,
			},
			body: JSON.stringify({ question }),
		});

		const data = await backendRes.text();
		return new Response(data, {
			status: backendRes.status,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err) {
		// Most commonly a timeout while Render's free tier spins back up from
		// an idle scale-to-zero -- the client surfaces this as a retry prompt.
		console.error('[conference-chat] backend request failed:', err);
		return new Response(
			JSON.stringify({ error: 'The backend may be waking up -- please wait a moment and try again.' }),
			{ status: 502 },
		);
	}
};

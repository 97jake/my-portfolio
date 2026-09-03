const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15;

// Per-instance, in-memory sliding window keyed by client IP. On serverless
// (Netlify Functions) this resets on cold start and isn't shared across
// concurrent instances — it deters casual abuse/cost overruns on a low-traffic
// demo, not a hardened defense against a determined distributed attacker.
const hits = new Map<string, number[]>();

function prune(now: number): void {
	for (const [key, timestamps] of hits) {
		const fresh = timestamps.filter((t) => now - t < WINDOW_MS);
		if (fresh.length === 0) {
			hits.delete(key);
		} else {
			hits.set(key, fresh);
		}
	}
}

export function isRateLimited(key: string): boolean {
	const now = Date.now();
	const timestamps = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
	timestamps.push(now);
	hits.set(key, timestamps);

	// Bound memory on a long-lived warm instance instead of growing forever.
	if (hits.size > 5000) prune(now);

	return timestamps.length > MAX_REQUESTS_PER_WINDOW;
}

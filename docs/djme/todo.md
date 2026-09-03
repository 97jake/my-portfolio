# todo

## Methodology

Exploring how to find songs with similar "vibes" algorithmically, instead of (or alongside) curating by ear — starting point was the "oh yeah?" by Steve Lacy playlist, built by hand from genre/instrumentation knowledge and verified against Spotify search.

### Option 1: MusicBrainz + AcousticBrainz — ruled out for now

- Spotify deprecated its own `/audio-features`, `/audio-analysis`, `/recommendations`, and `/related-artists` endpoints for new API access in Nov 2024, which is why we looked elsewhere.
- AcousticBrainz's live per-track API has been offline since Feb 2022 (MTG/UPF shut down the project). No way to query a single MBID on demand anymore.
- The full dataset (~7.5M recordings, low-level + high-level descriptors, CC0-licensed) is still downloadable as a frozen bulk dump dated June 2022 — but using it means downloading multi-GB tarballs and building a local index (e.g. SQLite keyed by MBID), not calling an API.
- Matching a Spotify track to a MusicBrainz MBID reliably requires the track's ISRC (via Spotify's `external_ids.isrc`, not exposed by our current Spotify MCP tools) fed into MusicBrainz's ISRC lookup (`/ws/2/isrc/{ISRC}`). Fuzzy artist/title matching is noisier.
- Dataset is frozen at mid-2022, so anything released after has no fingerprint at all — a real coverage gap for current music.
- Conclusion: technically sound but heavy one-time data-engineering lift for stale coverage. Parked unless we hit a wall elsewhere.

### Option 2: ReccoBeats — validated, looks viable

Tested live against the real API (no key/auth required, base URL `https://api.reccobeats.com/v1/`):

- `GET /v1/track?ids={spotifyTrackId}` resolves a Spotify track ID directly to a ReccoBeats UUID + metadata (including ISRC) — confirmed working on "oh yeah?" (`22NHkFYbgxB2Zirj29Gbp8`).
- `GET /v1/track/{reccobeatsId}/audio-features` returns the exact old Spotify audio-features schema — confirmed live:
  ```
  acousticness: 0.0192   danceability: 0.52   energy: 0.89
  instrumentalness: 0.00478   key: 1   liveness: 0.101
  loudness: -4.984   mode: 1   speechiness: 0.0535
  tempo: 143.999   valence: 0.236
  ```
- `GET /v1/track/recommendation?seeds={spotifyId}&size=N` is their own black-box recommender (Spotify's dead `/recommendations` endpoint, reincarnated). Tested seeded on "oh yeah?" — results (Sadturs, Baby Keem, SXTN) were numerically close but genre/scene-scattered (Italian drill, hip-hop, German rap). Confirms pure audio-feature similarity misses genre/instrumentation/scene texture, which is exactly the quality that made the hand-picked playlist work.
- Rate limiting exists (429 on excess) but exact thresholds are undocumented — fine for dozens of calls, needs throttling/backoff if scaled to hundreds+.
- No auth/API key required at all, which makes this far more prototypable than the MusicBrainz route.

**Working plan:** pull the 11-dim audio-features vector per track (ourselves, not their recommender) for a seed track plus a candidate pool, weight dimensions by hand (lean into energy/danceability/valence, discount tempo/loudness since montage vibe isn't strictly tempo-locked), and rank candidates by cosine similarity — giving us control their black-box recommender doesn't have.

**Open question:** where the candidate pool comes from (saved tracks / related artists / genre or playlist scrape) — cosine similarity is only as good as what it's scoring against.

## Next steps

- [ ] Decide candidate-pool source for similarity scoring
- [ ] Prototype: pull audio-features vectors for the 19-track "oh yeah?" playlist + a candidate pool
- [ ] Implement weighted cosine similarity ranking, compare against the hand-picked playlist as a sanity check
- [ ] Extend the ranking to serve djme's round-based loop (README): given the current seed/anchor track, return the *top 5* candidates rather than one ranked list — this is what gets shown to the user each round
- [ ] Define what happens to a round's other 4 (unpicked) candidates and how a "none of these fit" response reshapes the next round's candidate pool

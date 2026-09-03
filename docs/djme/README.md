# djme

**djme** is a chat-based DJ. Describe a mood, a moment, a scene — anything from *"I'm driving with my top down in Arizona during the summer"* to *"it's a rainy day in Vermont but I'm happy and curled up in a blanket"* — and djme turns that vibe into a real Spotify playlist.

Instead of scrolling through mood playlists someone else made, you describe your own moment in plain language, refine it with feedback, and get a playlist built specifically for it.

## How it works

djme doesn't generate a full playlist in one shot — it builds one with you, one song at a time.

1. **Describe the vibe.** Tell djme what's going on — where you are, what you're doing, how you feel, the weather, the season, whatever's relevant.
2. **djme picks a seed song.** Using your description, djme chooses (or lets you name) a starting track that anchors the vibe.
3. **djme offers five options for what's next.** Based on the seed (and everything picked so far), djme proposes five candidate songs.
4. **You pick the one that fits — or none of them.** Your pick becomes the newest song in the playlist and the new anchor for the next round. If none fit, djme offers five more.
5. **Repeat.** Round by round, the playlist is built entirely from your choices, not a single generated batch — so it stays "yours" without needing a separate feedback/editing step afterward.

## Example prompts

- "I'm driving with my top down in Arizona during the summer"
- "It's a rainy day in Vermont but I'm happy and curled up in a blanket"
- "Sunday morning, making pancakes, nobody's awake yet"
- "Last day of a breakup, I want to feel powerful, not sad"
- "Late night coding session, need to focus but not fall asleep"

## Planned architecture

| Layer | Role |
|---|---|
| Chat interface | Collects the vibe description and presents each round's five options for the user to pick from |
| LLM | Interprets the vibe into a seed song (or structured attributes to pick one), and shapes which candidates get surfaced each round |
| Recommendation engine | Scores a candidate pool against the current seed/anchor (audio-feature similarity, weighted by vibe) to produce each round's five options |
| Spotify Web API | Track/candidate lookup, audio-feature data, and creating/updating the real playlist in the user's account |
| Session/state | Tracks the seed, pick history, and rejected tracks so each round builds on the last instead of starting fresh |

## Status

This project is in early planning — no application code yet. This README captures the intended product direction before implementation begins.

## Requirements (planned)

- A Spotify account and a [Spotify Developer](https://developer.spotify.com/dashboard) app (Client ID/Secret) for playlist creation via OAuth
- An LLM API key (e.g., Anthropic) for interpreting prompts

## Setup

Coming soon — setup instructions will be added once the initial implementation lands.

## Roadmap

- [ ] Chat interface for describing a vibe
- [ ] LLM prompt interpretation → seed song selection
- [ ] Recommendation engine: candidate pool + similarity scoring for "five options" rounds (see `todo.md`)
- [ ] Round-based pick loop (five options → pick one or none → repeat) wired to session state
- [ ] Spotify OAuth + real-time playlist creation as picks are made
- [ ] Save/share generated playlists

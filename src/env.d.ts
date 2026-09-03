/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly ANTHROPIC_API_KEY: string;
	readonly SPOTIFY_CLIENT_ID: string;
	readonly SPOTIFY_CLIENT_SECRET: string;
	readonly SPOTIFY_REDIRECT_URI: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

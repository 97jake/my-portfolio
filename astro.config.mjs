// @ts-check

import mdx from '@astrojs/mdx';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://jake-snow.netlify.app/',
	adapter: netlify(),
	integrations: [mdx(), sitemap()],
	vite: {
		// Our CSP is script-src 'self' with no 'unsafe-inline', so small page
		// scripts must never get inlined into the HTML (Vite's default
		// assetsInlineLimit does this under 4kb) or the browser silently
		// blocks them.
		build: {
			assetsInlineLimit: 0,
		},
	},
	markdown: {
		shikiConfig: {
			theme: 'dracula',
			wrap: true,
		},
	},
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});

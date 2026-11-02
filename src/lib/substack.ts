// Fetches The Snow Report (Jake's Substack) through its public RSS feed.
// Substack has no public posts API, and CORS blocks browser-side fetches,
// so this runs server-side. Every publication exposes /feed by default.
export const SUBSTACK_HOME = 'https://jakesnow.substack.com';
export const SUBSTACK_FEED = `${SUBSTACK_HOME}/feed`;

export interface SubstackPost {
	title: string;
	link: string;
	pubDate: Date;
	excerpt: string;
}

function decodeEntities(text: string): string {
	return text
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
		.replace(/&quot;/g, '"')
		.replace(/&#039;|&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}

function stripTags(html: string): string {
	return decodeEntities(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function field(item: string, tag: string): string {
	const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
	return m ? decodeEntities(m[1].trim()) : '';
}

export function parseSubstackFeed(xml: string): SubstackPost[] {
	const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
	return items
		.map((item) => {
			const content = field(item, 'content:encoded');
			const description = field(item, 'description');
			const excerptSource = description.length > 40 ? description : stripTags(content);
			return {
				title: field(item, 'title'),
				link: field(item, 'link'),
				pubDate: new Date(field(item, 'pubDate')),
				excerpt:
					excerptSource.length > 180 ? `${excerptSource.slice(0, 177).trimEnd()}...` : excerptSource,
			};
		})
		.filter((p) => p.title && p.link && !Number.isNaN(p.pubDate.valueOf()));
}

export async function getSubstackPosts(): Promise<SubstackPost[]> {
	const res = await fetch(SUBSTACK_FEED, {
		headers: { 'user-agent': 'jake-snow.netlify.app blog sync' },
		signal: AbortSignal.timeout(5000),
	});
	if (!res.ok) throw new Error(`Substack feed HTTP ${res.status}`);
	return parseSubstackFeed(await res.text());
}

#!/usr/bin/env node
// Converts a cleaned-up Jupyter notebook (.ipynb) into a draft MDX blog post
// under src/content/blog/, extracting chart images into public/blog/<slug>/.
// Output is a draft: review prose, output, and frontmatter before publishing.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function parseArgs(argv) {
	const args = { flags: {} };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg.startsWith('--')) {
			args.flags[arg.slice(2)] = argv[i + 1];
			i++;
		} else {
			args.notebookPath = arg;
		}
	}
	return args;
}

function slugify(input) {
	return input
		.toLowerCase()
		.replace(/\.[^/.]+$/, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function humanize(slug) {
	return slug
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

function joinSource(source) {
	return Array.isArray(source) ? source.join('') : source ?? '';
}

function cleanDataframeHtml(html) {
	return html.replace(/<style[\s\S]*?<\/style>/gi, '').trim();
}

function stripDuplicateTitleHeading(text, title) {
	const lines = text.split('\n');
	const headingMatch = (lines[0] ?? '').match(/^#{1,6}\s+(.*)$/);
	if (headingMatch && headingMatch[1].trim().toLowerCase() === title.trim().toLowerCase()) {
		lines.shift();
		while (lines[0] === '') lines.shift();
		return lines.join('\n').trim();
	}
	return text;
}

function linkifyBareUrls(text) {
	return text.replace(/(?<!\]\()(?<!<)(https?:\/\/[^\s)<>]+)(?!>)/g, '<$1>');
}

function todayISO() {
	return new Date().toISOString().slice(0, 10);
}

const { notebookPath, flags } = parseArgs(process.argv.slice(2));

if (!notebookPath) {
	console.error('Usage: node scripts/ipynb-to-mdx.mjs <notebook.ipynb> [--slug my-slug] [--title "..."] [--description "..."] [--date YYYY-MM-DD]');
	process.exit(1);
}

const notebook = JSON.parse(readFileSync(notebookPath, 'utf-8'));
const slug = flags.slug ?? slugify(basename(notebookPath));
const title = flags.title ?? humanize(slug);
const description = flags.description ?? 'TODO: write a one-sentence description.';
const pubDate = flags.date ?? todayISO();

const language =
	notebook.metadata?.kernelspec?.language ?? notebook.metadata?.language_info?.name ?? 'python';

const imageDir = join(repoRoot, 'public', 'blog', slug);
let imageCount = 0;
let markdownCellCount = 0;
let codeCellCount = 0;
let skippedOutputCount = 0;
const usedComponents = new Set();

const bodyParts = [];
let firstMarkdownSeen = false;

notebook.cells.forEach((cell, cellIndex) => {
	if (cell.cell_type === 'markdown') {
		markdownCellCount++;
		let text = joinSource(cell.source).trim();
		if (!firstMarkdownSeen) {
			firstMarkdownSeen = true;
			text = stripDuplicateTitleHeading(text, title);
		}
		text = linkifyBareUrls(text);
		if (text) bodyParts.push(text);
		return;
	}

	if (cell.cell_type !== 'code') return;

	codeCellCount++;
	const source = joinSource(cell.source).trim();
	if (source) {
		bodyParts.push('```' + language + '\n' + source + '\n```');
	}

	for (const output of cell.outputs ?? []) {
		if (output.output_type === 'stream') {
			const text = joinSource(output.text).trim();
			if (text) {
				usedComponents.add('Output');
				bodyParts.push(`<Output text={${JSON.stringify(text)}} />`);
			}
			continue;
		}

		if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
			const data = output.data ?? {};
			if (data['image/png']) {
				mkdirSync(imageDir, { recursive: true });
				imageCount++;
				const fileName = `${cellIndex}-${imageCount}.png`;
				const pngData = Array.isArray(data['image/png'])
					? data['image/png'].join('')
					: data['image/png'];
				writeFileSync(join(imageDir, fileName), Buffer.from(pngData, 'base64'));
				usedComponents.add('Figure');
				bodyParts.push(`<Figure src="/blog/${slug}/${fileName}" alt="Chart output" />`);
				continue;
			}
			const htmlOutput = data['text/html'] ? joinSource(data['text/html']) : null;
			if (htmlOutput && /<table/i.test(htmlOutput)) {
				usedComponents.add('Table');
				bodyParts.push(`<Table html={${JSON.stringify(cleanDataframeHtml(htmlOutput))}} />`);
				continue;
			}
			if (data['text/plain']) {
				const text = joinSource(data['text/plain']).trim();
				if (text) {
					usedComponents.add('Output');
					bodyParts.push(`<Output text={${JSON.stringify(text)}} />`);
				}
				continue;
			}
			skippedOutputCount++;
			console.warn(`Skipped ${output.output_type} output in cell ${cellIndex} (no image/png or text/plain).`);
			continue;
		}

		if (output.output_type === 'error') {
			usedComponents.add('Output');
			const text = `${output.ename}: ${output.evalue}`;
			bodyParts.push(`<Output text={${JSON.stringify(text)}} />`);
			continue;
		}

		skippedOutputCount++;
		console.warn(`Skipped unrecognized output_type "${output.output_type}" in cell ${cellIndex}.`);
	}
});

const imports = [];
if (usedComponents.has('Figure')) imports.push("import Figure from '../../components/Figure.astro';");
if (usedComponents.has('Output')) imports.push("import Output from '../../components/Output.astro';");
if (usedComponents.has('Table')) imports.push("import Table from '../../components/Table.astro';");

const frontmatter = [
	'---',
	`title: "${title}"`,
	`description: "${description}"`,
	`pubDate: ${pubDate}`,
	'---',
].join('\n');

const mdx = [frontmatter, imports.join('\n'), bodyParts.join('\n\n')].filter(Boolean).join('\n\n') + '\n';

const outPath = join(repoRoot, 'src', 'content', 'blog', `${slug}.mdx`);
writeFileSync(outPath, mdx);

console.log(`Wrote draft post: ${outPath}`);
console.log(
	`  ${markdownCellCount} markdown cells, ${codeCellCount} code cells, ${imageCount} image(s) extracted to public/blog/${slug}/${skippedOutputCount ? `, ${skippedOutputCount} output(s) skipped (see warnings above)` : ''}.`,
);
console.log('This is a draft — review the prose, outputs, and frontmatter before publishing.');

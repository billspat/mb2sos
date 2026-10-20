#!/usr/bin/env node
// Scans static/samples for CSV datasets and (re)generates manifest.json so the UI
// can list whatever real Movebank downloads have been dropped in that folder.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const samplesDir = fileURLToPath(new URL('../static/samples', import.meta.url));

/** Minimal quote-aware CSV line splitter, sufficient for header/data rows. */
function parseCsvLine(line) {
	const cells = [];
	let field = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (inQuotes) {
			if (c === '"') {
				if (line[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += c;
			}
		} else if (c === '"') {
			inQuotes = true;
		} else if (c === ',') {
			cells.push(field);
			field = '';
		} else {
			field += c;
		}
	}
	cells.push(field);
	return cells;
}

function normalizeHeader(h) {
	return h.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
}

function findColumn(header, aliases) {
	const normalized = header.map(normalizeHeader);
	for (const alias of aliases) {
		const i = normalized.indexOf(alias);
		if (i !== -1) return i;
	}
	return -1;
}

function titleCaseFromFilename(file) {
	return file
		.replace(/\.[^.]+$/, '')
		.replace(/[-_]+/g, ' ')
		.trim();
}

function describeCsv(file) {
	const text = readFileSync(join(samplesDir, file), 'utf8');
	const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
	if (lines.length === 0) return { file, label: titleCaseFromFilename(file) };

	const header = parseCsvLine(lines[0]);
	const speciesCol = findColumn(header, ['individual-taxon-canonical-name', 'species']);
	const studyCol = findColumn(header, ['study-name']);

	let species;
	let label;
	for (let i = 1; i < lines.length && (!species || !label); i++) {
		const cells = parseCsvLine(lines[i]);
		if (!species && speciesCol >= 0 && cells[speciesCol]?.trim()) {
			species = cells[speciesCol].trim();
		}
		if (!label && studyCol >= 0 && cells[studyCol]?.trim()) {
			label = cells[studyCol].trim();
		}
	}

	return { file, label: label ?? titleCaseFromFilename(file), species };
}

const entries = readdirSync(samplesDir)
	.filter((f) => f.toLowerCase().endsWith('.csv'))
	.sort()
	.map(describeCsv);

writeFileSync(join(samplesDir, 'manifest.json'), JSON.stringify(entries, null, '\t') + '\n');

console.log(`Wrote static/samples/manifest.json with ${entries.length} dataset(s).`);

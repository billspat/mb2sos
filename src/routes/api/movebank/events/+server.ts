import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseCsvRows } from '$lib/parse';

const MOVEBANK_BASE = 'https://www.movebank.org/movebank/service/direct-read';
const FETCH_TIMEOUT_MS = 15_000;

function buildAuthHeader(username: string | null, password: string | null): HeadersInit {
	if (!username || !password) return {};
	const token = btoa(`${username}:${password}`);
	return { Authorization: `Basic ${token}` };
}

function toIsoUtc(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const isoLike = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T') + 'Z';
	const ms = Date.parse(isoLike);
	return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/**
 * Proxies event (location) data for a study to Movebank's direct-read API.
 * GET /api/movebank/events?study_id=123&username=...&password=...
 */
export const GET: RequestHandler = async ({ url, fetch }) => {
	const studyId = url.searchParams.get('study_id');
	const username = url.searchParams.get('username');
	const password = url.searchParams.get('password');

	if (!studyId) {
		return json({ error: 'Missing study_id parameter', events: [] }, { status: 400 });
	}

	const params = new URLSearchParams({ entity: 'event', study_id: studyId, attributes: 'all' });
	const target = `${MOVEBANK_BASE}?${params.toString()}`;

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	try {
		const res = await fetch(target, {
			headers: buildAuthHeader(username, password),
			signal: controller.signal
		});

		if (!res.ok) {
			return json(
				{ error: `Movebank responded with status ${res.status}`, events: [] },
				{ status: 502 }
			);
		}

		const text = await res.text();
		const rows = parseCsvRows(text);
		if (rows.length < 2) {
			return json({ events: [] });
		}

		const [header, ...body] = rows;
		const idx = (...names: string[]) =>
			names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
		const iTime = idx('timestamp');
		const iLat = idx('location-lat', 'location_lat');
		const iLon = idx('location-long', 'location_long');
		const iIndividual = idx('individual-local-identifier', 'individual_id', 'individual-id');

		if (iTime < 0 || iLat < 0 || iLon < 0) {
			return json({ error: 'Unexpected Movebank event schema', events: [] }, { status: 502 });
		}

		const events = body
			.map((cells) => {
				const lat = Number.parseFloat(cells[iLat]);
				const lon = Number.parseFloat(cells[iLon]);
				const timestamp = toIsoUtc(cells[iTime] ?? '');
				const individualId = iIndividual >= 0 ? cells[iIndividual] : undefined;
				return { timestamp, lat, lon, individualId };
			})
			.filter(
				(
					e
				): e is { timestamp: string; lat: number; lon: number; individualId: string | undefined } =>
					e.timestamp !== null && Number.isFinite(e.lat) && Number.isFinite(e.lon)
			);

		return json({ events });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error contacting Movebank';
		return json({ error: message, events: [] }, { status: 502 });
	} finally {
		clearTimeout(timeout);
	}
};

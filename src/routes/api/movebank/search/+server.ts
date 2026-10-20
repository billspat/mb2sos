import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseCsvRows } from '$lib/parse';
import type { MovebankStudySummary } from '$lib/types';

const MOVEBANK_BASE = 'https://www.movebank.org/movebank/service/direct-read';
const FETCH_TIMEOUT_MS = 10_000;

function buildAuthHeader(username: string | null, password: string | null): HeadersInit {
	if (!username || !password) return {};
	const token = btoa(`${username}:${password}`);
	return { Authorization: `Basic ${token}` };
}

/**
 * Proxies a study search to Movebank's direct-read API, filtered by taxon/species name.
 * GET /api/movebank/search?species=Panthera+leo&username=...&password=...
 */
export const GET: RequestHandler = async ({ url, fetch }) => {
	const species = url.searchParams.get('species')?.trim() ?? '';
	const username = url.searchParams.get('username');
	const password = url.searchParams.get('password');

	const params = new URLSearchParams({ entity: 'study', i_can_see_data: 'true' });
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
				{ error: `Movebank responded with status ${res.status}`, studies: [] },
				{ status: 502 }
			);
		}

		const text = await res.text();
		const rows = parseCsvRows(text);
		if (rows.length < 2) {
			return json({ studies: [] });
		}

		const [header, ...body] = rows;
		const idx = (name: string) => header.indexOf(name);
		const iId = idx('id');
		const iName = idx('name');
		const iTaxon = idx('taxon_ids');
		const iSensor = idx('sensor_type_ids');
		const iEvents = idx('number_of_deployed_locations');
		const iLicense = idx('license_type');

		const needle = species.toLowerCase();
		const studies: MovebankStudySummary[] = body
			.map((cells) => ({
				studyId: cells[iId] ?? '',
				studyName: cells[iName] ?? '',
				species: cells[iTaxon] ?? '',
				sensorType: cells[iSensor] ?? '',
				numberOfEvents: Number.parseInt(cells[iEvents] ?? '0', 10) || 0,
				licenseType: cells[iLicense] ?? ''
			}))
			.filter((s) => (needle ? s.species.toLowerCase().includes(needle) : true))
			.slice(0, 50);

		return json({ studies });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error contacting Movebank';
		return json({ error: message, studies: [] }, { status: 502 });
	} finally {
		clearTimeout(timeout);
	}
};

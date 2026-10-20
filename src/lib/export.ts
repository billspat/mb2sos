import JSZip from 'jszip';
import type { Dataset } from './types';
import { summarizeDataset } from './geo';

function isoUtc(ms: number): string {
	return new Date(ms).toISOString();
}

export function buildGeoJson(dataset: Dataset): string {
	const features = dataset.points.map((p) => ({
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
		properties: {
			timestamp: isoUtc(p.timestampMs),
			individual_id: p.individualId,
			species: dataset.species,
			latitude: p.lat,
			longitude: p.lon
		}
	}));

	const geojson = {
		type: 'FeatureCollection',
		crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
		features
	};
	return JSON.stringify(geojson, null, 2);
}

function csvEscape(value: string | number): string {
	const s = String(value);
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(dataset: Dataset): string {
	const header = ['timestamp', 'individual_id', 'species', 'latitude', 'longitude'];
	const lines = [header.join(',')];
	for (const p of dataset.points) {
		lines.push(
			[isoUtc(p.timestampMs), p.individualId, dataset.species, p.lat, p.lon]
				.map(csvEscape)
				.join(',')
		);
	}
	return lines.join('\n');
}

export function buildReadme(dataset: Dataset): string {
	const summary = summarizeDataset(dataset);
	return `SOS Hand-off Package
=====================

Species: ${dataset.species}
Movebank Study ID: ${dataset.studyId ?? 'n/a'}
Study Name: ${dataset.studyName ?? 'n/a'}
Data source: ${dataset.source}
License: ${dataset.licenseType ?? 'see Movebank study license'}

Geographic Bounding Box
-----------------------
Min Latitude:  ${summary.minLat.toFixed(5)}
Max Latitude:  ${summary.maxLat.toFixed(5)}
Min Longitude: ${summary.minLon.toFixed(5)}
Max Longitude: ${summary.maxLon.toFixed(5)}

Temporal Extent
---------------
Start: ${isoUtc(summary.startMs)}
End:   ${isoUtc(summary.endMs)}

Counts
------
Total Points: ${summary.totalPoints}
Individual Animal Count: ${summary.individualIds.length}
Individuals: ${summary.individualIds.join(', ')}
Total Cumulative Trajectory Distance: ${summary.totalDistanceKm.toFixed(1)} km

QGIS Settings Note
-------------------
Layer Coordinate Reference System: EPSG:4326 - WGS 84.
Enable Temporal Controller using the 'timestamp' field.

Files in this package
----------------------
- epsg4326_telemetry.geojson : Point features in WGS 84 (EPSG:4326)
- movebank_sos_ready.csv     : Same data as flat CSV for QGIS "Add Delimited Text Layer"
- README_SOS_Hand-off.txt    : This file
`;
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain') {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export async function downloadZipBundle(dataset: Dataset) {
	const zip = new JSZip();
	zip.file('epsg4326_telemetry.geojson', buildGeoJson(dataset));
	zip.file('movebank_sos_ready.csv', buildCsv(dataset));
	zip.file('README_SOS_Hand-off.txt', buildReadme(dataset));
	const blob = await zip.generateAsync({ type: 'blob' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	const safeName = dataset.species.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
	a.download = `sos_handoff_${safeName || 'dataset'}.zip`;
	a.click();
	URL.revokeObjectURL(url);
}

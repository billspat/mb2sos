#!/usr/bin/env node
// Downloads 2:1 Plate Carrée (EPSG:4326) basemap images to static/basemaps/
// for use in the Science on a Sphere (SOS) canvas preview and video export.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const basemapsDir = fileURLToPath(new URL('../static/basemaps', import.meta.url));
mkdirSync(basemapsDir, { recursive: true });

const BASEMAP_SOURCES = [
	{
		filename: 'osm.jpg',
		label: 'OpenStreetMap (Terrestris WMS EPSG:4326)',
		url: 'https://ows.terrestris.de/osm/service?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&BBOX=-90,-180,90,180&CRS=EPSG:4326&WIDTH=2048&HEIGHT=1024&LAYERS=OSM-WMS&STYLES=&FORMAT=image/jpeg'
	},
	{
		filename: 'esri-satellite.jpg',
		label: 'Esri World Imagery (Satellite EPSG:4326)',
		url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-180,-90,180,90&bboxSR=4326&imageSR=4326&size=2048,1024&format=jpg&f=image'
	},
	{
		filename: 'esri-ocean.jpg',
		label: 'Esri Ocean Basemap (Bathymetry EPSG:4326)',
		url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/export?bbox=-180,-90,180,90&bboxSR=4326&imageSR=4326&size=2048,1024&format=jpg&f=image'
	}
];

async function main() {
	console.log('Downloading SOS basemap images (2048x1024 EPSG:4326)...');
	for (const source of BASEMAP_SOURCES) {
		const dest = join(basemapsDir, source.filename);
		console.log(`Fetching ${source.label}...`);
		try {
			const res = await fetch(source.url);
			if (!res.ok) {
				throw new Error(`HTTP ${res.status} ${res.statusText}`);
			}
			const buffer = Buffer.from(await res.arrayBuffer());
			writeFileSync(dest, buffer);
			console.log(` Saved ${source.filename} (${Math.round(buffer.length / 1024)} KB)`);
		} catch (err) {
			console.error(` Failed to download ${source.filename}:`, err);
		}
	}
	console.log('Done.');
}

main();

export type BasemapId = 'osm' | 'esri-satellite' | 'esri-ocean';
export type SosBasemapId = BasemapId | 'none';

export interface BasemapDef {
	id: BasemapId;
	label: string;
	url: string;
	sosAsset: string;
	attribution: string;
	maxZoom: number;
}

export const BASEMAPS: Record<BasemapId, BasemapDef> = {
	osm: {
		id: 'osm',
		label: 'OpenStreetMap',
		url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
		sosAsset: '/basemaps/osm.jpg',
		attribution: '© OpenStreetMap contributors',
		maxZoom: 19
	},
	'esri-satellite': {
		id: 'esri-satellite',
		label: 'Esri World Imagery',
		url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
		sosAsset: '/basemaps/esri-satellite.jpg',
		attribution: 'Tiles © Esri',
		maxZoom: 19
	},
	'esri-ocean': {
		id: 'esri-ocean',
		label: 'Esri Ocean Basemap',
		url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
		sosAsset: '/basemaps/esri-ocean.jpg',
		attribution: 'Tiles © Esri',
		maxZoom: 13
	}
};

export const SOS_BASEMAP_OPTIONS: { id: SosBasemapId; label: string; attribution?: string }[] = [
	{ id: 'osm', label: 'OpenStreetMap', attribution: BASEMAPS.osm.attribution },
	{
		id: 'esri-satellite',
		label: 'Esri World Imagery (Satellite)',
		attribution: BASEMAPS['esri-satellite'].attribution
	},
	{
		id: 'esri-ocean',
		label: 'Esri Ocean Basemap',
		attribution: BASEMAPS['esri-ocean'].attribution
	},
	{ id: 'none', label: 'None (Graticule only)' }
];

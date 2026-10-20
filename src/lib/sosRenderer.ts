import type { Dataset } from './types';
import { visiblePointsAtTime, colorForIndividual } from './geo';
import type { TailMode } from './state.svelte';
import { BASEMAPS, type SosBasemapId } from './basemaps';

export const SOS_WIDTH = 2048;
export const SOS_HEIGHT = 1024;

/** Projects WGS84 lon/lat onto an equirectangular (Plate Carrée) canvas of the given size. */
export function project(lon: number, lat: number, width: number, height: number): [number, number] {
	const x = ((lon + 180) / 360) * width;
	const y = ((90 - lat) / 180) * height;
	return [x, y];
}

const basemapImageCache = new Map<string, HTMLImageElement>();

/**
 * Retrieves a cached Image for the given basemap ID, creating it if needed.
 * Optionally attaches a single-fire load callback if the image is still loading.
 */
export function getBasemapImage(id: SosBasemapId, onLoad?: () => void): HTMLImageElement | null {
	if (id === 'none' || typeof window === 'undefined') return null;
	const def = BASEMAPS[id];
	if (!def) return null;

	let img = basemapImageCache.get(id);
	if (!img) {
		img = new Image();
		img.src = def.sosAsset;
		basemapImageCache.set(id, img);
	}

	if (!img.complete && onLoad) {
		img.addEventListener('load', onLoad, { once: true });
	}

	return img;
}

/** Preloads all SOS basemap images into the browser cache. */
export function preloadBasemaps() {
	if (typeof window === 'undefined') return;
	for (const id of Object.keys(BASEMAPS) as (keyof typeof BASEMAPS)[]) {
		getBasemapImage(id);
	}
}

function drawGraticule(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	basemapId: SosBasemapId
) {
	const isLight = basemapId === 'osm' || basemapId === 'esri-ocean';
	const lineStroke = isLight ? 'rgba(15, 23, 42, 0.22)' : 'rgba(148, 163, 184, 0.35)';
	const equatorStroke = isLight ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.65)';
	const labelFill = isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.7)';

	ctx.lineWidth = 1;
	ctx.font = `${Math.round(height / 60)}px sans-serif`;
	ctx.fillStyle = labelFill;

	// Parallels (latitude)
	for (let lat = -90; lat <= 90; lat += 30) {
		const [, y] = project(0, lat, width, height);
		ctx.strokeStyle = lat === 0 ? equatorStroke : lineStroke;
		ctx.lineWidth = lat === 0 ? 1.5 : 1;
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
		ctx.stroke();

		if (lat !== -90 && lat !== 90) {
			ctx.fillText(`${lat > 0 ? '+' : ''}${lat}°`, 12, y - 6);
		}
	}

	// Meridians (longitude)
	for (let lon = -180; lon <= 180; lon += 30) {
		const [x] = project(lon, 0, width, height);
		ctx.strokeStyle = lon === 0 ? equatorStroke : lineStroke;
		ctx.lineWidth = lon === 0 ? 1.5 : 1;
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, height);
		ctx.stroke();

		if (lon !== -180 && lon !== 180) {
			ctx.fillText(`${lon > 0 ? '+' : ''}${lon}°`, x + 6, height - 12);
		}
	}
}

/** Renders the current animation frame (basemap + graticule + trails + heads) onto the given canvas. */
export function renderSosFrame(
	canvas: HTMLCanvasElement,
	dataset: Dataset,
	currentTimeMs: number,
	tailMode: TailMode,
	individualIds: string[],
	basemapId: SosBasemapId = 'osm',
	basemapImage?: HTMLImageElement | null
) {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const { width, height } = canvas;

	// Draw basemap or fallback dark color
	const img = basemapImage ?? (basemapId !== 'none' ? getBasemapImage(basemapId) : null);
	if (img && img.complete && img.naturalWidth > 0) {
		ctx.drawImage(img, 0, 0, width, height);
	} else {
		ctx.fillStyle = '#0b1120';
		ctx.fillRect(0, 0, width, height);
	}

	drawGraticule(ctx, width, height, basemapId);

	const visible = visiblePointsAtTime(dataset, currentTimeMs, tailMode);
	for (const [id, points] of visible) {
		if (points.length === 0) continue;
		const color = colorForIndividual(id, individualIds);

		if (points.length > 1) {
			ctx.strokeStyle = color;
			ctx.lineWidth = Math.max(2, width / 1024);
			ctx.beginPath();
			points.forEach((p, i) => {
				const [x, y] = project(p.lon, p.lat, width, height);
				if (i === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			});
			ctx.stroke();
		}

		const head = points[points.length - 1];
		const [hx, hy] = project(head.lon, head.lat, width, height);
		const headRadius = Math.max(4, width / 300);

		// Outer halo for high contrast against any basemap
		ctx.beginPath();
		ctx.arc(hx, hy, headRadius + 1.5, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
		ctx.fill();

		// Animal marker
		ctx.beginPath();
		ctx.arc(hx, hy, headRadius, 0, Math.PI * 2);
		ctx.fillStyle = color;
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = '#ffffff';
		ctx.stroke();
	}
}

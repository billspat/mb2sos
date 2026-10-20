import type { Dataset } from './types';
import { visiblePointsAtTime, colorForIndividual } from './geo';
import type { TailMode } from './state.svelte';

export const SOS_WIDTH = 2048;
export const SOS_HEIGHT = 1024;

/** Projects WGS84 lon/lat onto an equirectangular (Plate Carrée) canvas of the given size. */
export function project(lon: number, lat: number, width: number, height: number): [number, number] {
	const x = ((lon + 180) / 360) * width;
	const y = ((90 - lat) / 180) * height;
	return [x, y];
}

function drawGraticule(ctx: CanvasRenderingContext2D, width: number, height: number) {
	ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
	ctx.lineWidth = 1;
	ctx.font = `${Math.round(height / 60)}px sans-serif`;
	ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';

	for (let lon = -180; lon <= 180; lon += 30) {
		const [x] = project(lon, 0, width, height);
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, height);
		ctx.stroke();
	}
	for (let lat = -90; lat <= 90; lat += 30) {
		const [, y] = project(0, lat, width, height);
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
		ctx.stroke();
	}

	// Equator and prime meridian, emphasized.
	ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
	const [, equatorY] = project(0, 0, width, height);
	ctx.beginPath();
	ctx.moveTo(0, equatorY);
	ctx.lineTo(width, equatorY);
	ctx.stroke();
}

/** Renders the current animation frame (graticule + trails + heads) onto the given canvas. */
export function renderSosFrame(
	canvas: HTMLCanvasElement,
	dataset: Dataset,
	currentTimeMs: number,
	tailMode: TailMode,
	individualIds: string[]
) {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const { width, height } = canvas;

	ctx.fillStyle = '#0b1120';
	ctx.fillRect(0, 0, width, height);
	drawGraticule(ctx, width, height);

	const visible = visiblePointsAtTime(dataset, currentTimeMs, tailMode);
	for (const [id, points] of visible) {
		if (points.length === 0) continue;
		const color = colorForIndividual(id, individualIds);

		if (points.length > 1) {
			ctx.strokeStyle = color;
			ctx.lineWidth = Math.max(1, width / 1024);
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
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc(hx, hy, Math.max(3, width / 300), 0, Math.PI * 2);
		ctx.fill();
	}
}

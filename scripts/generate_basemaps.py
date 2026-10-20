#!/usr/bin/env python3
"""Generate a full-globe, 2:1 Plate Carree (EPSG:4326) basemap image for the SOS
canvas preview, with the prime meridian centered and country borders overlaid.

This is a one-time/offline asset-generation step (not run as part of `pnpm dev`
or `pnpm build`) because it downloads ~90MB of Natural Earth data. Run manually:

    .venv/bin/python scripts/generate_basemaps.py

Source data: Natural Earth (public domain, https://www.naturalearthdata.com/)
  - NE1_50M_SR_W: "Natural Earth I with Shaded Relief and Water" raster
  - ne_50m_admin_0_countries: country boundary polygons

Why not ArcGIS tiles? Esri's basemap services are natively Web Mercator, which
cannot represent latitudes beyond ~85.06 degrees, so requesting a true
-90..90 Plate Carree export crops or distorts the poles. Natural Earth's raster
is already a full -180..180 / -90..90 equirectangular grid, so it can be resized
directly onto our canvas with no cropping and pixel-perfect alignment with the
app's own lon/lat -> pixel projection formula.
"""
import io
import math
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import rasterio
from rasterio.warp import Resampling, reproject
from PIL import Image, ImageDraw
import geopandas as gpd

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / ".cache" / "naturalearth"
OUT_DIR = ROOT / "static" / "basemaps"

# Must match SOS_WIDTH / SOS_HEIGHT in src/lib/sosRenderer.ts
WIDTH = 2048
HEIGHT = 1024

RASTER_URL = "https://naciscdn.org/naturalearth/50m/raster/NE1_50M_SR_W.zip"
COUNTRIES_URL = "https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip"


def download_and_extract(url: str, dest_dir: Path) -> Path:
	dest_dir.mkdir(parents=True, exist_ok=True)
	marker = dest_dir / ".extracted"
	if marker.exists():
		return dest_dir
	print(f"Downloading {url} ...")
	req = urllib.request.Request(url, headers={"User-Agent": "mb2sos-basemap-generator"})
	with urllib.request.urlopen(req, timeout=120) as resp:
		data = resp.read()
	with zipfile.ZipFile(io.BytesIO(data)) as zf:
		zf.extractall(dest_dir)
	marker.touch()
	return dest_dir


def find_file(directory: Path, suffix: str) -> Path:
	matches = list(directory.rglob(f"*{suffix}"))
	if not matches:
		raise FileNotFoundError(f"No *{suffix} file found under {directory}")
	return matches[0]


def load_basemap_array() -> np.ndarray:
	"""Resamples the Natural Earth raster onto an exact WIDTHxHEIGHT grid
	spanning lon -180..180, lat 90..-90 (north-up), matching project() in
	src/lib/sosRenderer.ts."""
	raster_dir = download_and_extract(RASTER_URL, CACHE_DIR / "raster")
	tif_path = find_file(raster_dir, ".tif")

	dst = np.zeros((3, HEIGHT, WIDTH), dtype=np.uint8)
	dst_transform = rasterio.transform.from_bounds(-180, -90, 180, 90, WIDTH, HEIGHT)

	with rasterio.open(tif_path) as src:
		for band in range(1, 4):
			reproject(
				source=rasterio.band(src, band),
				destination=dst[band - 1],
				dst_transform=dst_transform,
				dst_crs="EPSG:4326",
				resampling=Resampling.bilinear,
			)

	return np.transpose(dst, (1, 2, 0))  # HWC for PIL


def project(lon: float, lat: float) -> tuple[float, float]:
	x = (lon + 180) / 360 * WIDTH
	y = (90 - lat) / 180 * HEIGHT
	return x, y


def draw_borders(image: Image.Image, countries_dir: Path) -> None:
	shp_path = find_file(countries_dir, ".shp")
	countries = gpd.read_file(shp_path)
	draw = ImageDraw.Draw(image)
	color = (235, 235, 235, 160)

	for geom in countries.geometry:
		if geom is None:
			continue
		polygons = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
		for poly in polygons:
			for ring in [poly.exterior, *poly.interiors]:
				coords = list(ring.coords)
				segment: list[tuple[float, float]] = []
				for i, (lon, lat) in enumerate(coords):
					if i > 0 and abs(lon - coords[i - 1][0]) > 180:
						# Antimeridian crossing: break the line instead of
						# drawing a spurious wraparound segment.
						if len(segment) > 1:
							draw.line(segment, fill=color, width=2)
						segment = []
					segment.append(project(lon, lat))
				if len(segment) > 1:
					draw.line(segment, fill=color, width=2)


def main() -> None:
	OUT_DIR.mkdir(parents=True, exist_ok=True)

	array = load_basemap_array()
	image = Image.fromarray(array, mode="RGB").convert("RGBA")

	countries_dir = download_and_extract(COUNTRIES_URL, CACHE_DIR / "countries")
	draw_borders(image, countries_dir)

	out_path = OUT_DIR / "imagery.jpg"
	image.convert("RGB").save(out_path, "JPEG", quality=87)
	print(f"Wrote {out_path} ({WIDTH}x{HEIGHT})")


if __name__ == "__main__":
	main()

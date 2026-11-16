/**
 * Real elevation data for the Acatenango–Fuego massif.
 *
 * Source: AWS Terrain Tiles (the Mapzen "terrarium" format), which are public,
 * free, and need no API key. Each pixel encodes metres above sea level in RGB:
 *
 *   elevation = (R * 256 + G + B / 256) - 32768
 *
 * Everything the 3D view draws is derived from these numbers, so the mountain
 * on screen is the actual mountain — the whole premise depends on not faking it.
 */

import { withBase } from './base-path';

/** The baked heightmap and its metadata, as served by the site (under the base path). */
export const MASSIF_JSON_URL = withBase('/terrain/massif.json');
export const MASSIF_PNG_URL = withBase('/terrain/massif.png');

export const TERRARIUM_ORIGIN = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';

/** Known summits, used to verify a fetched tile set is really this massif. */
export const SUMMITS = {
  fuego: { lat: 14.4747, lon: -90.8806, elevation: 3763, name: 'Fuego' },
  acatenango: { lat: 14.5011, lon: -90.8759, elevation: 3976, name: 'Acatenango' },
} as const;

export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/** Slippy-map tile x/y (fractional, so callers can locate a point inside a tile). */
export function lonLatToTile(lon: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n,
  };
}

export function tileToLonLat(x: number, y: number, z: number): { lon: number; lat: number } {
  const n = 2 ** z;
  return {
    lon: (x / n) * 360 - 180,
    lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI,
  };
}

export function tileUrl(z: number, x: number, y: number): string {
  return `${TERRARIUM_ORIGIN}/${z}/${x}/${y}.png`;
}

/** Metres per pixel for a 256px tile at this zoom and latitude. */
export function metresPerPixel(lat: number, z: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
}

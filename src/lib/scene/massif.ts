import * as THREE from 'three';

import { TERRAIN_FRAG, TERRAIN_VERT } from './engraving';
import { type SceneTheme, readPageTheme, watchPageTheme } from './theme';

/**
 * The Acatenango–Fuego massif, rendered from real elevation data.
 *
 * Every vertex height comes from the SRTM-derived heightmap baked by
 * scripts/fetch-terrain.ts — nothing here is a sculpted or procedural mountain.
 * The one honest liberty is vertical exaggeration (see EXAGGERATION): 2.9 km of
 * relief across 14 km reads as a gentle mound at true scale, so the terrain is
 * stretched to match how the massif feels when you are standing on it.
 *
 * Framework-agnostic on purpose — React just owns the canvas element.
 */

export interface MassifMeta {
  grid: number;
  zoom: number;
  minElevation: number;
  maxElevation: number;
  spanMetres: number;
  tileOrigin: { x: number; y: number; tiles: number; tileSize: number };
  summits: Record<string, { lat: number; lon: number; elevation: number; name: string }>;
}

export interface LabelPosition {
  key: string;
  name: string;
  elevation: number;
  x: number;
  y: number;
  /** Free canvas to the right of the dot, in CSS pixels. */
  roomRight: number;
  visible: boolean;
}

export interface MassifOptions {
  /** Called each frame with where the summit labels landed on screen. */
  onLabels?: (labels: LabelPosition[]) => void;
  /** Explosions per hour — drives plume density and ember rate. */
  activity?: number;
  reducedMotion?: boolean;
  /**
   * The engraving's theme. Left out, the scene reads it from the page and
   * follows it live as `data-theme` or the system setting changes.
   */
  theme?: SceneTheme;
}

/** Relief is real but subtle at true scale; stretch it to match perception. */
const EXAGGERATION = 1.55;
/** Scene units are kilometres. */
const M_TO_UNITS = 0.001;

const SUN_DIRECTION = new THREE.Vector3(0.72, 0.34, 0.6).normalize();

/**
 * Scene axes: +x is east (longitude increases with u), +z is south (the
 * heightmap's v runs north to south). A bulletin saying ash drifted west means
 * the plume travels toward -x.
 */
const COMPASS: Record<string, [number, number]> = {
  N: [0, -1], NE: [0.7071, -0.7071], E: [1, 0], SE: [0.7071, 0.7071],
  S: [0, 1], SW: [-0.7071, 0.7071], W: [-1, 0], NW: [-0.7071, -0.7071],
};

/** Fuego's summit, the datum the ash column height is measured against. */
const FUEGO_SUMMIT_M = 3763;

/* ── heightmap ─────────────────────────────────────────────────────────── */

export interface Heightfield {
  size: number;
  /** Metres above sea level, row-major, north-to-south. */
  data: Float32Array;
}

/**
 * Decodes the baked heightmap. Elevation is packed 16-bit across R and G and
 * normalised between the metadata's min and max, so it round-trips exactly.
 */
export async function loadHeightfield(
  url: string,
  meta: MassifMeta,
): Promise<Heightfield> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();

  const size = meta.grid;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable — cannot decode heightmap');
  ctx.drawImage(img, 0, 0);

  const { data: px } = ctx.getImageData(0, 0, size, size);
  const range = meta.maxElevation - meta.minElevation;
  const data = new Float32Array(size * size);
  for (let i = 0; i < data.length; i++) {
    const o = i << 2;
    data[i] = meta.minElevation + ((px[o] << 8) | px[o + 1]) * (range / 65535);
  }
  return { size, data };
}

/** Bilinear sample of the heightfield in normalised [0,1] grid space. */
export function sampleElevation(field: Heightfield, u: number, v: number): number {
  const { size, data } = field;
  const x = Math.min(size - 1, Math.max(0, u * (size - 1)));
  const y = Math.min(size - 1, Math.max(0, v * (size - 1)));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(size - 1, x0 + 1), y1 = Math.min(size - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const a = data[y0 * size + x0], b = data[y0 * size + x1];
  const c = data[y1 * size + x0], d = data[y1 * size + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/** Where a lat/lon falls in the heightmap's own Mercator grid, as [0,1]. */
export function lonLatToGrid(
  lon: number,
  lat: number,
  meta: MassifMeta,
): { u: number; v: number } {
  const n = 2 ** meta.zoom;
  const tx = ((lon + 180) / 360) * n;
  const ty = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  const { x, y, tiles } = meta.tileOrigin;
  return { u: (tx - x) / tiles, v: (ty - y) / tiles };
}

/* ── shaders ───────────────────────────────────────────────────────────── */

// The terrain's engraving lives in ./engraving.ts and its themes in ./theme.ts.

const PLUME_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aLife;
  attribute float aSeed;
  varying float vLife;
  varying float vSeed;
  void main() {
    vLife = aLife;
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (9.0 / -mv.z);   // aSize is decametres
    gl_Position = projectionMatrix * mv;
  }
`;

const PLUME_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uAsh;
  uniform vec3 uEmber;
  uniform float uOpacity;
  varying float vLife;
  varying float vSeed;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    // Soft round puff; density falls off toward the edge.
    float alpha = smoothstep(0.5, 0.04, d);
    // Fresh ash near the vent still carries heat.
    vec3 c = mix(uEmber, uAsh, smoothstep(0.0, 0.10, vLife));
    // Fade in at the vent, then thin out as the parcel cools and disperses.
    float fade = smoothstep(0.0, 0.04, vLife) * (1.0 - smoothstep(0.62, 1.0, vLife));
    alpha *= fade * (0.46 + 0.34 * vSeed) * uOpacity;
    gl_FragColor = vec4(c, alpha);
    #include <colorspace_fragment>
  }
`;

/* ── scene ─────────────────────────────────────────────────────────────── */

/** What one archived day tells the scene to draw. */
export interface SceneDay {
  /** Explosions per hour — drives plume density and ember rate. */
  explosionsPerHour: number | null;
  /** Ash column top in metres above sea level — drives how high the plume goes. */
  ashColumnMasl: number | null;
  /** Which way the plume leaned that day. */
  driftDirections: string[];
}

export interface MassifHandle {
  dispose(): void;
  setActivity(explosionsPerHour: number): void;
  /**
   * Point the scene at one archived day. The plume then rises to that day's
   * reported ash column and leans the way the bulletin said it leaned, so
   * scrubbing the record replays the volcano rather than animating a mood.
   */
  setDay(day: SceneDay): void;
  /** 0 = orbiting overview, 1 = the view from the Acatenango camp. */
  setView(view: 'orbit' | 'camp'): void;
}

/**
 * How the camera adapts to the canvas shape. Fitted by aspect ratio, not by
 * user agent: a tall canvas needs a wider lens and a longer orbit to keep both
 * summits in frame, and room below for the readout.
 */
export interface CameraFit {
  /** Vertical field of view in degrees for the view from camp. */
  campFov: number;
  /** Multiplier on the orbit radius. */
  orbitScale: number;
  /** Multiplier on how far behind the camp the camera stands. */
  campBack: number;
  /** Fraction of the canvas height the picture is lifted, to clear the readout. */
  lift: number;
}

const BASE_FOV = 42;

export function fitCamera(aspect: number, summitGapKm = 0, orbitDistanceKm = 1): CameraFit {
  const a = Math.max(0.2, aspect);
  const tallness = Math.max(0, 1.3 - a);
  return {
    // Keep a horizontal field of about 44 degrees: enough to hold the plume.
    campFov: Math.min(78, Math.max(BASE_FOV, (2 * Math.atan(Math.tan((22 * Math.PI) / 180) / a) * 180) / Math.PI)),
    // The orbit looks at the midpoint between the summits, so each stays within
    // half their separation of centre at every angle; stand back until that
    // half, with a margin for the labels, fits the horizontal field of view.
    orbitScale: Math.min(
      3,
      Math.max(
        1,
        (summitGapKm * 0.5 * 1.9) / (Math.tan(((BASE_FOV / 2) * Math.PI) / 180) * a * orbitDistanceKm),
      ),
    ),
    campBack: 1 + Math.min(0.6, tallness * 0.5),
    // The readout is a strip along the bottom on anything narrower than wide.
    lift: a < 1.2 ? Math.min(0.17, 0.06 + tallness * 0.14) : 0,
  };
}

export function createMassifScene(
  canvas: HTMLCanvasElement,
  field: Heightfield,
  meta: MassifMeta,
  options: MassifOptions = {},
): MassifHandle {
  const reduced = options.reducedMotion ?? false;
  let activity = options.activity ?? 10;
  // Metres of ash column above the summit, and the direction it leans.
  let plumeRiseM = 800;
  const windDir = new THREE.Vector2(-1, 0.35).normalize();
  const windTarget = new THREE.Vector2(-1, 0.35).normalize();

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 200);
  let fit = fitCamera(1);

  const spanKm = meta.spanMetres * M_TO_UNITS;

  /* summits, placed in the heightmap's own Mercator grid */
  const place = (lon: number, lat: number) => {
    const { u, v } = lonLatToGrid(lon, lat, meta);
    return new THREE.Vector3(
      (u - 0.5) * spanKm,
      sampleElevation(field, u, v) * M_TO_UNITS * EXAGGERATION,
      (v - 0.5) * spanKm,
    );
  };

  const summitEntries = Object.entries(meta.summits).map(([key, s]) => ({
    key, name: s.name, elevation: s.elevation, position: place(s.lon, s.lat),
  }));
  const fuego = summitEntries.find((s) => s.key === 'fuego') ?? summitEntries[0];
  const craterPos = fuego.position.clone();
  const massifCentre = new THREE.Vector3(
    0, (meta.maxElevation * 0.55) * M_TO_UNITS * EXAGGERATION, 0,
  );
  // The orbit is centred between the two summits, so both stay in frame.
  const campSummit = summitEntries.find((e) => e.key === 'acatenango') ?? summitEntries[0];
  const summitGapKm = Math.hypot(
    fuego.position.x - campSummit.position.x, fuego.position.z - campSummit.position.z,
  );
  const orbitCentre = massifCentre.clone();
  orbitCentre.x = (fuego.position.x + campSummit.position.x) / 2;
  orbitCentre.z = (fuego.position.z + campSummit.position.z) / 2;
  const orbitRadius = spanKm * 0.92;
  const orbitDistance = Math.hypot(orbitRadius, spanKm * 0.40);

  /* ── terrain ─────────────────────────────────────────────────────────── */
  // Fewer segments on small screens; this is the only real cost in the scene.
  const segments = window.innerWidth < 760 ? 224 : 384;
  const geometry = new THREE.PlaneGeometry(spanKm, spanKm, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    // Plane spans [-spanKm/2, spanKm/2]; map back into [0,1] grid space.
    const u = pos.getX(i) / spanKm + 0.5;
    const v = pos.getZ(i) / spanKm + 0.5;
    pos.setY(i, sampleElevation(field, u, v) * M_TO_UNITS * EXAGGERATION);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();

  const terrainMaterial = new THREE.ShaderMaterial({
    vertexShader: TERRAIN_VERT,
    fragmentShader: TERRAIN_FRAG,
    uniforms: {
      uSun: { value: SUN_DIRECTION.clone() },
      uBackground: { value: new THREE.Color() },
      uLine: { value: new THREE.Color() },
      uInkOnLight: { value: 1 },
      uHatchWidth: { value: 0.6 },
      uContourWidth: { value: 0.6 },
      uLineStrength: { value: 0.85 },
      uPixelRatio: { value: 1 },
      uPxAngle: { value: 0.001 },
      uMinElev: { value: meta.minElevation },
      uMaxElev: { value: meta.maxElevation },
      uExaggeration: { value: EXAGGERATION },
      uCameraPos: { value: new THREE.Vector3() },
      // The drawing thins out past the far side of the massif from the orbit.
      uFadeNear: { value: spanKm * 0.9 },
      uFadeFar: { value: spanKm * 1.75 },
      uCraterGlow: { value: 0.5 },
      uCraterPos: { value: craterPos },
      uEmber: { value: new THREE.Color(0xff6a24) },
      uSpan: { value: spanKm },
    },
  });
  const terrain = new THREE.Mesh(geometry, terrainMaterial);
  scene.add(terrain);

  /* ── ash plume ───────────────────────────────────────────────────────── */
  const PLUME_COUNT = 1400;
  const plumePos = new Float32Array(PLUME_COUNT * 3);
  const plumeSize = new Float32Array(PLUME_COUNT);
  const plumeLife = new Float32Array(PLUME_COUNT);
  const plumeSeed = new Float32Array(PLUME_COUNT);
  const plumeVel = new Float32Array(PLUME_COUNT * 3);

  const spawnPlume = (i: number, stagger: boolean) => {
    const o = i * 3;
    const r = Math.random() * 0.085;
    const a = Math.random() * Math.PI * 2;
    plumePos[o] = craterPos.x + Math.cos(a) * r;
    plumePos[o + 1] = craterPos.y + 0.01;
    plumePos[o + 2] = craterPos.z + Math.sin(a) * r;
    // Vertical speed is solved from the day's reported column height: over a
    // parcel's lifetime, with buoyancy decaying linearly, mean rise rate is
    // about 0.76 of the initial. Scene units are km, and the terrain is
    // exaggerated, so the target is scaled the same way the mountain is.
    const targetUnits = (plumeRiseM / 1000) * EXAGGERATION;
    const meanLifetime = 1 / 0.073;
    const rise = targetUnits / (meanLifetime * 0.76);
    plumeVel[o + 1] = rise * (0.86 + Math.random() * 0.28);
    // Horizontal drift follows the bulletin's reported bearing.
    const shear = 0.030 + Math.random() * 0.030;
    plumeVel[o] = windDir.x * shear;
    plumeVel[o + 2] = windDir.y * shear;
    plumeSize[i] = 12 + Math.random() * 13;   // 120–250 m at the vent
    plumeSeed[i] = Math.random();
    plumeLife[i] = stagger ? Math.random() : 0;
  };
  for (let i = 0; i < PLUME_COUNT; i++) spawnPlume(i, true);

  const plumeGeo = new THREE.BufferGeometry();
  plumeGeo.setAttribute('position', new THREE.BufferAttribute(plumePos, 3));
  plumeGeo.setAttribute('aSize', new THREE.BufferAttribute(plumeSize, 1));
  plumeGeo.setAttribute('aLife', new THREE.BufferAttribute(plumeLife, 1));
  plumeGeo.setAttribute('aSeed', new THREE.BufferAttribute(plumeSeed, 1));

  const plume = new THREE.Points(
    plumeGeo,
    new THREE.ShaderMaterial({
      vertexShader: PLUME_VERT, fragmentShader: PLUME_FRAG,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      uniforms: {
        uAsh: { value: new THREE.Color() },
        uEmber: { value: new THREE.Color() },
        uOpacity: { value: 1 },
      },
    }),
  );
  scene.add(plume);

  /* ── embers ──────────────────────────────────────────────────────────── */
  const EMBER_COUNT = 220;
  const emberPos = new Float32Array(EMBER_COUNT * 3);
  const emberVel = new Float32Array(EMBER_COUNT * 3);
  const emberLife = new Float32Array(EMBER_COUNT);
  const emberSize = new Float32Array(EMBER_COUNT);
  const emberSeed = new Float32Array(EMBER_COUNT);

  const spawnEmber = (i: number, stagger: boolean) => {
    const o = i * 3;
    emberPos[o] = craterPos.x;
    emberPos[o + 1] = craterPos.y;
    emberPos[o + 2] = craterPos.z;
    // Ballistic: thrown out of the vent, then falls back onto the flanks.
    const a = Math.random() * Math.PI * 2;
    const speed = 0.10 + Math.random() * 0.16;
    emberVel[o] = Math.cos(a) * speed * 0.5;
    emberVel[o + 1] = 0.20 + Math.random() * 0.24;
    emberVel[o + 2] = Math.sin(a) * speed * 0.5;
    emberSize[i] = 2.6 + Math.random() * 4.4;
    emberSeed[i] = Math.random();
    emberLife[i] = stagger ? Math.random() : 0;
  };
  for (let i = 0; i < EMBER_COUNT; i++) spawnEmber(i, true);

  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  emberGeo.setAttribute('aSize', new THREE.BufferAttribute(emberSize, 1));
  emberGeo.setAttribute('aLife', new THREE.BufferAttribute(emberLife, 1));
  emberGeo.setAttribute('aSeed', new THREE.BufferAttribute(emberSeed, 1));

  const embers = new THREE.Points(
    emberGeo,
    new THREE.ShaderMaterial({
      vertexShader: PLUME_VERT, fragmentShader: PLUME_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uAsh: { value: new THREE.Color(0xff9d4a) },
        uEmber: { value: new THREE.Color(0xfff0d0) },
        uOpacity: { value: 1 },
      },
    }),
  );
  scene.add(embers);

  /* ── theme ───────────────────────────────────────────────────────────── */
  // Frames still to draw after a change, for the reduced-motion idle below.
  let redraw = 3;

  function applyTheme(theme: SceneTheme) {
    // The sky is the page's own background: no gradient, no haze.
    renderer.setClearColor(theme.background, 1);
    const u = terrainMaterial.uniforms;
    u.uBackground.value.setHex(theme.background);
    u.uLine.value.setHex(theme.line);
    u.uInkOnLight.value = theme.mode === 'paper' ? 1 : 0;
    u.uHatchWidth.value = theme.hatchWidth;
    u.uContourWidth.value = theme.contourWidth;
    u.uLineStrength.value = theme.lineStrength;

    const plumeU = (plume.material as THREE.ShaderMaterial).uniforms;
    plumeU.uAsh.value.setHex(theme.ash);
    plumeU.uEmber.value.setHex(theme.ember);
    plumeU.uOpacity.value = theme.plumeOpacity;

    // Embers add light on ink. On paper adding light only washes out to
    // white, so they are laid down as solid orange instead.
    const emberMaterial = embers.material as THREE.ShaderMaterial;
    emberMaterial.blending = theme.emberAdditive ? THREE.AdditiveBlending : THREE.NormalBlending;
    emberMaterial.uniforms.uAsh.value.setHex(theme.emberAdditive ? 0xff9d4a : 0xe2531a);
    emberMaterial.uniforms.uEmber.value.setHex(theme.emberAdditive ? 0xfff0d0 : 0xff8a3d);
    redraw = 3;
  }
  applyTheme(options.theme ?? readPageTheme(canvas));
  const stopWatchingTheme = options.theme ? () => {} : watchPageTheme(applyTheme, canvas);

  /* ── camera rig ──────────────────────────────────────────────────────── */
  let view: 'orbit' | 'camp' = 'orbit';
  let orbitAngle = Math.PI * 0.28;
  const campPos = summitEntries.find((s) => s.key === 'acatenango')?.position ?? massifCentre;
  const desired = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const currentLook = massifCentre.clone();

  function updateCamera(dt: number) {
    if (view === 'orbit') {
      if (!reduced) orbitAngle += dt * 0.055;
      const radius = orbitRadius * fit.orbitScale;
      desired.set(
        orbitCentre.x + Math.cos(orbitAngle) * radius,
        massifCentre.y + spanKm * 0.40,
        orbitCentre.z + Math.sin(orbitAngle) * radius,
      );
      lookAt.copy(orbitCentre);
    } else {
      // Standing at the Acatenango camp looking south at Fuego, which is
      // exactly the view from the tents.
      // The camp sits about 3 km north of the crater. Standing at the summit
      // itself puts the column across the whole frame, so back off the ridge a
      // little and lift — which is also where the tents actually are.
      const sway = reduced ? 0 : Math.sin(performance.now() * 0.00016) * 0.07;
      desired.copy(campPos).add(new THREE.Vector3(sway - 0.16, 0.30, -0.62 * fit.campBack));
      lookAt.copy(craterPos).add(new THREE.Vector3(0, 0.62, 0));
    }
    // Critically-damped follow so view changes glide rather than snap. With
    // reduced motion there is no glide: the camera goes straight to its final
    // place, so the scene settles in a frame and then stops drawing.
    if (reduced) {
      camera.position.copy(desired);
      currentLook.copy(lookAt);
    } else {
      camera.position.lerp(desired, 1 - Math.exp(-dt * 1.9));
      currentLook.lerp(lookAt, 1 - Math.exp(-dt * 2.4));
    }
    camera.lookAt(currentLook);
  }

  /* ── loop ────────────────────────────────────────────────────────────── */
  const projected = new THREE.Vector3();
  const marchPoint = new THREE.Vector3();

  /** True if the terrain rises above the camera→target line anywhere along it. */
  function occluded(target: THREE.Vector3): boolean {
    const STEPS = 40;
    for (let i = 3; i < STEPS; i++) {
      marchPoint.lerpVectors(camera.position, target, i / STEPS);
      const u = marchPoint.x / spanKm + 0.5;
      const v = marchPoint.z / spanKm + 0.5;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      const ground = sampleElevation(field, u, v) * M_TO_UNITS * EXAGGERATION;
      if (marchPoint.y < ground - 0.012) return true;
    }
    return false;
  }
  let frame = 0;
  let last = performance.now();
  let disposed = false;

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const ratio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(ratio);
    terrainMaterial.uniforms.uPixelRatio.value = ratio;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    fit = fitCamera(w / h, summitGapKm, orbitDistance);
    redraw = 3;
    applyLens();
    // Lift the picture so the summits sit above the readout, not behind it.
    camera.setViewOffset(w, h, 0, h * fit.lift, w, h);
  }
  function applyLens() {
    const next = view === 'camp' ? fit.campFov : BASE_FOV;
    if (camera.fov !== next) camera.fov = next;
    camera.updateProjectionMatrix();
    // Ground one device pixel covers at unit distance, for the hatch scale.
    const devicePx = (canvas.clientHeight || 1) * terrainMaterial.uniforms.uPixelRatio.value;
    terrainMaterial.uniforms.uPxAngle.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / devicePx;
  }
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  function advancePlume(dt: number, speed: number, now: number, activePlume: number) {
    for (let i = 0; i < PLUME_COUNT; i++) {
      const o = i * 3;
      if (i > activePlume) { plumeLife[i] = 1; continue; }
      plumeLife[i] += dt * speed * (0.058 + plumeSeed[i] * 0.030);
      if (plumeLife[i] >= 1) { spawnPlume(i, false); continue; }
      // Buoyancy falls off as the parcel cools; wind shear keeps building.
      const t = plumeLife[i];
      const buoyancy = 1 - t * 0.48;
      // Lateral turbulence grows with age, so the column breaks up as it climbs
      // instead of rising as one coherent slab.
      const phase = plumeSeed[i] * 6.283;
      const swirl = 0.055 * t;
      const wanderX = Math.sin(now * 0.00055 + phase) * swirl;
      const wanderZ = Math.cos(now * 0.00042 + phase * 1.7) * swirl;
      plumePos[o] += (plumeVel[o] * (0.35 + t * 1.6) + wanderX) * dt * speed;
      plumePos[o + 1] += plumeVel[o + 1] * dt * speed * buoyancy;
      plumePos[o + 2] += (plumeVel[o + 2] * (0.35 + t * 1.6) + wanderZ) * dt * speed;
      plumeSize[i] += dt * speed * 3.0;         // widening to ~550 m aloft
    }
  }

  /**
   * With reduced motion nothing moves, so the column is drawn once, fully
   * grown, from the day's reading: run the plume ahead until it settles.
   */
  function settlePlume() {
    if (!reduced) return;
    for (let i = 0; i < PLUME_COUNT; i++) spawnPlume(i, true);
    const intensity = THREE.MathUtils.clamp(activity / 14, 0.25, 3.2);
    const activePlume = Math.floor(PLUME_COUNT * THREE.MathUtils.clamp(intensity / 1.1, 0.35, 1));
    for (let k = 0; k < 400; k++) advancePlume(0.05, 1, 0, activePlume);
    for (let i = 0; i < PLUME_COUNT; i++) plumeLife[i] = Math.min(plumeLife[i], 0.999);
    plumeGeo.attributes.position.needsUpdate = true;
    plumeGeo.attributes.aLife.needsUpdate = true;
    plumeGeo.attributes.aSize.needsUpdate = true;
  }

  const lastPosition = new THREE.Vector3();
  const lastLook = new THREE.Vector3();

  function step(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(step);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    updateCamera(dt);
    // With reduced motion nothing changes between a camera glide and the next
    // reading, so stop drawing once the picture has settled: the scene holds
    // still and the page stays responsive on slow or busy machines.
    const moved =
      camera.position.distanceToSquared(lastPosition) + currentLook.distanceToSquared(lastLook) > 1e-10;
    lastPosition.copy(camera.position);
    lastLook.copy(currentLook);
    if (reduced && !moved && redraw <= 0) return;
    if (redraw > 0) redraw--;
    terrainMaterial.uniforms.uCameraPos.value.copy(camera.position);

    // Activity drives how much of the plume is alive and how hot the vent looks.
    const intensity = THREE.MathUtils.clamp(activity / 14, 0.25, 3.2);
    terrainMaterial.uniforms.uCraterGlow.value =
      0.30 + 0.42 * Math.min(intensity, 2) +
      (reduced ? 0 : Math.sin(now * 0.0021) * 0.05);

    // Ease toward the scrubbed day's bearing so the column swings round.
    windDir.lerp(windTarget, 1 - Math.exp(-dt * 1.4)).normalize();

    // With reduced motion the scene holds still: the plume stands where it is.
    const speed = reduced ? 0 : 1;
    const activePlume = Math.floor(PLUME_COUNT * THREE.MathUtils.clamp(intensity / 1.1, 0.35, 1));
    advancePlume(dt, speed, now, activePlume);
    plumeGeo.attributes.position.needsUpdate = true;
    plumeGeo.attributes.aLife.needsUpdate = true;
    plumeGeo.attributes.aSize.needsUpdate = true;

    const activeEmbers = Math.floor(EMBER_COUNT * THREE.MathUtils.clamp(intensity / 2.4, 0.12, 1));
    for (let i = 0; i < EMBER_COUNT; i++) {
      const o = i * 3;
      if (i > activeEmbers) { emberLife[i] = 1; continue; }
      emberLife[i] += dt * speed * 0.34;
      if (emberLife[i] >= 1) { spawnEmber(i, false); continue; }
      emberVel[o + 1] -= dt * speed * 0.42;   // gravity
      emberPos[o] += emberVel[o] * dt * speed;
      emberPos[o + 1] += emberVel[o + 1] * dt * speed;
      emberPos[o + 2] += emberVel[o + 2] * dt * speed;
    }
    emberGeo.attributes.position.needsUpdate = true;
    emberGeo.attributes.aLife.needsUpdate = true;

    renderer.render(scene, camera);

    // Project summits to screen space for the DOM labels, and hide any that
    // the terrain itself is occluding.
    if (options.onLabels) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      options.onLabels(summitEntries.map((s) => {
        projected.copy(s.position).project(camera);
        const behind = projected.z > 1;
        const blocked = occluded(s.position);
        return {
          key: s.key, name: s.name, elevation: s.elevation,
          x: (projected.x * 0.5 + 0.5) * w,
          roomRight: w - (projected.x * 0.5 + 0.5) * w,
          // Keep the label clear of the top bar without moving the dot off the
          // peak for every other label on screen.
          y: Math.max((-projected.y * 0.5 + 0.5) * h, 64),
          visible: !behind && !blocked,
        };
      }));
    }
  }
  settlePlume();
  frame = requestAnimationFrame(step);

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      terrainMaterial.dispose();
      plumeGeo.dispose();
      emberGeo.dispose();
      (plume.material as THREE.Material).dispose();
      (embers.material as THREE.Material).dispose();
      stopWatchingTheme();
      renderer.dispose();
    },
    setActivity(explosionsPerHour: number) { activity = explosionsPerHour; redraw = 3; },
    setDay(day: SceneDay) {
      redraw = 3;
      if (day.explosionsPerHour !== null) activity = day.explosionsPerHour;
      // A column below the summit is a misparse, not a reading — ignore it
      // rather than drawing a plume that sinks into the mountain.
      if (day.ashColumnMasl !== null && day.ashColumnMasl > FUEGO_SUMMIT_M) {
        plumeRiseM = day.ashColumnMasl - FUEGO_SUMMIT_M;
      }
      const dirs = day.driftDirections.map((d) => COMPASS[d]).filter(Boolean);
      if (dirs.length > 0) {
        const x = dirs.reduce((a, d) => a + d[0], 0) / dirs.length;
        const z = dirs.reduce((a, d) => a + d[1], 0) / dirs.length;
        if (x !== 0 || z !== 0) windTarget.set(x, z).normalize();
      }
      if (reduced) { windDir.copy(windTarget); settlePlume(); }
    },
    setView(next: 'orbit' | 'camp') { view = next; applyLens(); redraw = 3; },
  };
}

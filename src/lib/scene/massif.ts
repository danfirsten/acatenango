import * as THREE from 'three';

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
  visible: boolean;
}

export interface MassifOptions {
  /** Called each frame with where the summit labels landed on screen. */
  onLabels?: (labels: LabelPosition[]) => void;
  /** Explosions per hour — drives plume density and ember rate. */
  activity?: number;
  reducedMotion?: boolean;
}

/** Relief is real but subtle at true scale; stretch it to match perception. */
const EXAGGERATION = 1.55;
/** Scene units are kilometres. */
const M_TO_UNITS = 0.001;

const SUN_DIRECTION = new THREE.Vector3(0.72, 0.34, 0.6).normalize();

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

const TERRAIN_VERT = /* glsl */ `
  varying float vElevation;
  varying vec3 vNormalW;
  varying vec3 vWorld;

  void main() {
    vElevation = position.y;
    vNormalW = normalize(normalMatrix * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * Elevation-banded rock with survey contour lines. The contours are the whole
 * point of the look: they encode real altitude at a fixed interval, so the
 * terrain reads as a chart rather than as scenery.
 */
const TERRAIN_FRAG = /* glsl */ `
  precision highp float;

  uniform vec3  uSun;
  uniform vec3  uSunColor;
  uniform vec3  uSkyColor;
  uniform vec3  uHazeColor;
  uniform float uMinElev;
  uniform float uMaxElev;
  uniform float uExaggeration;
  uniform float uContourInterval;
  uniform vec3  uCameraPos;
  uniform float uCraterGlow;
  uniform vec3  uCraterPos;
  uniform float uSpan;

  varying float vElevation;
  varying vec3  vNormalW;
  varying vec3  vWorld;

  vec3 elevationRamp(float t) {
    // Cloud forest on the lower flanks up through bare volcanic rock.
    vec3 forest = vec3(0.055, 0.094, 0.075);
    vec3 scrub  = vec3(0.094, 0.113, 0.106);
    vec3 rock   = vec3(0.145, 0.149, 0.152);
    vec3 ash    = vec3(0.203, 0.196, 0.188);
    vec3 c = mix(forest, scrub, smoothstep(0.00, 0.34, t));
    c = mix(c, rock, smoothstep(0.30, 0.68, t));
    c = mix(c, ash,  smoothstep(0.66, 1.00, t));
    return c;
  }

  void main() {
    // Recover true metres from the exaggerated scene height.
    float metres = (vElevation / uExaggeration) * 1000.0;
    float t = clamp((metres - uMinElev) / (uMaxElev - uMinElev), 0.0, 1.0);

    vec3 base = elevationRamp(t);

    vec3 n = normalize(vNormalW);
    float lambert = max(dot(n, uSun), 0.0);
    // Sky fill from above keeps shadowed faces readable rather than black.
    float sky = 0.5 + 0.5 * n.y;
    vec3 lit = base * (uSunColor * lambert * 0.92 + uSkyColor * sky * 0.30);

    // Survey contours every uContourInterval metres, width-corrected so the
    // lines stay one pixel thick at any distance.
    float band = metres / uContourInterval;
    float w = fwidth(band);
    float line = 1.0 - smoothstep(0.0, w * 1.4, abs(fract(band) - 0.5) - 0.5 + w * 1.4);
    // Fade contours out where they would alias into moire.
    line *= 1.0 - smoothstep(0.18, 0.55, w);
    lit += vec3(0.46, 0.56, 0.66) * line * 0.42;

    // Ember wash near the crater, strongest on slopes facing it.
    float craterDist = distance(vWorld, uCraterPos);
    float glow = exp(-craterDist * 9.0) * uCraterGlow;
    lit += vec3(1.0, 0.34, 0.10) * glow * 0.85;

    // Distance haze — the valley fills with it at dawn.
    float depth = distance(vWorld, uCameraPos);
    float haze = 1.0 - exp(-depth * 0.048);
    haze *= smoothstep(1.0, 0.15, (metres - uMinElev) / (uMaxElev - uMinElev));
    vec3 color = mix(lit, uHazeColor, clamp(haze, 0.0, 0.86));

    // The heightmap is a square tile; fade its border into atmosphere rather
    // than letting the camera catch a straight cut across the landscape.
    float edge = max(abs(vWorld.x), abs(vWorld.z)) / (uSpan * 0.5);
    color = mix(color, uHazeColor, smoothstep(0.62, 0.99, edge));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uGlow;
  uniform vec3 uSun;
  varying vec3 vDir;

  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = mix(uHorizon, uZenith, pow(h, 0.40));
    // Pre-dawn light bleeding up from behind the ridge.
    float sun = pow(max(dot(d, normalize(uSun)), 0.0), 3.2);
    c += uGlow * sun * 0.85;
    gl_FragColor = vec4(c, 1.0);
  }
`;

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
    alpha *= fade * (0.46 + 0.34 * vSeed);
    gl_FragColor = vec4(c, alpha);
  }
`;

/* ── scene ─────────────────────────────────────────────────────────────── */

export interface MassifHandle {
  dispose(): void;
  setActivity(explosionsPerHour: number): void;
  /** 0 = orbiting overview, 1 = the view from the Acatenango camp. */
  setView(view: 'orbit' | 'camp'): void;
}

export function createMassifScene(
  canvas: HTMLCanvasElement,
  field: Heightfield,
  meta: MassifMeta,
  options: MassifOptions = {},
): MassifHandle {
  const reduced = options.reducedMotion ?? false;
  let activity = options.activity ?? 10;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x080c11, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);

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

  /* ── sky ─────────────────────────────────────────────────────────────── */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(90, 32, 20),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
      uniforms: {
        uHorizon: { value: new THREE.Color(0x38506b) },
        uZenith: { value: new THREE.Color(0x080d16) },
        uGlow: { value: new THREE.Color(0xe89a56) },
        uSun: { value: SUN_DIRECTION.clone() },
      },
    }),
  );
  scene.add(sky);

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
      uSunColor: { value: new THREE.Color(0xffc79b) },
      uSkyColor: { value: new THREE.Color(0x5d7ea6) },
      uHazeColor: { value: new THREE.Color(0x23324a) },
      uMinElev: { value: meta.minElevation },
      uMaxElev: { value: meta.maxElevation },
      uExaggeration: { value: EXAGGERATION },
      uContourInterval: { value: 100 },
      uCameraPos: { value: new THREE.Vector3() },
      uCraterGlow: { value: 0.5 },
      uCraterPos: { value: craterPos },
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
    // Rise fast, then get carried west-southwest by the prevailing wind.
    plumeVel[o] = -0.030 - Math.random() * 0.030;
    plumeVel[o + 1] = 0.150 + Math.random() * 0.085;
    plumeVel[o + 2] = 0.016 + Math.random() * 0.024;
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
        uAsh: { value: new THREE.Color(0xa4b6c6) },
        uEmber: { value: new THREE.Color(0xff7a33) },
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
      },
    }),
  );
  scene.add(embers);

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
      const radius = spanKm * 0.92;
      desired.set(
        Math.cos(orbitAngle) * radius,
        massifCentre.y + spanKm * 0.40,
        Math.sin(orbitAngle) * radius,
      );
      lookAt.copy(massifCentre);
    } else {
      // Standing at the Acatenango camp looking south at Fuego, which is
      // exactly the view from the tents.
      // The camp sits about 3 km north of the crater. Standing at the summit
      // itself puts the column across the whole frame, so back off the ridge a
      // little and lift — which is also where the tents actually are.
      const sway = reduced ? 0 : Math.sin(performance.now() * 0.00016) * 0.07;
      desired.copy(campPos).add(new THREE.Vector3(sway - 0.16, 0.30, -0.62));
      lookAt.copy(craterPos).add(new THREE.Vector3(0, 0.62, 0));
    }
    // Critically-damped follow so view changes glide rather than snap.
    camera.position.lerp(desired, 1 - Math.exp(-dt * 1.9));
    currentLook.lerp(lookAt, 1 - Math.exp(-dt * 2.4));
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  function step(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(step);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    updateCamera(dt);
    terrainMaterial.uniforms.uCameraPos.value.copy(camera.position);

    // Activity drives how much of the plume is alive and how hot the vent looks.
    const intensity = THREE.MathUtils.clamp(activity / 14, 0.25, 3.2);
    terrainMaterial.uniforms.uCraterGlow.value =
      0.30 + 0.42 * Math.min(intensity, 2) +
      (reduced ? 0 : Math.sin(now * 0.0021) * 0.05);

    const speed = reduced ? 0.25 : 1;
    const activePlume = Math.floor(PLUME_COUNT * THREE.MathUtils.clamp(intensity / 1.1, 0.35, 1));
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
          // Keep the label clear of the top bar without moving the dot off the
          // peak for every other label on screen.
          y: Math.max((-projected.y * 0.5 + 0.5) * h, 64),
          visible: !behind && !blocked,
        };
      }));
    }
  }
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
      sky.geometry.dispose();
      (sky.material as THREE.Material).dispose();
      renderer.dispose();
    },
    setActivity(explosionsPerHour: number) { activity = explosionsPerHour; },
    setView(next: 'orbit' | 'camp') { view = next; },
  };
}

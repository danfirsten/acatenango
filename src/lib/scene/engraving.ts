/**
 * The terrain drawn as an engraving: hatching for shade, survey contours for
 * height, and bare background for distance. No fill colour at all, so the lava
 * and the plume are the only colour in the picture.
 *
 * Hatching lines live in world space, so they stay on the ground as the camera
 * orbits. Their spacing on screen is held near HATCH_PX at any distance by
 * blending two power-of-two scales: as a scale's lines close up, every other
 * one fades out, which lands exactly on the next scale up. Nothing pops, and
 * nothing has a floor, so close up (the view from camp) the lines stay fine
 * rather than coarsening to a fixed ground spacing.
 */

/** Target gap between hatching lines on screen, in CSS pixels. */
export const HATCH_PX = 7;
/** Smallest ground spacing the hatching can reach, in scene units (km): 5 cm. */
export const HATCH_MIN_KM = 0.00005;

export interface HatchScales {
  /** The finer of the two scales, in scene units. */
  fine: number;
  /** Twice the fine scale. */
  coarse: number;
  /** How far the fine scale's in-between lines have faded, 0 to 1. */
  fade: number;
}

/**
 * The two scales the shader blends, from how much ground one pixel covers.
 * Mirrors `hatchScales` in TERRAIN_FRAG; the unit tests hold the GLSL to it.
 */
export function hatchScales(worldPerPixel: number, pixelRatio = 1): HatchScales {
  const target = Math.max(HATCH_MIN_KM, HATCH_PX * pixelRatio * worldPerPixel);
  const ratio = target / HATCH_MIN_KM;
  const octave = 2 ** Math.floor(Math.log2(ratio));
  return { fine: HATCH_MIN_KM * octave, coarse: HATCH_MIN_KM * octave * 2, fade: ratio / octave - 1 };
}

export const TERRAIN_VERT = /* glsl */ `
  varying float vElevation;
  varying vec3 vNormalW;
  varying vec3 vWorld;

  void main() {
    vElevation = position.y;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const num = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

export const TERRAIN_FRAG = /* glsl */ `
  precision highp float;

  uniform vec3  uSun;
  uniform vec3  uBackground;
  uniform vec3  uLine;
  uniform float uInkOnLight;     // 1 on paper (lines are shadow), 0 on ink (lines are light)
  uniform float uHatchWidth;     // half-width in device pixels
  uniform float uContourWidth;
  uniform float uLineStrength;
  uniform float uPixelRatio;
  uniform float uPxAngle;        // ground covered by one device pixel, per unit of distance
  uniform float uMinElev;
  uniform float uMaxElev;
  uniform float uExaggeration;
  uniform vec3  uCameraPos;
  uniform float uFadeNear;
  uniform float uFadeFar;
  uniform float uCraterGlow;
  uniform vec3  uCraterPos;
  uniform vec3  uEmber;
  uniform float uSpan;

  varying float vElevation;
  varying vec3  vNormalW;
  varying vec3  vWorld;

  const float HATCH_PX = ${num(HATCH_PX)};
  const float HATCH_MIN = ${num(HATCH_MIN_KM)};

  // One hatch family along s at the scale chosen in main: lines fine apart,
  // with every other one faded by fade. perPx is how much s changes across
  // one pixel, so the line width holds on screen. One fract serves both
  // scales: the coarse lines sit at the cell edges, the in-between ones at
  // its middle. Edges are a one-pixel linear ramp, which is all the
  // antialiasing a line this thin needs.
  float hatch(float s, float perPx, float fine, float fade, float halfWidth) {
    float cellPx = 2.0 * fine / max(perPx, 1e-7);
    float t = fract(s / (2.0 * fine));
    float dCoarse = min(t, 1.0 - t) * cellPx;
    float dBetween = abs(t - 0.5) * cellPx;
    float coarse = clamp(halfWidth + 0.5 - dCoarse, 0.0, 1.0);
    float between = clamp(halfWidth + 0.5 - dBetween, 0.0, 1.0) * (1.0 - fade);
    return max(coarse, between);
  }

  // Contour lines every interval metres, a fixed width on screen, faded out
  // where they crowd closer than a few pixels rather than turning to moire.
  // perPx is how many metres one pixel spans.
  float contour(float metres, float perPx, float interval, float halfWidth) {
    float w = max(perPx / interval, 1e-6);
    float d = abs(fract(metres / interval + 0.5) - 0.5) / w;
    float c = clamp(halfWidth + 0.5 - d, 0.0, 1.0);
    return c * clamp((0.34 * uPixelRatio - w) / (0.18 * uPixelRatio), 0.0, 1.0);
  }

  const vec3 DIR_A = vec3(0.7796, 0.2999, -0.5498);
  const vec3 DIR_B = vec3(0.4202, 0.2201, 0.8804);

  void main() {
    // Distance thins the drawing to bare background, as a pen leaves the far
    // ground open. The square tile's edge fades the same way.
    float depth = distance(vWorld, uCameraPos);
    float edge = max(abs(vWorld.x), abs(vWorld.z)) / (uSpan * 0.5);
    float keep = (1.0 - smoothstep(uFadeNear, uFadeFar, depth)) * (1.0 - smoothstep(0.58, 0.96, edge));

    // Every line width below comes from these two derivatives, taken once.
    vec3 dx = dFdx(vWorld);
    vec3 dy = dFdy(vWorld);

    float metres = (vElevation / uExaggeration) * 1000.0;
    float lambert = dot(normalize(vNormalW), uSun);

    // Paper marks shadow, ink marks light. Tone 0 is bare ground, 1 is full.
    // On ink a faint floor of lines keeps faces in shadow from going blank.
    float tone, darkest;
    if (uInkOnLight > 0.5) {
      tone = smoothstep(0.78, 0.10, lambert);
      darkest = smoothstep(0.48, 0.0, lambert);
    } else {
      tone = max(0.08, smoothstep(0.45, 0.98, lambert));
      darkest = smoothstep(0.85, 1.05, lambert);
    }

    // Two crossing families, both in world space. A little height in each
    // direction keeps lines on steep flanks rather than stretching down them.
    float perA = abs(dot(dx, DIR_A)) + abs(dot(dy, DIR_A));
    float perB = abs(dot(dx, DIR_B)) + abs(dot(dy, DIR_B));

    // One scale for both families: the smallest power of two above the
    // target gap, and how far its in-between lines have faded.
    // The scale comes from distance, not from these derivatives: they are
    // constant per triangle and jump at every edge of the faceted mesh, which
    // would pick a different octave on each facet and break the lines up.
    // Distance is smooth, so one flank keeps one even set of lines.
    float target = max(HATCH_MIN, HATCH_PX * uPixelRatio * depth * uPxAngle);
    // The power of two is read straight from the float's exponent bits:
    // exact, so the spacing is identical across a level and nothing shimmers,
    // and far cheaper than log2 and exp2 on software renderers. The fade runs
    // linearly across the octave, continuous at both ends.
    float ratio = target / HATCH_MIN;
    float octave = uintBitsToFloat(floatBitsToUint(ratio) & 0x7f800000u);
    float fade = ratio / octave - 1.0;
    float fine = HATCH_MIN * octave;

    float halfWidth = uHatchWidth * uPixelRatio;
    float ink = 0.0;
    // Skipped where they add nothing, which is most of the lit ground on
    // paper; this keeps the frame time where the old shader had it.
    if (keep * tone > 0.0) {
      ink = hatch(dot(vWorld, DIR_A), perA, fine, fade, halfWidth * mix(0.55, 1.0, tone))
        * smoothstep(0.0, 0.25, tone) * 0.85;
    }
    if (keep * darkest > 0.0) {
      ink = max(ink, hatch(dot(vWorld, DIR_B), perB, fine, fade, halfWidth * 0.9) * darkest);
    }

    // Contours every 100 m, index contours every 500 m drawn heavier.
    float perM = (abs(dx.y) + abs(dy.y)) / uExaggeration * 1000.0;
    float c100 = contour(metres, perM, 100.0, uContourWidth * uPixelRatio);
    float c500 = contour(metres, perM, 500.0, uContourWidth * 1.6 * uPixelRatio);
    ink = max(ink, max(c100 * 0.7, c500)) * keep;

    vec3 color = mix(uBackground, uLine, clamp(ink * uLineStrength, 0.0, 1.0));

    // Ember wash on the crater: the one colour on the ground.
    float glow = exp(-distance(vWorld, uCraterPos) * 16.0) * uCraterGlow;
    color = mix(color, uEmber, clamp(glow, 0.0, 0.92));

    gl_FragColor = vec4(color, 1.0);
    // Uniform colours arrive in linear space; hand sRGB back to the canvas so
    // the paper and ink match the page's own --bg exactly.
    #include <colorspace_fragment>
  }
`;

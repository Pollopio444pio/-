/**
 * converter.js
 * ------------------------------------------------------------------------
 * Roblox classic clothing -> Polytoria "PT 2.0" template conversion.
 *
 * MAPPING PROVENANCE (read this before touching the coordinate tables)
 * ------------------------------------------------------------------------
 * Polytoria has not published an official pixel-mapping specification
 * between the classic Roblox clothing template and its own template.
 * Inventing coordinates would silently produce wrong output, so instead
 * the region tables below were cross-referenced against TWO independent,
 * open-source, community-built converters that are already in use by the
 * Polytoria community and agree with each other to within rounding:
 *
 *   1. ScoofyTheFox/Rblx-2-Polytoria-Converter (clothing-converter.html)
 *      https://github.com/ScoofyTheFox/Rblx-2-Polytoria-Converter (MIT)
 *   2. INEEDCHATPROGRAAAAAMS/Roblox---Polytoria-Texture-Converter (transfer.py)
 *      https://github.com/INEEDCHATPROGRAAAAAMS/Roblox---Polytoria-Texture-Converter
 *
 * Both tools independently encode the same face rectangles (torso, arms,
 * legs, caps) and the same left/right mirroring convention described
 * below. That agreement is the closest thing available to "ground truth"
 * without an official spec.
 *
 * IF POLYTORIA PUBLISHES AN OFFICIAL TEMPLATE SPEC, update only the
 * *_REGIONS constants below -- every other module consumes them
 * indirectly and needs no changes. That is the reason this file exists
 * as its own module instead of being inlined into the pipeline.
 *
 * KNOWN, DOCUMENTED LIMITATION
 * ------------------------------------------------------------------------
 * The classic Roblox shirt template and pants template share the exact
 * same 585x559 layout -- the two "limb strip" columns represent sleeves
 * on a shirt file and pant legs on a pants file, but the pixel
 * coordinates are identical either way. That means clothing TYPE cannot
 * be reliably auto-detected from pixel content alone; both reference
 * tools above solve this by asking the user to pick Shirt or Pants
 * explicitly. This app does the same, but keeps it "automatic" from the
 * user's point of view: which of the two dedicated drop zones (Shirt /
 * Pants) receives the file *is* the detection signal, so nothing needs
 * to be edited or chosen manually beyond dropping the file in the right
 * zone.
 * ------------------------------------------------------------------------
 */

import { createCanvas, get2dContext, copyRegion } from './imageProcessor.js';

/** Native Roblox classic clothing template size. */
export const ROBLOX_BASE_WIDTH = 585;
export const ROBLOX_BASE_HEIGHT = 559;

/** Native Polytoria "PT 2.0" template size. */
export const POLY_BASE_SIZE = 1024;

/** How far a source image's aspect ratio may drift from 585:559 and still
 *  be accepted as a (possibly HD) Roblox template. Roblox templates are
 *  also commonly exported at 2x/4x/8x (1170x1118, 2340x2236, 4680x4472). */
const ASPECT_TOLERANCE = 0.035;

// ---------------------------------------------------------------------
// Roblox source regions (585x559 base). Coordinates are {x, y, w, h}.
// ---------------------------------------------------------------------

const ROBLOX_TORSO = {
  front: { x: 231, y: 74, w: 128, h: 128 },
  top: { x: 231, y: 8, w: 128, h: 64 },
  bottom: { x: 231, y: 204, w: 128, h: 64 },
  right: { x: 165, y: 74, w: 64, h: 128 },
  left: { x: 361, y: 74, w: 64, h: 128 },
  back: { x: 427, y: 74, w: 128, h: 128 },
};

// The "Left Arm" column block (x: 19-280) doubles as the right-leg pixel
// source in a pants template; the "Right Arm" column block (x: 308-569)
// doubles as the left-leg source. This mirrors how Roblox itself reuses
// the same UV strip for both classic garment types.
const ROBLOX_LEFT_ARM = {
  top: { x: 217, y: 289, w: 64, h: 64 },
  front: { x: 217, y: 355, w: 64, h: 128 },
  right: { x: 151, y: 355, w: 64, h: 128 },
  back: { x: 85, y: 355, w: 64, h: 128 },
  left: { x: 19, y: 355, w: 64, h: 128 },
  bottom: { x: 217, y: 485, w: 64, h: 64 },
};

const ROBLOX_RIGHT_ARM = {
  top: { x: 308, y: 289, w: 64, h: 64 },
  front: { x: 308, y: 355, w: 64, h: 128 },
  left: { x: 374, y: 355, w: 64, h: 128 },
  back: { x: 440, y: 355, w: 64, h: 128 },
  right: { x: 506, y: 355, w: 64, h: 128 },
  bottom: { x: 308, y: 485, w: 64, h: 64 },
};

// ---------------------------------------------------------------------
// Polytoria destination regions (1024x1024 base). {x, y, w, h}.
// ---------------------------------------------------------------------

const POLY_TORSO = {
  front: { x: 439, y: 104, w: 146, h: 289 },
  right: { x: 350, y: 103, w: 89, h: 290 },
  left: { x: 585, y: 104, w: 87, h: 288 },
  top: { x: 439, y: 7, w: 146, h: 97 },
  bottom: { x: 439, y: 394, w: 146, h: 94 },
  back: { x: 439, y: 519, w: 146, h: 290 },
};

const POLY_RIGHT_ARM = {
  left: { x: 7, y: 71, w: 65, h: 290 },
  back: { x: 72, y: 71, w: 66, h: 290 },
  right: { x: 138, y: 71, w: 66, h: 290 },
  front: { x: 204, y: 71, w: 66, h: 290 },
  top: { x: 204, y: 7, w: 66, h: 64 },
  bottom: { x: 204, y: 362, w: 66, h: 63 },
};

const POLY_LEFT_ARM = {
  front: { x: 754, y: 71, w: 66, h: 290 },
  left: { x: 820, y: 71, w: 65, h: 290 },
  back: { x: 885, y: 71, w: 66, h: 290 },
  right: { x: 951, y: 71, w: 67, h: 290 },
  top: { x: 754, y: 7, w: 66, h: 64 },
  bottom: { x: 754, y: 362, w: 66, h: 63 },
};

const POLY_RIGHT_LEG = {
  top: { x: 206, y: 597, w: 64, h: 64 },
  left: { x: 14, y: 661, w: 64, h: 292 },
  back: { x: 78, y: 661, w: 64, h: 292 },
  right: { x: 142, y: 661, w: 64, h: 292 },
  front: { x: 206, y: 661, w: 64, h: 292 },
  bottom: { x: 206, y: 954, w: 64, h: 63 },
};

const POLY_LEFT_LEG = {
  top: { x: 754, y: 597, w: 64, h: 64 },
  front: { x: 754, y: 661, w: 64, h: 292 },
  left: { x: 818, y: 661, w: 63, h: 292 },
  back: { x: 881, y: 661, w: 65, h: 292 },
  right: { x: 946, y: 661, w: 64, h: 292 },
  bottom: { x: 754, y: 954, w: 64, h: 63 },
};

/** Exposed for the "About the mapping" panel so users can see exactly
 *  what is (and isn't) officially confirmed. */
export const MAPPING_PROVENANCE = {
  official: false,
  summary:
    'Region mapping is community reverse-engineered, cross-referenced from two ' +
    'independent open-source converters. No official Polytoria template spec has ' +
    'been published as of this build.',
  sources: [
    'https://github.com/ScoofyTheFox/Rblx-2-Polytoria-Converter',
    'https://github.com/INEEDCHATPROGRAAAAAMS/Roblox---Polytoria-Texture-Converter',
  ],
};

/**
 * A conversion "job" pairs every source face with its destination face.
 * IMPORTANT: Roblox's Right Arm maps to Polytoria's LEFT arm slot and
 * vice versa -- the two platforms disagree on which side is "left" vs
 * "right" in template space. This is confirmed identically by both
 * reference converters and is not a bug.
 */
const SHIRT_JOBS = [
  [ROBLOX_TORSO, POLY_TORSO],
  [ROBLOX_RIGHT_ARM, POLY_LEFT_ARM],
  [ROBLOX_LEFT_ARM, POLY_RIGHT_ARM],
];

const PANTS_JOBS = [
  [ROBLOX_LEFT_ARM, POLY_RIGHT_LEG],
  [ROBLOX_RIGHT_ARM, POLY_LEFT_LEG],
];

/**
 * Validates that an uploaded image's dimensions plausibly represent a
 * (possibly HD) Roblox classic clothing template, and derives the scale
 * factor needed to keep output at maximum resolution.
 * @param {number} width
 * @param {number} height
 * @returns {{valid:boolean, reason?:string, scaleX?:number, scaleY?:number, outputScale?:number, outputSize?:number}}
 */
export function detectTemplateScale(width, height) {
  if (!width || !height) {
    return { valid: false, reason: 'The image has no readable dimensions.' };
  }

  const expectedRatio = ROBLOX_BASE_WIDTH / ROBLOX_BASE_HEIGHT;
  const actualRatio = width / height;
  const drift = Math.abs(actualRatio - expectedRatio) / expectedRatio;

  if (drift > ASPECT_TOLERANCE) {
    return {
      valid: false,
      reason:
        `This doesn't look like a Roblox classic clothing template. Expected an aspect ratio ` +
        `close to ${ROBLOX_BASE_WIDTH}:${ROBLOX_BASE_HEIGHT} (~${expectedRatio.toFixed(3)}), ` +
        `but this image is ${width}x${height} (~${actualRatio.toFixed(3)}).`,
    };
  }

  const scaleX = width / ROBLOX_BASE_WIDTH;
  const scaleY = height / ROBLOX_BASE_HEIGHT;
  const outputScale = (scaleX + scaleY) / 2;

  return {
    valid: true,
    scaleX,
    scaleY,
    outputScale,
    outputSize: Math.round(POLY_BASE_SIZE * outputScale),
  };
}

/**
 * Runs the region-transfer jobs for either garment type, drawing every
 * mapped face from the (already-normalized) source canvas onto a fresh
 * Polytoria-shaped destination canvas.
 * @param {'shirt'|'pants'} kind
 * @param {HTMLCanvasElement|OffscreenCanvas} sourceCanvas - pre-scaled to scaleX/scaleY of the base Roblox size
 * @param {{scaleX:number, scaleY:number, outputScale:number, outputSize:number, smoothing?:boolean, onStep?:(done:number,total:number)=>void}} params
 */
export function convertTemplate(kind, sourceCanvas, params) {
  const jobs = kind === 'shirt' ? SHIRT_JOBS : PANTS_JOBS;
  const { scaleX, scaleY, outputScale, outputSize, smoothing = true, onStep } = params;

  const destCanvas = createCanvas(outputSize, outputSize);
  const destCtx = get2dContext(destCanvas, { smoothing });
  destCtx.clearRect(0, 0, outputSize, outputSize);

  const totalFaces = jobs.reduce((sum, [srcMap]) => sum + Object.keys(srcMap).length, 0);
  let done = 0;

  for (const [srcMap, dstMap] of jobs) {
    for (const face of Object.keys(srcMap)) {
      copyRegion(sourceCanvas, destCtx, srcMap[face], dstMap[face], scaleX, scaleY, outputScale);
      done += 1;
      if (onStep) onStep(done, totalFaces);
    }
  }

  return destCanvas;
}

/**
 * End-to-end conversion: takes a decoded source (an ImageBitmap, read
 * directly -- no intermediate full-canvas copy needed, since canvas 2D
 * drawImage can crop straight out of an ImageBitmap) plus its natural
 * dimensions, validates it, and produces the finished Polytoria template
 * canvas at maximum preserved resolution.
 * @param {'shirt'|'pants'} kind
 * @param {ImageBitmap|HTMLCanvasElement|OffscreenCanvas} source
 * @param {number} width
 * @param {number} height
 * @param {{smoothing?:boolean, onStep?:(done:number,total:number)=>void}} [options]
 */
export function convertFromSource(kind, source, width, height, options = {}) {
  const scale = detectTemplateScale(width, height);
  if (!scale.valid) {
    throw new Error(scale.reason);
  }

  const outputCanvas = convertTemplate(kind, source, {
    scaleX: scale.scaleX,
    scaleY: scale.scaleY,
    outputScale: scale.outputScale,
    outputSize: scale.outputSize,
    smoothing: options.smoothing,
    onStep: options.onStep,
  });

  return { canvas: outputCanvas, outputSize: scale.outputSize, scale };
}

/**
 * outfitMerger.js
 * ------------------------------------------------------------------------
 * Optional feature: when a batch produces both shirt and pants results,
 * automatically pair up the ones that most likely belong to the same
 * outfit (by color similarity) and merge each pair into a single combined
 * Polytoria template.
 *
 * Merging is possible without any blending logic because the shirt panels
 * (torso + both arms) and the pants panels (both legs) occupy disjoint
 * regions of the same 1024-based Polytoria layout -- verified directly
 * against Polytoria's own Expert Template (see converter.js). Drawing one
 * on top of the other just stacks two non-overlapping images.
 *
 * That same disjointness rules out a *position*-based color comparison
 * (e.g. "average color of grid cell (2,3)") for the matching step: a
 * shirt's artwork and a pants' artwork never occupy the same canvas
 * coordinates, so there would never be a comparable cell between the two.
 * Instead each image is summarized as a color-histogram "palette" --
 * how much of each coarse color bucket its non-transparent pixels use --
 * which is entirely position-independent and so works across two images
 * whose content lives in completely different parts of the canvas.
 *
 * The matching itself is a heuristic, not a guarantee: it picks the
 * pairing that minimizes palette distance, using a greedy nearest-
 * neighbor assignment (not a globally optimal matching). For most real
 * wardrobes -- a shirt and pants designed as one outfit usually share a
 * palette -- this lands on the right pairing, but it can be wrong when
 * multiple garments share very similar colors. That is why this whole
 * feature is opt-in rather than automatic.
 * ------------------------------------------------------------------------
 */

import { createCanvas, get2dContext, canvasToBlob } from './imageProcessor.js';

const TRANSPARENT_ALPHA_THRESHOLD = 10;
const HISTOGRAM_BUCKETS_PER_CHANNEL = 8; // 8x8x8 = 512 bins
const HISTOGRAM_SAMPLE_MAX_DIM = 128; // downsample large results before sampling, for speed

/**
 * Computes a position-independent color-histogram "palette" signature for
 * a canvas: for every non-transparent pixel, which coarse RGB bucket it
 * falls in, normalized so the histogram sums to 1 regardless of image
 * size or how much of the canvas is transparent panel gaps.
 *
 * Large canvases are first downsampled (nearest-neighbor, so alpha stays
 * hard-edged instead of blending transparent gaps into bordering colors)
 * to keep this fast even for HD (multi-thousand-pixel) results.
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas
 * @returns {{histogram: Float64Array, hasContent: boolean}}
 */
export function computeColorSignature(canvas) {
  const { width, height } = canvas;
  const scale = Math.min(1, HISTOGRAM_SAMPLE_MAX_DIM / Math.max(width, height));
  const sampleWidth = Math.max(1, Math.round(width * scale));
  const sampleHeight = Math.max(1, Math.round(height * scale));

  let sampleCanvas = canvas;
  if (sampleWidth !== width || sampleHeight !== height) {
    sampleCanvas = createCanvas(sampleWidth, sampleHeight);
    const sampleCtx = get2dContext(sampleCanvas, { smoothing: false });
    sampleCtx.clearRect(0, 0, sampleWidth, sampleHeight);
    sampleCtx.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
  }

  const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight);

  const buckets = HISTOGRAM_BUCKETS_PER_CHANNEL;
  const histogram = new Float64Array(buckets * buckets * buckets);
  let total = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < TRANSPARENT_ALPHA_THRESHOLD) continue;
    const rBucket = Math.min(buckets - 1, (data[i] * buckets) >> 8);
    const gBucket = Math.min(buckets - 1, (data[i + 1] * buckets) >> 8);
    const bBucket = Math.min(buckets - 1, (data[i + 2] * buckets) >> 8);
    histogram[(rBucket * buckets + gBucket) * buckets + bBucket] += 1;
    total += 1;
  }

  if (total > 0) {
    for (let i = 0; i < histogram.length; i += 1) histogram[i] /= total;
  }

  return { histogram, hasContent: total > 0 };
}

/**
 * Total-variation distance between two normalized color-histogram
 * signatures: half the sum of absolute per-bin differences, so it always
 * lands in [0, 1] -- 0 means identical palettes, 1 means completely
 * disjoint palettes. Returns Infinity if either image had no
 * non-transparent content at all (so that pair is never chosen).
 * @param {{histogram: Float64Array, hasContent: boolean}} sigA
 * @param {{histogram: Float64Array, hasContent: boolean}} sigB
 */
export function signatureDistance(sigA, sigB) {
  if (!sigA.hasContent || !sigB.hasContent) return Infinity;

  let total = 0;
  for (let i = 0; i < sigA.histogram.length; i += 1) {
    total += Math.abs(sigA.histogram[i] - sigB.histogram[i]);
  }
  return total / 2;
}

/**
 * Greedily pairs shirts with pants by ascending palette distance: the
 * single closest pair across the whole matrix is taken first, then the
 * next-closest pair among what's left, and so on until one side runs out.
 * This is a heuristic (not the globally-optimal assignment), documented
 * in the module header above.
 * @param {Array<{histogram: Float64Array, hasContent: boolean}>} shirtSignatures
 * @param {Array<{histogram: Float64Array, hasContent: boolean}>} pantsSignatures
 * @returns {Array<{shirtIndex:number, pantsIndex:number, distance:number}>}
 */
export function matchShirtsAndPants(shirtSignatures, pantsSignatures) {
  const candidates = [];
  for (let si = 0; si < shirtSignatures.length; si += 1) {
    for (let pi = 0; pi < pantsSignatures.length; pi += 1) {
      const distance = signatureDistance(shirtSignatures[si], pantsSignatures[pi]);
      if (Number.isFinite(distance)) candidates.push({ shirtIndex: si, pantsIndex: pi, distance });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);

  const usedShirts = new Set();
  const usedPants = new Set();
  const matches = [];

  for (const candidate of candidates) {
    if (usedShirts.has(candidate.shirtIndex) || usedPants.has(candidate.pantsIndex)) continue;
    usedShirts.add(candidate.shirtIndex);
    usedPants.add(candidate.pantsIndex);
    matches.push(candidate);
  }

  matches.sort((a, b) => a.shirtIndex - b.shirtIndex);
  return matches;
}

/**
 * Decodes a converted-template Blob and computes its color signature in
 * one step, closing the intermediate bitmap when done.
 * @param {Blob} blob
 * @returns {Promise<{histogram: Float64Array, hasContent: boolean}>}
 */
export async function signatureFromBlob(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = createCanvas(bitmap.width, bitmap.height);
  const ctx = get2dContext(canvas, { smoothing: false });
  ctx.drawImage(bitmap, 0, 0);
  const signature = computeColorSignature(canvas);
  bitmap.close();
  return signature;
}

/**
 * Stacks a shirt template and a pants template onto one canvas. Since
 * their panels never overlap (torso/arms vs. legs), this is a plain
 * draw-both, no blending or masking required. Uses the larger of the two
 * native sizes so an HD shirt paired with a base-resolution pants (or
 * vice versa) never loses resolution.
 * @param {Blob} shirtBlob
 * @param {Blob} pantsBlob
 * @returns {Promise<{blob: Blob, size: number}>}
 */
export async function mergeOutfit(shirtBlob, pantsBlob) {
  const [shirtBitmap, pantsBitmap] = await Promise.all([
    createImageBitmap(shirtBlob),
    createImageBitmap(pantsBlob),
  ]);
  const size = Math.max(shirtBitmap.width, shirtBitmap.height, pantsBitmap.width, pantsBitmap.height);
  const canvas = createCanvas(size, size);
  const ctx = get2dContext(canvas, { smoothing: true });
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(shirtBitmap, 0, 0, size, size);
  ctx.drawImage(pantsBitmap, 0, 0, size, size);
  const blob = await canvasToBlob(canvas);
  shirtBitmap.close();
  pantsBitmap.close();
  return { blob, size };
}

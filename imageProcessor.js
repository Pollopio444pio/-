/**
 * imageProcessor.js
 * ------------------------------------------------------------------------
 * Low-level, environment-agnostic image & canvas utilities.
 *
 * Every function here works identically on the main thread (Window) and
 * inside a Web Worker (OffscreenCanvas), so the same module can be shared
 * by app.js (main-thread fallback) and worker.js (background processing).
 *
 * No DOM APIs are touched at module-evaluation time -- only inside function
 * bodies -- which is what makes that dual-context reuse possible.
 * ------------------------------------------------------------------------
 */

/** The 8-byte PNG file signature, used to validate uploads regardless of
 *  a (possibly wrong) file extension or MIME type reported by the OS. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Reads the first bytes of a File and confirms it is a genuine PNG.
 * Rejecting based on magic bytes (not just `file.type`) protects the app
 * from renamed / mislabeled files that would otherwise fail deep inside
 * the canvas pipeline with a confusing error.
 * @param {File} file
 * @returns {Promise<boolean>}
 */
export async function isPngFile(file) {
  if (!file || file.size < PNG_SIGNATURE.length) return false;
  const header = new Uint8Array(await file.slice(0, PNG_SIGNATURE.length).arrayBuffer());
  return PNG_SIGNATURE.every((byte, index) => header[index] === byte);
}

/**
 * Validates a File before it ever touches the conversion pipeline.
 * Always resolves (never throws) so callers can render a friendly message.
 * @param {File} file
 * @param {{maxBytes?: number}} [options]
 * @returns {Promise<{valid: boolean, reason?: string}>}
 */
export async function validateUpload(file, options = {}) {
  const maxBytes = options.maxBytes ?? 64 * 1024 * 1024; // 64 MB safety ceiling

  if (!file) return { valid: false, reason: 'No file was provided.' };
  if (file.size === 0) return { valid: false, reason: 'This file is empty.' };
  if (file.size > maxBytes) {
    return { valid: false, reason: `File is too large (${formatBytes(file.size)}). Maximum is ${formatBytes(maxBytes)}.` };
  }
  if (!(await isPngFile(file))) {
    return { valid: false, reason: 'Only PNG images are accepted. Please export/save your Roblox template as PNG.' };
  }
  return { valid: true };
}

/**
 * Decodes a File into an ImageBitmap without blocking the main thread.
 * ImageBitmap decoding is offloaded to the browser's image decoder even
 * when called from Window (not just inside a Worker).
 * @param {File} file
 * @returns {Promise<ImageBitmap>}
 */
export async function loadImageBitmap(file) {
  try {
    return await createImageBitmap(file);
  } catch (error) {
    throw new Error('This PNG could not be decoded. The file may be corrupted.');
  }
}

/**
 * Creates a canvas that works both in Window (HTMLCanvasElement) and
 * inside a Worker (OffscreenCanvas). This is the single point of
 * environment detection so the rest of the codebase stays agnostic.
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement|OffscreenCanvas}
 */
export function createCanvas(width, height) {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return new OffscreenCanvas(width, height);
}

/**
 * Returns a 2D context configured to preserve transparency and, when
 * requested, disables smoothing for crisp pixel-art scaling.
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas
 * @param {{smoothing?: boolean}} [options]
 */
export function get2dContext(canvas, options = {}) {
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false });
  ctx.imageSmoothingEnabled = options.smoothing !== false;
  if (ctx.imageSmoothingEnabled && 'imageSmoothingQuality' in ctx) {
    ctx.imageSmoothingQuality = 'high';
  }
  return ctx;
}

/**
 * Copies one rectangular region from a source canvas to a rectangular
 * region on a destination context, preserving the alpha channel exactly
 * (canvas 2D compositing is alpha-aware by default -- nothing extra is
 * needed to "respect transparency").
 *
 * Region tables in converter.js are defined at the *base* template
 * resolution (585x559 / 1024x1024). To keep HD uploads at their native
 * resolution instead of downsampling them first, both the source rect
 * and the destination rect are independently scaled up here -- the
 * source canvas itself is never resized, so no quality is lost scaling
 * it down and back up.
 *
 * A small destination-side overlap ("seam pad") is applied so that
 * adjacent UV faces -- which are contiguous in both the Roblox and
 * Polytoria layouts -- don't leave a hairline transparent gap once each
 * face has been independently rescaled. This mirrors the technique used
 * by community Roblox->Polytoria converters that this project's mapping
 * was cross-referenced against (see converter.js header for provenance).
 *
 * @param {HTMLCanvasElement|OffscreenCanvas} sourceCanvas
 * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} destCtx
 * @param {{x:number,y:number,w:number,h:number}} srcRect - base-resolution coordinates
 * @param {{x:number,y:number,w:number,h:number}} dstRect - base-resolution coordinates
 * @param {number} srcScaleX - sourceCanvas.width / baseSourceWidth
 * @param {number} srcScaleY - sourceCanvas.height / baseSourceHeight
 * @param {number} destScale - scale factor applied to dstRect coordinates
 * @param {number} [seamPadPx=1] - output-space overlap, in pixels, before scaling
 */
export function copyRegion(sourceCanvas, destCtx, srcRect, dstRect, srcScaleX, srcScaleY, destScale, seamPadPx = 1) {
  const sx = Math.round(srcRect.x * srcScaleX);
  const sy = Math.round(srcRect.y * srcScaleY);
  const sw = Math.min(sourceCanvas.width - sx, Math.round(srcRect.w * srcScaleX));
  const sh = Math.min(sourceCanvas.height - sy, Math.round(srcRect.h * srcScaleY));

  const pad = Math.max(0, Math.round(seamPadPx * destScale));

  const dx1 = Math.round(dstRect.x * destScale) - pad;
  const dy1 = Math.round(dstRect.y * destScale) - pad;
  const dx2 = Math.round((dstRect.x + dstRect.w) * destScale) + pad;
  const dy2 = Math.round((dstRect.y + dstRect.h) * destScale) + pad;

  const destWidth = Math.max(1, dx2 - dx1);
  const destHeight = Math.max(1, dy2 - dy1);

  if (sw <= 0 || sh <= 0) return;

  destCtx.drawImage(
    sourceCanvas,
    sx, sy, sw, sh,
    dx1, dy1, destWidth, destHeight
  );
}

/**
 * Encodes a canvas to a lossless PNG Blob. Works with both
 * HTMLCanvasElement (toBlob) and OffscreenCanvas (convertToBlob).
 * PNG's own DEFLATE stage is unavoidable (it's what makes a PNG a PNG),
 * but no lossy re-encoding, quantization or color change is applied.
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(canvas) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: 'image/png' });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed.'));
    }, 'image/png');
  });
}

/** Safely revokes an object URL, ignoring already-revoked/invalid values. */
export function revokeSafe(url) {
  if (url) {
    try { URL.revokeObjectURL(url); } catch { /* already revoked */ }
  }
}

/** Safely closes an ImageBitmap to release its (potentially large) GPU/CPU backing store. */
export function closeBitmapSafe(bitmap) {
  if (bitmap && typeof bitmap.close === 'function') {
    try { bitmap.close(); } catch { /* already closed */ }
  }
}

/** Formats a byte count as a short human-readable string (e.g. "3.4 MB"). */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

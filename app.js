/**
 * app.js
 * ------------------------------------------------------------------------
 * Application entry point. Owns all mutable state, drives the conversion
 * pipeline (delegating heavy pixel work to worker.js when available, with
 * a same-thread fallback), and wires ui.js callbacks to that state.
 *
 * Everything here runs 100% client-side: no template ever leaves the
 * browser tab, and there is no backend to reach in the first place.
 * ------------------------------------------------------------------------
 */

import { initUI } from './ui.js';
import {
  validateUpload,
  loadImageBitmap,
  canvasToBlob,
  closeBitmapSafe,
  revokeSafe,
  formatBytes,
} from './imageProcessor.js';
import { detectTemplateScale, convertFromSource, MAPPING_PROVENANCE } from './converter.js';
import { createZip } from './zipWriter.js';

const HISTORY_LIMIT = 20;
const KINDS = ['shirt', 'pants'];

/** @typedef {{blob: Blob, url: string, outputWidth: number, outputHeight: number, originalWidth: number, originalHeight: number}} ConversionResult */

const state = {
  files: { shirt: null, pants: null },
  dims: { shirt: null, pants: null }, // {width, height}
  zoneValid: { shirt: false, pants: false },
  previewURL: { shirt: null, pants: null },
  /** @type {{shirt: ConversionResult|null, pants: ConversionResult|null}} */
  results: { shirt: null, pants: null },
  settings: loadSettings(),
  history: [], // see pushHistory() for shape
  historyIndex: -1,
  converting: false,
};

// ---------------------------------------------------------------------
// Settings persistence
// ---------------------------------------------------------------------

const SETTINGS_KEY = 'rp-converter:settings';

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      smoothing: stored.smoothing ?? true,
      autoDownload: stored.autoDownload ?? false,
      outputFormat: stored.outputFormat ?? 'png',
    };
  } catch {
    return { smoothing: true, autoDownload: false, outputFormat: 'png' };
  }
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

// ---------------------------------------------------------------------
// Worker bridge (with graceful main-thread fallback)
// ---------------------------------------------------------------------

let worker = null;
let workerUsable = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
const pendingJobs = new Map();
let nextJobId = 1;

if (workerUsable) {
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const msg = event.data;
      const job = pendingJobs.get(msg.id);
      if (!job) return;

      if (msg.type === 'progress') {
        job.onProgress?.(msg.done, msg.total);
      } else if (msg.type === 'result') {
        pendingJobs.delete(msg.id);
        job.resolve({ blob: msg.blob, outputSize: msg.outputSize });
      } else if (msg.type === 'error') {
        pendingJobs.delete(msg.id);
        job.reject(new Error(msg.message));
      }
    };
    worker.onerror = () => {
      // A malformed environment (e.g. a restrictive CSP) can throw here
      // after construction succeeded; fall back rather than hard-fail.
      workerUsable = false;
    };
  } catch {
    workerUsable = false;
  }
}

/**
 * Converts one uploaded file, using the background worker when available
 * and transparently falling back to the main thread otherwise. Either
 * path reports progress the same way so the UI code doesn't need to care.
 * @param {'shirt'|'pants'} kind
 * @param {File} file
 * @param {(done:number,total:number)=>void} onProgress
 */
async function runConversion(kind, file, onProgress) {
  const bitmap = await loadImageBitmap(file);
  const { width, height } = bitmap;

  if (worker && workerUsable) {
    const id = nextJobId++;
    return new Promise((resolve, reject) => {
      pendingJobs.set(id, { resolve, reject, onProgress });
      worker.postMessage(
        { type: 'convert', id, kind, bitmap, width, height, smoothing: state.settings.smoothing },
        [bitmap]
      );
    });
  }

  try {
    const { canvas, outputSize } = convertFromSource(kind, bitmap, width, height, {
      smoothing: state.settings.smoothing,
      onStep: onProgress,
    });
    const blob = await canvasToBlob(canvas);
    return { blob, outputSize };
  } finally {
    closeBitmapSafe(bitmap);
  }
}

// ---------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------

const ui = initUI({
  onFileSelected: handleFileSelected,
  onConvert: handleConvert,
  onReset: handleReset,
  onDownloadAll: handleDownloadAll,
  onDownloadZip: handleDownloadZip,
  onDownloadSingle: handleDownloadSingle,
  onUndo: handleUndo,
  onRedo: handleRedo,
  onHistorySelect: (index) => restoreHistoryEntry(index),
  onSettingsChange: (partial) => {
    Object.assign(state.settings, partial);
    persistSettings();
  },
});

applySettingsToControls();
ui.setMappingInfo(MAPPING_PROVENANCE.summary, MAPPING_PROVENANCE.sources);
refreshButtons();

function applySettingsToControls() {
  // The radio/checkbox/select elements already default correctly from
  // markup; only sync them if the stored settings differ (e.g. after a
  // previous visit toggled "sharp" scaling).
  const smoothRadio = document.querySelector('input[name="smoothing"][value="smooth"]');
  const sharpRadio = document.querySelector('input[name="smoothing"][value="sharp"]');
  if (smoothRadio && sharpRadio) {
    smoothRadio.checked = state.settings.smoothing;
    sharpRadio.checked = !state.settings.smoothing;
  }
  const autoDownload = document.getElementById('auto-download');
  if (autoDownload) autoDownload.checked = state.settings.autoDownload;
}

// ---------------------------------------------------------------------
// File selection & validation
// ---------------------------------------------------------------------

async function handleFileSelected(kind, file) {
  if (state.converting) {
    ui.showToast('Please wait for the current conversion to finish.', 'info');
    return;
  }

  const validation = await validateUpload(file);
  if (!validation.valid) {
    ui.setZoneError(kind, validation.reason);
    ui.showToast(validation.reason, 'error');
    return;
  }

  let bitmap;
  try {
    bitmap = await loadImageBitmap(file);
  } catch (error) {
    ui.setZoneError(kind, error.message);
    ui.showToast(error.message, 'error');
    return;
  }

  const { width, height } = bitmap;
  closeBitmapSafe(bitmap);

  const scale = detectTemplateScale(width, height);
  if (!scale.valid) {
    ui.setZoneError(kind, scale.reason);
    ui.showToast(scale.reason, 'error');
    state.zoneValid[kind] = false;
    ui.setZoneLoaded(kind, false);
    refreshButtons();
    return;
  }

  revokeSafe(state.previewURL[kind]);

  state.files[kind] = file;
  state.dims[kind] = { width, height };
  state.zoneValid[kind] = true;
  state.previewURL[kind] = URL.createObjectURL(file);
  state.results[kind] = null;

  ui.setZoneError(kind, null);
  ui.setZoneMeta(kind, `${width}×${height} · ${formatBytes(file.size)} · scale ${scale.outputScale.toFixed(2)}×`);
  ui.setZoneLoaded(kind, true);
  ui.hideResult(kind);
  ui.setStatus(`${capitalize(kind)} template loaded. Ready to convert.`);
  refreshButtons();
}

// ---------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------

async function handleConvert() {
  const kindsToConvert = KINDS.filter((k) => state.files[k] && state.zoneValid[k]);
  if (kindsToConvert.length === 0 || state.converting) return;

  state.converting = true;
  refreshButtons();
  ui.setProgress(0, 'Starting…');
  ui.setStatus('⚙ Converting…', 'info');

  const succeeded = [];
  const totalKinds = kindsToConvert.length;

  for (let i = 0; i < kindsToConvert.length; i += 1) {
    const kind = kindsToConvert[i];
    const baseProgress = (i / totalKinds) * 100;
    const slice = 100 / totalKinds;

    try {
      const { blob, outputSize } = await runConversion(kind, state.files[kind], (done, total) => {
        const pct = baseProgress + (done / total) * slice;
        ui.setProgress(pct, `Converting ${kind}… (${done}/${total} regions)`);
      });

      revokeSafe(state.results[kind]?.url);
      const url = URL.createObjectURL(blob);
      const { width: originalWidth, height: originalHeight } = state.dims[kind];

      state.results[kind] = {
        blob,
        url,
        outputWidth: outputSize,
        outputHeight: outputSize,
        originalWidth,
        originalHeight,
      };

      ui.renderResult(kind, {
        beforeURL: state.previewURL[kind],
        afterURL: url,
        outputWidth: outputSize,
        outputHeight: outputSize,
        originalWidth,
        originalHeight,
      });

      succeeded.push(kind);
    } catch (error) {
      ui.setZoneError(kind, error.message);
      ui.showToast(`${capitalize(kind)}: ${error.message}`, 'error');
    }
  }

  state.converting = false;
  ui.setProgress(null);

  if (succeeded.length > 0) {
    pushHistory(succeeded);
    ui.setStatus('✓ Conversion completed successfully.', 'success');
    ui.showToast('Conversion completed successfully.', 'success');
    ui.showSuccessAnimation();
    if (state.settings.autoDownload) {
      handleDownloadAll();
    }
  } else {
    ui.setStatus('Conversion failed. Check the messages above and try again.', 'error');
  }

  refreshButtons();
}

// ---------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------

function handleReset() {
  for (const kind of KINDS) {
    revokeSafe(state.previewURL[kind]);
    revokeSafe(state.results[kind]?.url);
    state.files[kind] = null;
    state.dims[kind] = null;
    state.zoneValid[kind] = false;
    state.previewURL[kind] = null;
    state.results[kind] = null;

    ui.setZoneMeta(kind, '');
    ui.setZoneError(kind, null);
    ui.setZoneLoaded(kind, false);
    ui.hideResult(kind);
  }

  ui.setProgress(null);
  ui.setStatus('Upload a shirt and/or pants template to begin.');
  refreshButtons();
}

// ---------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------

/** Decides output filenames per the spec: a single result gets the plain
 *  name, multiple simultaneous results get the numbered variant. */
function computeFilenames() {
  const present = KINDS.filter((k) => state.results[k]);
  if (present.length <= 1) {
    return Object.fromEntries(present.map((k) => [k, 'Polytoria_Template.png']));
  }
  const order = { shirt: 1, pants: 2 };
  return Object.fromEntries(present.map((k) => [k, `Polytoria_Template_${order[k]}.png`]));
}

function triggerBlobDownload(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (error) {
    ui.showToast(`Download failed: ${error.message}. Your converted image is safe — try again.`, 'error');
  }
}

function handleDownloadSingle(kind) {
  const result = state.results[kind];
  if (!result) return;
  const filenames = computeFilenames();
  triggerBlobDownload(result.blob, filenames[kind]);
}

function handleDownloadAll() {
  const present = KINDS.filter((k) => state.results[k]);
  if (present.length === 0) {
    ui.showToast('Nothing to download yet — convert a template first.', 'info');
    return;
  }
  const filenames = computeFilenames();
  present.forEach((kind, index) => {
    setTimeout(() => triggerBlobDownload(state.results[kind].blob, filenames[kind]), index * 250);
  });
}

async function handleDownloadZip() {
  const present = KINDS.filter((k) => state.results[k]);
  if (present.length === 0) {
    ui.showToast('Nothing to download yet — convert a template first.', 'info');
    return;
  }

  try {
    const filenames = computeFilenames();
    const entries = await Promise.all(
      present.map(async (kind) => ({
        name: filenames[kind],
        data: new Uint8Array(await state.results[kind].blob.arrayBuffer()),
      }))
    );
    const zipBlob = createZip(entries);
    triggerBlobDownload(zipBlob, 'Polytoria_Templates.zip');
  } catch (error) {
    ui.showToast(`Could not build the ZIP file: ${error.message}. Your converted images are safe — try again.`, 'error');
  }
}

// ---------------------------------------------------------------------
// History (undo/redo)
// ---------------------------------------------------------------------

function pushHistory(kinds) {
  // A fresh conversion after an undo discards the redo branch, releasing
  // its object URLs so they don't leak.
  if (state.historyIndex < state.history.length - 1) {
    const discarded = state.history.splice(state.historyIndex + 1);
    for (const entry of discarded) revokeEntryUrls(entry);
  }

  // Every entry gets its OWN object URLs (for both the "before" file and
  // the "after" blob), created fresh from the same underlying File/Blob
  // rather than reusing the live state's URLs. Object URLs are cheap,
  // independently-revocable pointers to the same bytes, so this lets the
  // live working set and every history entry revoke their own URL without
  // ever invalidating another owner's copy (e.g. Reset must never break a
  // thumbnail still shown in the History panel).
  const entry = {
    timestamp: Date.now(),
    kinds,
    originals: {
      shirt: state.results.shirt && state.files.shirt ? URL.createObjectURL(state.files.shirt) : null,
      pants: state.results.pants && state.files.pants ? URL.createObjectURL(state.files.pants) : null,
    },
    results: {
      shirt: state.results.shirt ? { ...state.results.shirt, url: URL.createObjectURL(state.results.shirt.blob) } : null,
      pants: state.results.pants ? { ...state.results.pants, url: URL.createObjectURL(state.results.pants.blob) } : null,
    },
  };

  state.history.push(entry);

  if (state.history.length > HISTORY_LIMIT) {
    const evicted = state.history.shift();
    revokeEntryUrls(evicted);
  }

  state.historyIndex = state.history.length - 1;
  ui.renderHistory(state.history, state.historyIndex);
  ui.setUndoRedoEnabled(state.historyIndex > 0, false);
}

function revokeEntryUrls(entry) {
  for (const kind of KINDS) {
    if (entry.results[kind]) revokeSafe(entry.results[kind].url);
    if (entry.originals[kind]) revokeSafe(entry.originals[kind]);
  }
}

function restoreHistoryEntry(index) {
  const entry = state.history[index];
  if (!entry) return;

  state.historyIndex = index;

  for (const kind of KINDS) {
    // Whatever the live slot currently points to is about to be replaced
    // or cleared — revoke it first (it's always an independent clone, see
    // pushHistory/handleConvert, so this never touches a URL another
    // history entry still owns).
    revokeSafe(state.results[kind]?.url);

    const result = entry.results[kind];
    if (result) {
      // Clone yet another independent URL for the live copy so a later
      // Reset can revoke it without touching this history entry's own URL.
      const liveResult = { ...result, url: URL.createObjectURL(result.blob) };
      state.results[kind] = liveResult;
      ui.renderResult(kind, {
        beforeURL: entry.originals[kind] || liveResult.url,
        afterURL: liveResult.url,
        outputWidth: liveResult.outputWidth,
        outputHeight: liveResult.outputHeight,
        originalWidth: liveResult.originalWidth,
        originalHeight: liveResult.originalHeight,
      });
    } else {
      state.results[kind] = null;
      ui.hideResult(kind);
    }
  }

  ui.renderHistory(state.history, state.historyIndex);
  ui.setUndoRedoEnabled(state.historyIndex > 0, state.historyIndex < state.history.length - 1);
  ui.setStatus(`Restored conversion from ${new Date(entry.timestamp).toLocaleTimeString()}.`);
  refreshButtons();
}

function handleUndo() {
  if (state.historyIndex <= 0) return;
  restoreHistoryEntry(state.historyIndex - 1);
}

function handleRedo() {
  if (state.historyIndex >= state.history.length - 1) return;
  restoreHistoryEntry(state.historyIndex + 1);
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function refreshButtons() {
  const hasValidUpload = KINDS.some((k) => state.files[k] && state.zoneValid[k]);
  const hasResults = KINDS.some((k) => state.results[k]);
  const hasMultipleResults = KINDS.filter((k) => state.results[k]).length > 1;

  ui.setButtonsEnabled({
    convert: hasValidUpload && !state.converting,
    reset: (hasValidUpload || hasResults) && !state.converting,
    download: hasResults,
    downloadZip: hasMultipleResults,
  });
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

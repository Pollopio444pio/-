/**
 * app.js
 * ------------------------------------------------------------------------
 * Application entry point. Owns all mutable state, drives the conversion
 * pipeline (delegating heavy pixel work to worker.js when available, with
 * a same-thread fallback), and wires ui.js callbacks to that state.
 *
 * Batching: each garment type (shirt/pants) has its own upload queue,
 * capped at MAX_FILES_PER_KIND items. Convert processes every valid item
 * across both queues in one run and replaces the results for that kind.
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
import { signatureFromBlob, matchShirtsAndPants, mergeOutfit } from './outfitMerger.js';

const MAX_FILES_PER_KIND = 20;
const HISTORY_LIMIT = 5; // a run can hold up to 40 images, so history stays small
const KINDS = ['shirt', 'pants']; // upload/queue kinds
const RESULT_KINDS = ['shirt', 'pants', 'merged']; // result kinds (merged is derived, not uploaded)

/** @typedef {{id:string, file:File, width:number|null, height:number|null, valid:boolean, error:string|null, previewURL:string|null}} QueueItem */
/** @typedef {{id:string, title:string, blob:Blob, url:string, beforeURL:string, sourceFile:File, outputWidth:number, outputHeight:number, originalWidth:number, originalHeight:number}} ResultItem */
/** @typedef {{id:string, title:string, blob:Blob, url:string, size:number}} MergedItem */

let nextQueueId = 1;
let nextMergeId = 1;

const state = {
  /** @type {{shirt: QueueItem[], pants: QueueItem[]}} */
  queue: { shirt: [], pants: [] },
  /** @type {{shirt: ResultItem[], pants: ResultItem[]}} */
  results: { shirt: [], pants: [] },
  /** @type {MergedItem[]} */
  merged: [],
  settings: loadSettings(),
  history: [], // see pushHistory() for shape
  historyIndex: -1,
  converting: false,
};

/** Returns the live result array for any of the three result kinds. */
function getResultArray(kind) {
  if (kind === 'merged') return state.merged;
  return state.results[kind];
}

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
      autoMerge: stored.autoMerge ?? false,
    };
  } catch {
    return { smoothing: true, autoDownload: false, outputFormat: 'png', autoMerge: false };
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
      workerUsable = false;
    };
  } catch {
    workerUsable = false;
  }
}

/**
 * Converts one uploaded file, using the background worker when available
 * and transparently falling back to the main thread otherwise.
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
  onFilesSelected: handleFilesSelected,
  onRemoveQueueItem: handleRemoveQueueItem,
  onConvert: handleConvert,
  onReset: handleReset,
  onDownloadAll: handleDownloadAll,
  onDownloadZip: handleDownloadZip,
  onDownloadSingle: handleDownloadSingle,
  onRemoveResult: handleRemoveResult,
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
for (const kind of KINDS) refreshQueueUI(kind);
refreshButtons();

function applySettingsToControls() {
  const smoothRadio = document.querySelector('input[name="smoothing"][value="smooth"]');
  const sharpRadio = document.querySelector('input[name="smoothing"][value="sharp"]');
  if (smoothRadio && sharpRadio) {
    smoothRadio.checked = state.settings.smoothing;
    sharpRadio.checked = !state.settings.smoothing;
  }
  const autoDownload = document.getElementById('auto-download');
  if (autoDownload) autoDownload.checked = state.settings.autoDownload;
  const autoMerge = document.getElementById('auto-merge');
  if (autoMerge) autoMerge.checked = state.settings.autoMerge;
}

// ---------------------------------------------------------------------
// Queue management
// ---------------------------------------------------------------------

async function handleFilesSelected(kind, files) {
  if (state.converting) {
    ui.showToast('Please wait for the current conversion to finish.', 'info');
    return;
  }

  const availableSlots = MAX_FILES_PER_KIND - state.queue[kind].length;
  if (availableSlots <= 0) {
    ui.showToast(`You already have ${MAX_FILES_PER_KIND} ${kind} files queued (the max). Remove some first.`, 'error');
    return;
  }

  const toAdd = files.slice(0, availableSlots);
  if (files.length > toAdd.length) {
    ui.showToast(
      `Only added ${toAdd.length} of ${files.length} files — the ${kind} queue is capped at ${MAX_FILES_PER_KIND}.`,
      'info'
    );
  }

  if (toAdd.length > 1) {
    ui.setStatus(`Checking ${toAdd.length} files…`);
  }

  for (const file of toAdd) {
    const item = {
      id: String(nextQueueId++),
      file,
      width: null,
      height: null,
      valid: false,
      error: null,
      previewURL: null,
    };
    state.queue[kind].push(item);
    await probeQueueItem(item);
    refreshQueueUI(kind);
    refreshButtons();
  }

  const validCount = state.queue[kind].filter((i) => i.valid).length;
  ui.setStatus(`${state.queue[kind].length} ${kind} file(s) queued (${validCount} ready to convert).`);
}

/** Validates + decodes one queued file in place, filling in width/height/valid/error. */
async function probeQueueItem(item) {
  const validation = await validateUpload(item.file);
  if (!validation.valid) {
    item.error = validation.reason;
    return;
  }

  let bitmap;
  try {
    bitmap = await loadImageBitmap(item.file);
  } catch (error) {
    item.error = error.message;
    return;
  }

  const { width, height } = bitmap;
  closeBitmapSafe(bitmap);

  const scale = detectTemplateScale(width, height);
  if (!scale.valid) {
    item.error = scale.reason;
    return;
  }

  item.width = width;
  item.height = height;
  item.valid = true;
  item.previewURL = URL.createObjectURL(item.file);
}

function refreshQueueUI(kind) {
  const items = state.queue[kind].map((item) => ({
    id: item.id,
    name: item.file.name,
    meta: item.valid ? `${item.width}×${item.height} · ${formatBytes(item.file.size)}` : formatBytes(item.file.size),
    error: item.error,
  }));
  ui.renderQueue(kind, items);
  ui.setQueueCount(kind, state.queue[kind].length, MAX_FILES_PER_KIND);
  ui.setZoneLoaded(kind, state.queue[kind].length > 0);
}

function handleRemoveQueueItem(kind, id) {
  const index = state.queue[kind].findIndex((item) => item.id === id);
  if (index === -1) return;
  const [removed] = state.queue[kind].splice(index, 1);
  revokeSafe(removed.previewURL);
  refreshQueueUI(kind);
  refreshButtons();
}

// ---------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------

async function handleConvert() {
  if (state.converting) return;

  const jobs = [];
  for (const kind of KINDS) {
    for (const item of state.queue[kind]) {
      if (item.valid) jobs.push({ kind, item });
    }
  }
  if (jobs.length === 0) return;

  state.converting = true;
  refreshButtons();
  ui.setProgress(0, 'Starting…');
  ui.setStatus(`⚙ Converting ${jobs.length} file${jobs.length === 1 ? '' : 's'}…`, 'info');

  const newResults = { shirt: [], pants: [] };
  let completed = 0;
  let failedCount = 0;

  for (const { kind, item } of jobs) {
    try {
      const { blob, outputSize } = await runConversion(kind, item.file, (done, total) => {
        const overallPct = ((completed + done / total) / jobs.length) * 100;
        ui.setProgress(overallPct, `Converting ${item.file.name}… (${completed + 1}/${jobs.length})`);
      });

      newResults[kind].push({
        id: item.id,
        title: item.file.name,
        blob,
        url: URL.createObjectURL(blob),
        beforeURL: URL.createObjectURL(item.file),
        sourceFile: item.file,
        outputWidth: outputSize,
        outputHeight: outputSize,
        originalWidth: item.width,
        originalHeight: item.height,
      });
    } catch (error) {
      failedCount += 1;
      ui.showToast(`${item.file.name}: ${error.message}`, 'error');
    }
    completed += 1;
  }

  // The previous live results are always independently-owned clones (see
  // pushHistory/restoreHistoryEntry), so revoking them here can never
  // invalidate a URL a history entry still depends on.
  for (const kind of KINDS) {
    for (const result of state.results[kind]) {
      revokeSafe(result.url);
      revokeSafe(result.beforeURL);
    }
  }
  state.results = newResults;
  renderAllResults();

  if (state.settings.autoMerge) {
    await recomputeMerges();
  } else {
    clearMerges();
  }

  state.converting = false;
  ui.setProgress(null);

  const succeededCount = jobs.length - failedCount;
  if (succeededCount > 0) {
    pushHistory();
    const message =
      failedCount > 0
        ? `✓ Converted ${succeededCount}/${jobs.length} files (${failedCount} failed — see messages above).`
        : '✓ Conversion completed successfully.';
    ui.setStatus(message, failedCount > 0 ? 'info' : 'success');
    if (failedCount === 0) ui.showToast('Conversion completed successfully.', 'success');
    ui.showSuccessAnimation();
    if (state.settings.autoDownload) handleDownloadAll();
  } else {
    ui.setStatus('Conversion failed for every file. Check the messages above and try again.', 'error');
  }

  refreshButtons();
}

function renderAllResults() {
  for (const kind of KINDS) {
    const items = state.results[kind].map((r) => ({
      id: r.id,
      title: r.title,
      beforeURL: r.beforeURL,
      afterURL: r.url,
      outputWidth: r.outputWidth,
      outputHeight: r.outputHeight,
      originalWidth: r.originalWidth,
      originalHeight: r.originalHeight,
    }));
    ui.renderResults(kind, items);
  }
}

function handleRemoveResult(kind, id) {
  const array = getResultArray(kind);
  const index = array.findIndex((r) => r.id === id);
  if (index === -1) return;
  const [removed] = array.splice(index, 1);
  revokeSafe(removed.url);
  if (kind !== 'merged') revokeSafe(removed.beforeURL);
  if (kind === 'merged') renderMergedResultsUI();
  else renderAllResults();
  refreshButtons();
}

// ---------------------------------------------------------------------
// Outfit merging (optional -- see outfitMerger.js for the algorithm)
// ---------------------------------------------------------------------

function renderMergedResultsUI() {
  ui.renderMergedResults(state.merged.map((m) => ({ id: m.id, title: m.title, imageURL: m.url, size: m.size })));
}

function clearMerges() {
  for (const m of state.merged) revokeSafe(m.url);
  state.merged = [];
  renderMergedResultsUI();
}

/**
 * Pairs every current shirt result with its closest-color pants result
 * (see outfitMerger.js — a documented best-effort heuristic, not a
 * guaranteed-correct match) and merges each pair into one combined file.
 * Only called when auto-merge is on and both shirt and pants results
 * exist; a no-op with an empty merged set otherwise.
 */
async function recomputeMerges() {
  for (const m of state.merged) revokeSafe(m.url);
  state.merged = [];

  const shirts = state.results.shirt;
  const pants = state.results.pants;
  if (shirts.length === 0 || pants.length === 0) {
    renderMergedResultsUI();
    return;
  }

  ui.setStatus('Matching shirts with pants by color…', 'info');

  let shirtSignatures;
  let pantsSignatures;
  try {
    [shirtSignatures, pantsSignatures] = await Promise.all([
      Promise.all(shirts.map((r) => signatureFromBlob(r.blob))),
      Promise.all(pants.map((r) => signatureFromBlob(r.blob))),
    ]);
  } catch (error) {
    ui.showToast(`Could not analyze colors for merging: ${error.message}`, 'error');
    renderMergedResultsUI();
    return;
  }

  const matches = matchShirtsAndPants(shirtSignatures, pantsSignatures);

  for (const match of matches) {
    const shirtResult = shirts[match.shirtIndex];
    const pantsResult = pants[match.pantsIndex];
    try {
      const { blob, size } = await mergeOutfit(shirtResult.blob, pantsResult.blob);
      state.merged.push({
        id: String(nextMergeId++),
        title: `${shirtResult.title} + ${pantsResult.title}`,
        blob,
        url: URL.createObjectURL(blob),
        size,
      });
    } catch (error) {
      ui.showToast(`Could not merge "${shirtResult.title}" + "${pantsResult.title}": ${error.message}`, 'error');
    }
  }

  renderMergedResultsUI();
}

// ---------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------

function handleReset() {
  for (const kind of KINDS) {
    for (const item of state.queue[kind]) revokeSafe(item.previewURL);
    for (const result of state.results[kind]) {
      revokeSafe(result.url);
      revokeSafe(result.beforeURL);
    }
    state.queue[kind] = [];
    state.results[kind] = [];
    refreshQueueUI(kind);
  }

  renderAllResults();
  clearMerges();
  ui.setProgress(null);
  ui.setStatus('Upload shirt and/or pants templates to begin (up to 20 each).');
  refreshButtons();
}

// ---------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------

/** Decides output filenames: a single result gets the plain name, a batch
 *  gets sequentially numbered names per garment type. */
function computeFilenames() {
  const shirtCount = state.results.shirt.length;
  const pantsCount = state.results.pants.length;
  const mergedCount = state.merged.length;
  if (shirtCount + pantsCount + mergedCount === 1) {
    return {
      shirt: shirtCount === 1 ? ['Polytoria_Template.png'] : [],
      pants: pantsCount === 1 ? ['Polytoria_Template.png'] : [],
      merged: [],
    };
  }
  return {
    shirt: state.results.shirt.map((_, i) => `Polytoria_Shirt_${i + 1}.png`),
    pants: state.results.pants.map((_, i) => `Polytoria_Pants_${i + 1}.png`),
    merged: state.merged.map((_, i) => `Polytoria_Outfit_${i + 1}.png`),
  };
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

function handleDownloadSingle(kind, id) {
  const array = getResultArray(kind);
  const index = array.findIndex((r) => r.id === id);
  if (index === -1) return;
  const filenames = computeFilenames();
  triggerBlobDownload(array[index].blob, filenames[kind][index]);
}

function handleDownloadAll() {
  const total = state.results.shirt.length + state.results.pants.length + state.merged.length;
  if (total === 0) {
    ui.showToast('Nothing to download yet — convert a template first.', 'info');
    return;
  }
  if (total > 8) {
    ui.showToast(
      `Downloading ${total} files individually — your browser may prompt to allow multiple downloads. ZIP is recommended for large batches.`,
      'info'
    );
  }
  const filenames = computeFilenames();
  let delayIndex = 0;
  for (const kind of RESULT_KINDS) {
    getResultArray(kind).forEach((result, index) => {
      const filename = filenames[kind][index];
      setTimeout(() => triggerBlobDownload(result.blob, filename), delayIndex * 250);
      delayIndex += 1;
    });
  }
}

async function handleDownloadZip() {
  const total = state.results.shirt.length + state.results.pants.length + state.merged.length;
  if (total === 0) {
    ui.showToast('Nothing to download yet — convert a template first.', 'info');
    return;
  }

  try {
    const filenames = computeFilenames();
    const entries = [];
    for (const kind of RESULT_KINDS) {
      const array = getResultArray(kind);
      for (let index = 0; index < array.length; index += 1) {
        const result = array[index];
        entries.push({ name: filenames[kind][index], data: new Uint8Array(await result.blob.arrayBuffer()) });
      }
    }
    const zipBlob = createZip(entries);
    triggerBlobDownload(zipBlob, 'Polytoria_Templates.zip');
  } catch (error) {
    ui.showToast(`Could not build the ZIP file: ${error.message}. Your converted images are safe — try again.`, 'error');
  }
}

// ---------------------------------------------------------------------
// History (undo/redo)
// ---------------------------------------------------------------------

/** Clones a live result into an entry-owned copy with its own independent URLs. */
function cloneResultForHistory(result) {
  return {
    id: result.id,
    title: result.title,
    blob: result.blob,
    sourceFile: result.sourceFile,
    url: URL.createObjectURL(result.blob),
    beforeURL: URL.createObjectURL(result.sourceFile),
    outputWidth: result.outputWidth,
    outputHeight: result.outputHeight,
    originalWidth: result.originalWidth,
    originalHeight: result.originalHeight,
  };
}

/** Clones an entry's result into a fresh live-owned copy (mirrors cloneResultForHistory). */
function cloneResultFromHistory(entryResult) {
  return {
    id: entryResult.id,
    title: entryResult.title,
    blob: entryResult.blob,
    sourceFile: entryResult.sourceFile,
    url: URL.createObjectURL(entryResult.blob),
    beforeURL: URL.createObjectURL(entryResult.sourceFile),
    outputWidth: entryResult.outputWidth,
    outputHeight: entryResult.outputHeight,
    originalWidth: entryResult.originalWidth,
    originalHeight: entryResult.originalHeight,
  };
}

/** Clones a live merged item into an entry-owned copy with its own independent URL. */
function cloneMergedForHistory(merged) {
  return {
    id: merged.id,
    title: merged.title,
    blob: merged.blob,
    url: URL.createObjectURL(merged.blob),
    size: merged.size,
  };
}

/** Clones an entry's merged item into a fresh live-owned copy (mirrors cloneMergedForHistory). */
function cloneMergedFromHistory(entryMerged) {
  return {
    id: entryMerged.id,
    title: entryMerged.title,
    blob: entryMerged.blob,
    url: URL.createObjectURL(entryMerged.blob),
    size: entryMerged.size,
  };
}

function historySummaries() {
  return state.history.map((entry) => ({
    timestamp: entry.timestamp,
    shirtCount: entry.shirtCount,
    pantsCount: entry.pantsCount,
    mergedCount: entry.mergedCount,
  }));
}

function pushHistory() {
  if (state.historyIndex < state.history.length - 1) {
    const discarded = state.history.splice(state.historyIndex + 1);
    for (const entry of discarded) revokeEntryUrls(entry);
  }

  const entry = {
    timestamp: Date.now(),
    shirtCount: state.results.shirt.length,
    pantsCount: state.results.pants.length,
    mergedCount: state.merged.length,
    results: {
      shirt: state.results.shirt.map(cloneResultForHistory),
      pants: state.results.pants.map(cloneResultForHistory),
      merged: state.merged.map(cloneMergedForHistory),
    },
  };

  state.history.push(entry);

  if (state.history.length > HISTORY_LIMIT) {
    const evicted = state.history.shift();
    revokeEntryUrls(evicted);
  }

  state.historyIndex = state.history.length - 1;
  ui.renderHistory(historySummaries(), state.historyIndex);
  ui.setUndoRedoEnabled(state.historyIndex > 0, false);
}

function revokeEntryUrls(entry) {
  for (const kind of KINDS) {
    for (const result of entry.results[kind]) {
      revokeSafe(result.url);
      revokeSafe(result.beforeURL);
    }
  }
  for (const merged of entry.results.merged) revokeSafe(merged.url);
}

function restoreHistoryEntry(index) {
  const entry = state.history[index];
  if (!entry) return;

  state.historyIndex = index;

  for (const kind of KINDS) {
    for (const result of state.results[kind]) {
      revokeSafe(result.url);
      revokeSafe(result.beforeURL);
    }
  }
  for (const merged of state.merged) revokeSafe(merged.url);

  state.results = {
    shirt: entry.results.shirt.map(cloneResultFromHistory),
    pants: entry.results.pants.map(cloneResultFromHistory),
  };
  state.merged = entry.results.merged.map(cloneMergedFromHistory);

  renderAllResults();
  renderMergedResultsUI();
  ui.renderHistory(historySummaries(), state.historyIndex);
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
  const hasValidQueueItems = KINDS.some((k) => state.queue[k].some((item) => item.valid));
  const hasAnyQueueItems = KINDS.some((k) => state.queue[k].length > 0);
  const hasResults = KINDS.some((k) => state.results[k].length > 0) || state.merged.length > 0;
  const hasMultipleResults = state.results.shirt.length + state.results.pants.length + state.merged.length > 1;

  ui.setButtonsEnabled({
    convert: hasValidQueueItems && !state.converting,
    reset: (hasAnyQueueItems || hasResults) && !state.converting,
    download: hasResults,
    downloadZip: hasMultipleResults,
  });
}

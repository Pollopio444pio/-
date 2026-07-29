/**
 * ui.js
 * ------------------------------------------------------------------------
 * All DOM wiring and view rendering lives here. app.js owns application
 * state and decides *what* should happen; ui.js only knows *how* to show
 * it and *how* to report user interaction back via the `handlers` object
 * passed into initUI(). Keeping this boundary means converter.js,
 * imageProcessor.js and worker.js stay entirely UI-free and testable in
 * isolation.
 *
 * Both the upload queues and the result cards are rendered from <template>
 * elements cloned per item (see index.html), since a batch can hold up to
 * MAX_FILES_PER_KIND items per garment type -- there's no longer a single
 * fixed DOM node per kind to reach for by id.
 * ------------------------------------------------------------------------
 */

const THEME_STORAGE_KEY = 'rp-converter:theme';
const TOAST_LIFETIME_MS = 4200;

/** Reference to every DOM node the UI layer touches, resolved once. */
function collectRefs() {
  const byId = (id) => document.getElementById(id);
  return {
    themeToggle: byId('theme-toggle'),

    zones: { shirt: byId('shirt-zone'), pants: byId('pants-zone') },
    inputs: { shirt: byId('shirt-input'), pants: byId('pants-input') },
    browseButtons: { shirt: byId('shirt-browse'), pants: byId('pants-browse') },
    counts: { shirt: byId('shirt-count'), pants: byId('pants-count') },
    errors: { shirt: byId('shirt-error'), pants: byId('pants-error') },
    queues: { shirt: byId('shirt-queue'), pants: byId('pants-queue') },

    btnUpload: byId('btn-upload'),
    btnConvert: byId('btn-convert'),
    btnReset: byId('btn-reset'),
    btnDownload: byId('btn-download'),
    btnDownloadZip: byId('btn-download-zip'),
    outputFormat: byId('output-format'),

    statusMessage: byId('status-message'),
    progressTrack: byId('progress-track'),
    progressFill: byId('progress-fill'),

    results: byId('results'),
    resultGroups: {
      shirt: byId('result-group-shirt'),
      pants: byId('result-group-pants'),
      merged: byId('result-group-merged'),
    },
    resultGrids: {
      shirt: byId('shirt-results-grid'),
      pants: byId('pants-results-grid'),
      merged: byId('merged-results-grid'),
    },
    resultCounts: {
      shirt: byId('shirt-result-count'),
      pants: byId('pants-result-count'),
      merged: byId('merged-result-count'),
    },

    historyList: byId('history-list'),
    historyEmpty: byId('history-empty'),
    btnUndo: byId('btn-undo'),
    btnRedo: byId('btn-redo'),

    smoothingRadios: Array.from(document.querySelectorAll('input[name="smoothing"]')),
    autoDownload: byId('auto-download'),
    autoMerge: byId('auto-merge'),
    mappingSummary: byId('mapping-summary'),
    mappingSources: byId('mapping-sources'),
    mappingInfo: document.querySelector('.mapping-info'),

    toastContainer: byId('toast-container'),
    successOverlay: byId('success-overlay'),

    queueItemTemplate: byId('queue-item-template'),
    resultCardTemplate: byId('result-card-template'),
    mergedCardTemplate: byId('merged-card-template'),
  };
}

// ---------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';
}

function initTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const preferred = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(preferred);
}

function toggleTheme() {
  const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
}

// ---------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------

/** True if any of the three result grids (shirt/pants/merged) currently has cards. */
function anyResultsVisible(refs) {
  return Object.values(refs.resultGrids).some((grid) => grid.children.length > 0);
}

/**
 * Wires every interactive element and returns a small API app.js uses to
 * push state changes into the view.
 * @param {object} handlers
 */
export function initUI(handlers) {
  const refs = collectRefs();
  let lastInteractedZone = 'shirt';

  initTheme();
  refs.themeToggle.addEventListener('click', toggleTheme);

  // -- Drop zones (multi-file) ------------------------------------------
  for (const kind of ['shirt', 'pants']) {
    const zone = refs.zones[kind];
    const input = refs.inputs[kind];

    const openPicker = () => {
      lastInteractedZone = kind;
      input.value = ''; // allow re-selecting the same file(s)
      input.click();
    };

    refs.browseButtons[kind].addEventListener('click', (e) => {
      e.stopPropagation();
      openPicker();
    });
    zone.addEventListener('click', (e) => {
      // Clicks on queue-item remove buttons bubble up to the zone; ignore those.
      if (e.target.closest('.queue-item')) return;
      openPicker();
    });
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPicker();
      }
    });
    zone.addEventListener('focus', () => { lastInteractedZone = kind; });

    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      input.value = ''; // let the identical file(s) be re-selected later
      if (files.length) handlers.onFilesSelected(kind, files);
    });

    let dragDepth = 0;
    zone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragDepth += 1;
      zone.classList.add('dz-active');
    });
    zone.addEventListener('dragover', (e) => e.preventDefault());
    zone.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) zone.classList.remove('dz-active');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      dragDepth = 0;
      zone.classList.remove('dz-active');
      lastInteractedZone = kind;
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) handlers.onFilesSelected(kind, files);
    });

    refs.queues[kind].addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.queue-item-remove');
      if (!removeBtn) return;
      e.stopPropagation();
      const id = removeBtn.closest('.queue-item').dataset.id;
      handlers.onRemoveQueueItem(kind, id);
    });
  }

  // -- Toolbar ------------------------------------------------------------
  refs.btnUpload.addEventListener('click', () => {
    const target = refs.inputs[lastInteractedZone] ? lastInteractedZone : 'shirt';
    refs.inputs[target].value = '';
    refs.inputs[target].click();
  });
  refs.btnConvert.addEventListener('click', () => handlers.onConvert());
  refs.btnReset.addEventListener('click', () => handlers.onReset());
  refs.btnDownload.addEventListener('click', () => handlers.onDownloadAll());
  refs.btnDownloadZip.addEventListener('click', () => handlers.onDownloadZip());

  refs.outputFormat.addEventListener('change', () => {
    handlers.onSettingsChange({ outputFormat: refs.outputFormat.value });
  });
  for (const radio of refs.smoothingRadios) {
    radio.addEventListener('change', () => {
      if (radio.checked) handlers.onSettingsChange({ smoothing: radio.value === 'smooth' });
    });
  }
  refs.autoDownload.addEventListener('change', () => {
    handlers.onSettingsChange({ autoDownload: refs.autoDownload.checked });
  });
  refs.autoMerge.addEventListener('change', () => {
    handlers.onSettingsChange({ autoMerge: refs.autoMerge.checked });
  });

  refs.btnUndo.addEventListener('click', () => handlers.onUndo());
  refs.btnRedo.addEventListener('click', () => handlers.onRedo());

  // -- Result grids: delegated events for download/remove/"why?" link -----
  // (Cards are cloned dynamically, so listeners live on the stable grid
  // container instead of on each card.)
  for (const kind of ['shirt', 'pants', 'merged']) {
    refs.resultGrids[kind].addEventListener('click', (e) => {
      const link = e.target.closest('.mapping-info-link');
      if (link) {
        e.preventDefault();
        if (refs.mappingInfo) {
          refs.mappingInfo.open = true;
          refs.mappingInfo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      const card = e.target.closest('.result-card');
      if (!card) return;
      const id = card.dataset.id;
      if (e.target.closest('.btn-download-single')) {
        handlers.onDownloadSingle(kind, id);
      } else if (e.target.closest('.btn-remove-result')) {
        handlers.onRemoveResult(kind, id);
      }
    });
  }

  // -- Global keyboard shortcuts --------------------------------------------
  window.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;

    switch (e.key.toLowerCase()) {
      case 'o':
        e.preventDefault();
        refs.btnUpload.click();
        break;
      case 's':
        e.preventDefault();
        handlers.onDownloadAll();
        break;
      case 'r':
        e.preventDefault();
        handlers.onReset();
        break;
      case 'z':
        e.preventDefault();
        handlers.onUndo();
        break;
      case 'y':
        e.preventDefault();
        handlers.onRedo();
        break;
      default:
        break;
    }
  });

  // -- Public API ------------------------------------------------------
  return {
    setStatus(message, type = 'info') {
      refs.statusMessage.textContent = message;
      refs.statusMessage.dataset.type = type;
    },

    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      refs.toastContainer.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('toast-visible'));
      setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
      }, TOAST_LIFETIME_MS);
    },

    setProgress(percent, label) {
      if (percent === null || percent === undefined) {
        refs.progressTrack.hidden = true;
        return;
      }
      refs.progressTrack.hidden = false;
      const clamped = Math.max(0, Math.min(100, percent));
      refs.progressFill.style.width = `${clamped}%`;
      refs.progressFill.setAttribute('aria-valuenow', String(Math.round(clamped)));
      if (label) refs.progressFill.setAttribute('aria-valuetext', label);
    },

    setQueueCount(kind, count, max) {
      refs.counts[kind].textContent = `${count}/${max}`;
    },

    setZoneError(kind, message) {
      refs.errors[kind].textContent = message || '';
      refs.zones[kind].classList.toggle('dz-error-state', Boolean(message));
    },

    setZoneLoaded(kind, loaded) {
      refs.zones[kind].classList.toggle('dz-loaded', loaded);
    },

    /**
     * @param {'shirt'|'pants'} kind
     * @param {Array<{id:string, name:string, meta:string, error?:string}>} items
     */
    renderQueue(kind, items) {
      const list = refs.queues[kind];
      list.innerHTML = '';
      for (const item of items) {
        const node = refs.queueItemTemplate.content.firstElementChild.cloneNode(true);
        node.dataset.id = item.id;
        node.querySelector('.queue-item-name').textContent = item.name;
        node.querySelector('.queue-item-meta').textContent = item.error || item.meta;
        node.classList.toggle('queue-item-error', Boolean(item.error));
        list.appendChild(node);
      }
    },

    setButtonsEnabled({ convert, reset, download, downloadZip }) {
      refs.btnConvert.disabled = !convert;
      refs.btnReset.disabled = !reset;
      refs.btnDownload.disabled = !download;
      refs.btnDownloadZip.disabled = !downloadZip;
    },

    /**
     * Fully re-renders the result grid for one garment kind.
     * @param {'shirt'|'pants'} kind
     * @param {Array<{id:string, title:string, beforeURL:string, afterURL:string, outputWidth:number, outputHeight:number, originalWidth:number, originalHeight:number}>} items
     */
    renderResults(kind, items) {
      const grid = refs.resultGrids[kind];
      grid.innerHTML = '';
      refs.resultCounts[kind].textContent = String(items.length);
      refs.resultGroups[kind].hidden = items.length === 0;

      for (const item of items) {
        const card = refs.resultCardTemplate.content.firstElementChild.cloneNode(true);
        card.dataset.id = item.id;
        card.querySelector('.result-title').textContent = item.title;
        card.querySelector('.result-meta').textContent =
          `${item.originalWidth}×${item.originalHeight} Roblox → ${item.outputWidth}×${item.outputHeight} Polytoria`;

        const beforeImg = card.querySelector('.compare-before');
        const afterImg = card.querySelector('.compare-after');
        const beforeWrap = card.querySelector('.compare-before-wrap');
        const afterWrap = card.querySelector('.compare-after-wrap');
        const handle = card.querySelector('.compare-handle');
        const zoomInput = card.querySelector('.result-zoom');
        const zoomValue = card.querySelector('.result-zoom-value');

        beforeImg.src = item.beforeURL;
        afterImg.src = item.afterURL;
        beforeImg.alt = `Original ${item.title}`;
        afterImg.alt = `Converted ${item.title}`;

        setComparePosition(beforeWrap, afterWrap, handle, 50);
        setupCompareHandle(card.querySelector('.compare'), handle, beforeWrap, afterWrap);
        zoomInput.addEventListener('input', () => {
          const value = Number(zoomInput.value);
          zoomValue.textContent = `${value}%`;
          applyZoom(value, beforeImg, afterImg);
        });

        grid.appendChild(card);
      }
      refs.results.hidden = !anyResultsVisible(refs);
    },

    /**
     * Fully re-renders the "Merged Outfits" grid -- simpler cards than
     * renderResults: a single image (no before/after split, since a merge
     * has two sources, not one) plus zoom/download/remove.
     * @param {Array<{id:string, title:string, imageURL:string, size:number}>} items
     */
    renderMergedResults(items) {
      const grid = refs.resultGrids.merged;
      grid.innerHTML = '';
      refs.resultCounts.merged.textContent = String(items.length);
      refs.resultGroups.merged.hidden = items.length === 0;

      for (const item of items) {
        const card = refs.mergedCardTemplate.content.firstElementChild.cloneNode(true);
        card.dataset.id = item.id;
        card.querySelector('.result-title').textContent = item.title;
        card.querySelector('.result-meta').textContent = `${item.size}×${item.size} Polytoria (shirt + pants combined)`;

        const img = card.querySelector('.merged-img');
        const zoomInput = card.querySelector('.result-zoom');
        const zoomValue = card.querySelector('.result-zoom-value');

        img.src = item.imageURL;
        img.alt = item.title;

        zoomInput.addEventListener('input', () => {
          const value = Number(zoomInput.value);
          zoomValue.textContent = `${value}%`;
          applyZoom(value, img);
        });

        grid.appendChild(card);
      }
      refs.results.hidden = !anyResultsVisible(refs);
    },

    renderHistory(entries, activeIndex) {
      refs.historyList.querySelectorAll('.history-item').forEach((el) => el.remove());
      refs.historyEmpty.hidden = entries.length > 0;

      entries.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = 'history-item' + (index === activeIndex ? ' history-active' : '');
        li.setAttribute('role', 'button');
        li.tabIndex = 0;

        const label = `${entry.shirtCount} shirt${entry.shirtCount === 1 ? '' : 's'} + ${entry.pantsCount} pant${entry.pantsCount === 1 ? '' : 's'}` +
          (entry.mergedCount > 0 ? ` + ${entry.mergedCount} outfit${entry.mergedCount === 1 ? '' : 's'}` : '');
        const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        li.innerHTML = `<span class="history-kind">${label}</span><span class="history-time">${time}</span>`;

        const select = () => handlers.onHistorySelect(index);
        li.addEventListener('click', select);
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select();
          }
        });
        refs.historyList.appendChild(li);
      });
    },

    setUndoRedoEnabled(canUndo, canRedo) {
      refs.btnUndo.disabled = !canUndo;
      refs.btnRedo.disabled = !canRedo;
    },

    showSuccessAnimation() {
      refs.successOverlay.hidden = false;
      refs.successOverlay.classList.add('success-visible');
      setTimeout(() => {
        refs.successOverlay.classList.remove('success-visible');
        setTimeout(() => { refs.successOverlay.hidden = true; }, 300);
      }, 1600);
    },

    setMappingInfo(summary, sources) {
      refs.mappingSummary.textContent = summary;
      refs.mappingSources.innerHTML = '';
      for (const url of sources) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = url;
        a.textContent = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        li.appendChild(a);
        refs.mappingSources.appendChild(li);
      }
    },
  };
}

// ---------------------------------------------------------------------
// Before/after compare slider (scoped to one card's elements)
// ---------------------------------------------------------------------

/**
 * Clips the "before" wrap to [0, percent] and the "after" wrap to
 * [percent, 100] -- always complementary, never overlapping, so neither
 * image's transparent regions can ever reveal the other image underneath.
 * Only the checkerboard layer (below both) shows through transparency.
 */
function setComparePosition(beforeWrap, afterWrap, handle, percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  beforeWrap.style.clipPath = `inset(0 ${100 - clamped}% 0 0)`;
  afterWrap.style.clipPath = `inset(0 0 0 ${clamped}%)`;
  handle.style.left = `${clamped}%`;
  handle.setAttribute('aria-valuenow', String(Math.round(clamped)));
}

function setupCompareHandle(box, handle, beforeWrap, afterWrap) {
  const percentFromClientX = (clientX) => {
    const rect = box.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 100;
  };

  const onPointerMove = (e) => setComparePosition(beforeWrap, afterWrap, handle, percentFromClientX(e.clientX));

  handle.addEventListener('pointerdown', (e) => {
    handle.setPointerCapture(e.pointerId);
    onPointerMove(e);
    const onMove = (ev) => onPointerMove(ev);
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });

  box.addEventListener('click', (e) => {
    if (e.target === handle) return;
    setComparePosition(beforeWrap, afterWrap, handle, percentFromClientX(e.clientX));
  });

  handle.addEventListener('keydown', (e) => {
    const current = Number(handle.getAttribute('aria-valuenow')) || 50;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setComparePosition(beforeWrap, afterWrap, handle, current - 5);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setComparePosition(beforeWrap, afterWrap, handle, current + 5);
    }
  });
}

// ---------------------------------------------------------------------
// Zoom (scoped to one card's elements)
// ---------------------------------------------------------------------

function applyZoom(percent, ...images) {
  const scale = percent / 100;
  for (const img of images) img.style.transform = `scale(${scale})`;
}

/**
 * ui.js
 * ------------------------------------------------------------------------
 * All DOM wiring and view rendering lives here. app.js owns application
 * state and decides *what* should happen; ui.js only knows *how* to show
 * it and *how* to report user interaction back via the `handlers` object
 * passed into initUI(). Keeping this boundary means converter.js,
 * imageProcessor.js and worker.js stay entirely UI-free and testable in
 * isolation.
 * ------------------------------------------------------------------------
 */

const THEME_STORAGE_KEY = 'rp-converter:theme';
const TOAST_LIFETIME_MS = 4200;

/** Reference to every DOM node the UI layer touches, resolved once. */
function collectRefs() {
  const byId = (id) => document.getElementById(id);
  return {
    themeToggle: byId('theme-toggle'),
    themeIcon: byId('theme-icon'),

    zones: {
      shirt: byId('shirt-zone'),
      pants: byId('pants-zone'),
    },
    inputs: {
      shirt: byId('shirt-input'),
      pants: byId('pants-input'),
    },
    browseButtons: {
      shirt: byId('shirt-browse'),
      pants: byId('pants-browse'),
    },
    meta: {
      shirt: byId('shirt-meta'),
      pants: byId('pants-meta'),
    },
    errors: {
      shirt: byId('shirt-error'),
      pants: byId('pants-error'),
    },

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
    resultCards: {
      shirt: byId('result-shirt'),
      pants: byId('result-pants'),
    },
    resultMeta: {
      shirt: byId('shirt-result-meta'),
      pants: byId('pants-result-meta'),
    },
    beforeImg: {
      shirt: byId('shirt-before-img'),
      pants: byId('pants-before-img'),
    },
    afterImg: {
      shirt: byId('shirt-after-img'),
      pants: byId('pants-after-img'),
    },
    afterWrap: {
      shirt: byId('shirt-after-wrap'),
      pants: byId('pants-after-wrap'),
    },
    compareBox: {
      shirt: byId('compare-shirt'),
      pants: byId('compare-pants'),
    },
    handle: {
      shirt: byId('shirt-handle'),
      pants: byId('pants-handle'),
    },
    zoomInput: {
      shirt: byId('shirt-zoom'),
      pants: byId('pants-zoom'),
    },
    zoomValue: {
      shirt: byId('shirt-zoom-value'),
      pants: byId('pants-zoom-value'),
    },
    downloadSingle: {
      shirt: byId('shirt-download'),
      pants: byId('pants-download'),
    },

    historyList: byId('history-list'),
    historyEmpty: byId('history-empty'),
    btnUndo: byId('btn-undo'),
    btnRedo: byId('btn-redo'),

    smoothingRadios: Array.from(document.querySelectorAll('input[name="smoothing"]')),
    autoDownload: byId('auto-download'),
    mappingSummary: byId('mapping-summary'),
    mappingSources: byId('mapping-sources'),

    toastContainer: byId('toast-container'),
    successOverlay: byId('success-overlay'),
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

  // -- Drop zones -------------------------------------------------------
  for (const kind of ['shirt', 'pants']) {
    const zone = refs.zones[kind];
    const input = refs.inputs[kind];

    const openPicker = () => {
      lastInteractedZone = kind;
      input.value = ''; // allow re-selecting the same file
      input.click();
    };

    refs.browseButtons[kind].addEventListener('click', (e) => {
      e.stopPropagation();
      openPicker();
    });
    zone.addEventListener('click', openPicker);
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPicker();
      }
    });
    zone.addEventListener('focus', () => { lastInteractedZone = kind; });

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      // Clear immediately (not just before the next open) so that any
      // programmatic re-selection of the identical file still fires a
      // future 'change' event -- browsers otherwise suppress it when an
      // <input type=file>'s value would stay textually identical.
      input.value = '';
      if (file) handlers.onFileSelected(kind, file);
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
      const file = e.dataTransfer?.files?.[0];
      if (file) handlers.onFileSelected(kind, file);
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

  for (const kind of ['shirt', 'pants']) {
    refs.downloadSingle[kind].addEventListener('click', () => handlers.onDownloadSingle(kind));
  }

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

  refs.btnUndo.addEventListener('click', () => handlers.onUndo());
  refs.btnRedo.addEventListener('click', () => handlers.onRedo());

  // -- "why?" links in result hints jump to the detailed explanation ------
  document.querySelectorAll('.mapping-info-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const details = document.querySelector('.mapping-info');
      if (!details) return;
      details.open = true;
      details.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  // -- Compare sliders + zoom ----------------------------------------------
  for (const kind of ['shirt', 'pants']) {
    setupCompareHandle(refs, kind);
    setupZoom(refs, kind);
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

    setZoneMeta(kind, text) {
      refs.meta[kind].textContent = text || '';
    },

    setZoneError(kind, message) {
      refs.errors[kind].textContent = message || '';
      refs.zones[kind].classList.toggle('dz-error-state', Boolean(message));
    },

    setZoneLoaded(kind, loaded) {
      refs.zones[kind].classList.toggle('dz-loaded', loaded);
    },

    setButtonsEnabled({ convert, reset, download, downloadZip }) {
      refs.btnConvert.disabled = !convert;
      refs.btnReset.disabled = !reset;
      refs.btnDownload.disabled = !download;
      refs.btnDownloadZip.disabled = !downloadZip;
    },

    renderResult(kind, { beforeURL, afterURL, outputWidth, outputHeight, originalWidth, originalHeight }) {
      refs.results.hidden = false;
      refs.resultCards[kind].hidden = false;
      refs.beforeImg[kind].src = beforeURL;
      refs.afterImg[kind].src = afterURL;
      refs.resultMeta[kind].textContent =
        `${originalWidth}×${originalHeight} Roblox template → ${outputWidth}×${outputHeight} Polytoria template`;
      // Reset the compare slider and zoom back to a sane default per result.
      setComparePosition(refs, kind, 50);
      refs.zoomInput[kind].value = '100';
      refs.zoomValue[kind].textContent = '100%';
      applyZoom(refs, kind, 100);
    },

    hideResult(kind) {
      refs.resultCards[kind].hidden = true;
      if (refs.resultCards.shirt.hidden && refs.resultCards.pants.hidden) {
        refs.results.hidden = true;
      }
    },

    renderHistory(entries, activeIndex) {
      refs.historyList.querySelectorAll('.history-item').forEach((el) => el.remove());
      refs.historyEmpty.hidden = entries.length > 0;

      entries.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = 'history-item' + (index === activeIndex ? ' history-active' : '');
        li.setAttribute('role', 'button');
        li.tabIndex = 0;

        const kinds = entry.kinds.join(' + ');
        const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        li.innerHTML = `<span class="history-kind">${kinds}</span><span class="history-time">${time}</span>`;

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
// Before/after compare slider
// ---------------------------------------------------------------------

function setComparePosition(refs, kind, percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  refs.afterWrap[kind].style.clipPath = `inset(0 ${100 - clamped}% 0 0)`;
  refs.handle[kind].style.left = `${clamped}%`;
  refs.handle[kind].setAttribute('aria-valuenow', String(Math.round(clamped)));
}

function setupCompareHandle(refs, kind) {
  const box = refs.compareBox[kind];
  const handle = refs.handle[kind];

  const percentFromClientX = (clientX) => {
    const rect = box.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 100;
  };

  const onPointerMove = (e) => setComparePosition(refs, kind, percentFromClientX(e.clientX));

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
    setComparePosition(refs, kind, percentFromClientX(e.clientX));
  });

  handle.addEventListener('keydown', (e) => {
    const current = Number(handle.getAttribute('aria-valuenow')) || 50;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setComparePosition(refs, kind, current - 5);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setComparePosition(refs, kind, current + 5);
    }
  });
}

// ---------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------

function applyZoom(refs, kind, percent) {
  const scale = percent / 100;
  refs.beforeImg[kind].style.transform = `scale(${scale})`;
  refs.afterImg[kind].style.transform = `scale(${scale})`;
}

function setupZoom(refs, kind) {
  refs.zoomInput[kind].addEventListener('input', () => {
    const value = Number(refs.zoomInput[kind].value);
    refs.zoomValue[kind].textContent = `${value}%`;
    applyZoom(refs, kind, value);
  });
}

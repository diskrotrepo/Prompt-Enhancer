(() => {
  'use strict';

  // Table of contents:
  // - Utilities + shared readers (including color preset helpers)
  // - Chunking + mixing engine (single-pass + first chunk behavior)
  // - Box evaluation
  // - Box creation + state serialization (hydrates custom size/length controls)
  // - UI helpers + event wiring
  // - Window management + data load/save (locks initial window width)
  // - Initialization

  // ======== Utilities ========

  function escapeRegExp(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Delimiter parsing uses two custom modes:
  // - Match-all: the full string is the delimiter (legacy "custom" maps here).
  // - Match-any: any character in the custom input acts as a delimiter.
  function normalizeDelimiterMode(mode) {
    if (!mode) return 'whitespace';
    if (mode === 'empty-chunk') return 'empty-chunk';
    if (mode === 'custom') return 'custom-all';
    return mode;
  }

  function isCustomDelimiterMode(mode) {
    return mode === 'custom' || mode === 'custom-all' || mode === 'custom-any';
  }

  function escapeCharClass(value) {
    return value.replace(/[\\\-\]\[\^]/g, '\\$&');
  }

  // Build a delimiter regex that matches a single delimiter unit at a time.
  // Chunk size groups multiple delimiter units explicitly instead of collapsing runs here.
  function buildDelimiterRegex(delimiter, options = {}) {
    if (delimiter instanceof RegExp) return delimiter;
    const raw = delimiter == null ? '' : String(delimiter);
    const matchMode = options.matchMode || 'all';
    const allowWhitespaceShortcut = options.allowWhitespaceShortcut !== false;
    // Keep each whitespace unit separate so consecutive delimiters stay as distinct chunks.
    if (matchMode === 'any') {
      if (!raw) return allowWhitespaceShortcut ? /\s/ : new RegExp(escapeRegExp(raw));
      if (allowWhitespaceShortcut && raw === ' ') return /\s/;
      // Each character becomes its own delimiter in match-any mode.
      const escaped = Array.from(raw)
        .map(char => {
          if (char === '\n') return '\\n';
          if (char === '\r') return '\\r';
          if (char === '\t') return '\\t';
          return escapeCharClass(char);
        })
        .join('');
      return new RegExp(`[${escaped}]`);
    }
    if (allowWhitespaceShortcut && (!raw || raw === ' ')) return /\s/;
    if (raw === '\n') return /\r?\n/;
    if (raw === '\t') return /\t/;
    return new RegExp(escapeRegExp(raw));
  }

  const FIRST_CHUNK_BEHAVIORS = {
    SIZE: 'size',
    BETWEEN: 'between',
    RANDOM_START: 'random-start'
  };

  const EMPTY_CHUNK_DELIMITER_MODE = 'empty-chunk';

  const LENGTH_MODES = {
    EXACT: 'exact',
    ALLOW: 'allow',
    EXACT_ONCE: 'exact-once',
    FIT_SMALLEST: 'fit-smallest',
    FIT_LARGEST: 'fit-largest',
    DROPOUT: 'dropout'
  };

  const ORDER_MODES = {
    CANONICAL: 'canonical',
    INTERLEAVE: 'randomize-interleave',
    FULL: 'full-randomize'
  };

  const SINGLE_PASS_FIT_MODES = {
    SMALLEST: 'smallest',
    LARGEST: 'largest'
  };

  function coerceFirstChunkBehavior(value) {
    if (value === false) return FIRST_CHUNK_BEHAVIORS.SIZE;
    if (value === true) return FIRST_CHUNK_BEHAVIORS.BETWEEN;
    if (value === FIRST_CHUNK_BEHAVIORS.SIZE) return FIRST_CHUNK_BEHAVIORS.SIZE;
    if (value === FIRST_CHUNK_BEHAVIORS.RANDOM_START) return FIRST_CHUNK_BEHAVIORS.RANDOM_START;
    return FIRST_CHUNK_BEHAVIORS.BETWEEN;
  }

  // Split raw text into delimiter-preserving chunks, with optional first-chunk behavior to offset cycles.
  // Example: "a   b" with whitespace + size 1 yields ["a ", " ", " ", "b"].
  function parseInput(raw, keepDelim = false, delimiter = /\s/, size = 1, firstChunkBehavior = FIRST_CHUNK_BEHAVIORS.BETWEEN) {
    if (!raw) return [];
    const normalized = raw.replace(/\r\n/g, '\n');
    // Sentence mode still preserves punctuation, but each mark is treated as its own delimiter unit.
    const activeDelimiter = keepDelim ? /[,.!:;?\n]/ : delimiter;
    const splitRe = buildDelimiterRegex(activeDelimiter);
    const flags = splitRe.flags.includes('g') ? splitRe.flags : splitRe.flags + 'g';
    const re = new RegExp(splitRe.source, flags);
    const items = [];
    let lastIndex = 0;
    let match;
    while ((match = re.exec(normalized)) !== null) {
      if (match[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      const end = match.index + match[0].length;
      if (end > lastIndex) {
        items.push(normalized.slice(lastIndex, end));
        lastIndex = end;
      }
    }
    if (lastIndex < normalized.length) {
      items.push(normalized.slice(lastIndex));
    }
    const groupSize = Math.max(1, parseInt(size, 10) || 1);
    const behavior = coerceFirstChunkBehavior(firstChunkBehavior);
    let orderedItems = items.slice();
    if (behavior === FIRST_CHUNK_BEHAVIORS.RANDOM_START && orderedItems.length > 1) {
      const startIndex = Math.floor(Math.random() * orderedItems.length);
      if (startIndex > 0) {
        orderedItems = orderedItems.slice(startIndex).concat(orderedItems.slice(0, startIndex));
      }
    }
    if (groupSize === 1 || orderedItems.length <= 1) return orderedItems;
    const grouped = [];
    if (behavior === FIRST_CHUNK_BEHAVIORS.BETWEEN) {
      const firstGroupSize = Math.min(orderedItems.length, Math.floor(Math.random() * groupSize) + 1);
      // The first chunk is shorter on purpose to keep slice points from lining up every cycle.
      grouped.push(orderedItems.slice(0, firstGroupSize).join(''));
      for (let i = firstGroupSize; i < orderedItems.length; i += groupSize) {
        grouped.push(orderedItems.slice(i, i + groupSize).join(''));
      }
    } else {
      for (let i = 0; i < orderedItems.length; i += groupSize) {
        grouped.push(orderedItems.slice(i, i + groupSize).join(''));
      }
    }
    return grouped;
  }

  function normalizeCustomDelimiter(value) {
    if (!value) return '';
    return value.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }

  // File names are user-entered; trim whitespace and keep the chosen label intact.
  function normalizeFileName(value) {
    if (typeof value !== 'string') return '';
    return value.trim();
  }

  function stripJsonExtension(fileName) {
    if (typeof fileName !== 'string') return '';
    return fileName.replace(/\.json$/i, '');
  }

  function ensureJsonExtension(fileName) {
    if (typeof fileName !== 'string') return '';
    return /\.json$/i.test(fileName) ? fileName : `${fileName}.json`;
  }

  const PRESET_CATALOG_KEYS = ['PromptEnhancerPresetCatalog', 'PromptEnhancerPresets'];

  function clonePresetState(value) {
    if (!value || typeof value !== 'object') return null;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      return null;
    }
  }

  // Preset catalog accepts { presets: [...] } or direct array entries.
  // Entries can be { name/label, state } or raw state objects.
  function normalizePresetCatalog(data) {
    const source = Array.isArray(data) ? data : Array.isArray(data?.presets) ? data.presets : [];
    return source
      .map((entry, index) => {
        const hasExplicitState =
          entry &&
          typeof entry === 'object' &&
          (Object.prototype.hasOwnProperty.call(entry, 'state') ||
            Object.prototype.hasOwnProperty.call(entry, 'data') ||
            Object.prototype.hasOwnProperty.call(entry, 'preset'));
        const stateSource = hasExplicitState ? (entry.state || entry.data || entry.preset) : entry;
        const state = clonePresetState(stateSource);
        if (!state || typeof state !== 'object') return null;
        const labelSource =
          (entry && typeof entry === 'object' && (entry.label || entry.name || entry.id || entry.file)) ||
          `Preset ${index + 1}`;
        const label = typeof labelSource === 'string' ? labelSource.trim() : `Preset ${index + 1}`;
        const idSource = entry && typeof entry === 'object' && entry.id ? String(entry.id).trim() : '';
        const id = idSource || `preset-${index + 1}`;
        const fileName = entry && typeof entry === 'object' && typeof entry.file === 'string'
          ? entry.file.trim()
          : `${label}.json`;
        return {
          id,
          label: label || `Preset ${index + 1}`,
          file: ensureJsonExtension(fileName || `preset-${index + 1}.json`),
          state
        };
      })
      .filter(Boolean);
  }

  function readPresetCatalogEntries() {
    if (typeof window === 'undefined') return [];
    for (const key of PRESET_CATALOG_KEYS) {
      const raw = window[key];
      if (!raw) continue;
      const entries = normalizePresetCatalog(raw);
      if (entries.length) return entries;
    }
    return [];
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function readChunkSize(boxEl) {
    const sizeSelect = boxEl?.querySelector?.('.delimiter-size');
    const customInput = boxEl?.querySelector?.('.delimiter-size-custom');
    if (!sizeSelect) return 1;
    const raw = sizeSelect.value;
    if (raw === 'custom') {
      const customValue = parseInt(customInput?.value, 10);
      if (!isNaN(customValue) && customValue > 0) {
        sizeSelect.dataset.lastNumeric = String(customValue);
        return customValue;
      }
    }
    if (raw && raw !== 'preserve') {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed > 0) {
        sizeSelect.dataset.lastNumeric = String(parsed);
        return parsed;
      }
    }
    const fallback = parseInt(sizeSelect.dataset.lastNumeric || '', 10);
    return !isNaN(fallback) && fallback > 0 ? fallback : 1;
  }

  // Delimiter config normalizes legacy custom modes and preserves match-any intent.
  function getDelimiterConfig(boxEl) {
    const select = boxEl.querySelector('.delimiter-select');
    const customInput = boxEl.querySelector('.delimiter-custom');
    const selectedMode = normalizeDelimiterMode(select ? select.value : 'whitespace');
    // Empty-chunk mode is a temporary UI lock for blank strings.
    const mode = selectedMode === EMPTY_CHUNK_DELIMITER_MODE ? 'whitespace' : selectedMode;
    const rawCustom = normalizeCustomDelimiter(customInput?.value || '');
    let delimiter = ' ';
    let matchMode = 'all';
    let allowWhitespaceShortcut = true;
    if (mode === 'whitespace') delimiter = ' ';
    else if (mode === 'comma') delimiter = ',';
    else if (mode === 'semicolon') delimiter = ';';
    else if (mode === 'pipe') delimiter = '|';
    else if (mode === 'newline') delimiter = '\n';
    else if (mode === 'tab') delimiter = '\t';
    else if (mode === 'custom-all' || mode === 'custom') delimiter = rawCustom;
    else if (mode === 'custom-any') {
      delimiter = rawCustom;
      matchMode = 'any';
      allowWhitespaceShortcut = rawCustom === '';
    }
    const sentenceMode = mode === 'sentence';
    if (!sentenceMode && !delimiter) {
      delimiter = ' ';
      allowWhitespaceShortcut = true;
    }
    const regex = sentenceMode
      ? /[,.!:;?\n]/
      : buildDelimiterRegex(delimiter, { matchMode, allowWhitespaceShortcut });
    const size = Math.max(1, readChunkSize(boxEl));
    return { mode, delimiter, regex, size, sentenceMode };
  }

  function readNumber(input, fallback = 1000) {
    const val = parseInt(input?.value, 10);
    return !isNaN(val) && val > 0 ? val : fallback;
  }

  function isActive(btn) {
    return !!btn && btn.classList.contains('active');
  }

  function readExactMode(boxEl) {
    const select = boxEl.querySelector('.length-mode');
    if (select) return select.value !== LENGTH_MODES.ALLOW;
    const exactBtn = boxEl.querySelector('.exact-toggle');
    return isActive(exactBtn);
  }

  // Single-pass modes are encoded in the length mode select to avoid extra toggles.
  function readSinglePassMode(boxEl) {
    const select = boxEl.querySelector('.length-mode');
    if (!select) return false;
    return (
      select.value === LENGTH_MODES.EXACT_ONCE ||
      select.value === LENGTH_MODES.FIT_SMALLEST ||
      select.value === LENGTH_MODES.FIT_LARGEST
    );
  }

  function readSinglePassFitMode(boxEl) {
    if (!boxEl?.classList?.contains('mix-box')) return SINGLE_PASS_FIT_MODES.SMALLEST;
    const select = boxEl.querySelector('.length-mode');
    if (!select) return SINGLE_PASS_FIT_MODES.SMALLEST;
    if (select.value === LENGTH_MODES.FIT_LARGEST) return SINGLE_PASS_FIT_MODES.LARGEST;
    return SINGLE_PASS_FIT_MODES.SMALLEST;
  }

  function normalizeMixOrderMode(value, legacyRandomize = false) {
    if (value === ORDER_MODES.FULL) return ORDER_MODES.FULL;
    if (value === ORDER_MODES.INTERLEAVE) return ORDER_MODES.INTERLEAVE;
    if (value === ORDER_MODES.CANONICAL) return ORDER_MODES.CANONICAL;
    return legacyRandomize ? ORDER_MODES.INTERLEAVE : ORDER_MODES.CANONICAL;
  }

  function normalizeChunkOrderMode(value, legacyRandomize = false) {
    if (value === ORDER_MODES.FULL) return ORDER_MODES.FULL;
    if (value === ORDER_MODES.CANONICAL) return ORDER_MODES.CANONICAL;
    return legacyRandomize ? ORDER_MODES.FULL : ORDER_MODES.CANONICAL;
  }

  function readMixOrderMode(boxEl) {
    if (!boxEl?.classList?.contains('mix-box')) return ORDER_MODES.CANONICAL;
    const select = boxEl.querySelector('.order-mode');
    return normalizeMixOrderMode(select?.value);
  }

  function readChunkOrderMode(boxEl) {
    if (!boxEl?.classList?.contains('chunk-box')) return ORDER_MODES.CANONICAL;
    const select = boxEl.querySelector('.order-mode');
    return normalizeChunkOrderMode(select?.value);
  }

  function readMixLengthMode(boxEl) {
    if (!boxEl?.classList?.contains('mix-box')) return LENGTH_MODES.FIT_SMALLEST;
    const select = boxEl.querySelector('.length-mode');
    if (select) return select.value;
    if (readSinglePassFitMode(boxEl) === SINGLE_PASS_FIT_MODES.LARGEST) {
      return LENGTH_MODES.FIT_LARGEST;
    }
    if (readSinglePassMode(boxEl)) return LENGTH_MODES.FIT_SMALLEST;
    return readExactMode(boxEl) ? LENGTH_MODES.EXACT : LENGTH_MODES.ALLOW;
  }

  function readChunkLengthMode(boxEl) {
    if (!boxEl?.classList?.contains('chunk-box')) return LENGTH_MODES.EXACT_ONCE;
    const select = boxEl.querySelector('.length-mode');
    if (select) return select.value;
    if (readSinglePassMode(boxEl)) return LENGTH_MODES.EXACT_ONCE;
    return readExactMode(boxEl) ? LENGTH_MODES.EXACT : LENGTH_MODES.ALLOW;
  }

  function getMixLengthModeConfig(config) {
    if (!config) return LENGTH_MODES.FIT_SMALLEST;
    if (config.lengthMode === LENGTH_MODES.EXACT_ONCE) return LENGTH_MODES.FIT_SMALLEST;
    if (config.lengthMode === LENGTH_MODES.FIT_LARGEST) return LENGTH_MODES.FIT_LARGEST;
    if (config.lengthMode === LENGTH_MODES.FIT_SMALLEST) return LENGTH_MODES.FIT_SMALLEST;
    if (config.lengthMode === LENGTH_MODES.DROPOUT) return LENGTH_MODES.DROPOUT;
    if (config.lengthMode === LENGTH_MODES.EXACT) return LENGTH_MODES.EXACT;
    if (config.lengthMode === LENGTH_MODES.ALLOW) return LENGTH_MODES.ALLOW;
    if (config.singlePass) {
      return config.singlePassMode === SINGLE_PASS_FIT_MODES.LARGEST
        ? LENGTH_MODES.FIT_LARGEST
        : LENGTH_MODES.FIT_SMALLEST;
    }
    if (config.exact === false) return LENGTH_MODES.ALLOW;
    if (config.exact === true) return LENGTH_MODES.EXACT;
    return LENGTH_MODES.FIT_SMALLEST;
  }

  function getChunkLengthModeConfig(config) {
    if (!config) return LENGTH_MODES.EXACT_ONCE;
    if (config.lengthMode === LENGTH_MODES.DROPOUT) return LENGTH_MODES.DROPOUT;
    if (config.lengthMode === LENGTH_MODES.EXACT_ONCE) return LENGTH_MODES.EXACT_ONCE;
    if (config.lengthMode === LENGTH_MODES.EXACT) return LENGTH_MODES.EXACT;
    if (config.lengthMode === LENGTH_MODES.ALLOW) return LENGTH_MODES.ALLOW;
    if (config.singlePass) return LENGTH_MODES.EXACT_ONCE;
    if (config.exact === false) return LENGTH_MODES.ALLOW;
    if (config.exact === true) return LENGTH_MODES.EXACT;
    return LENGTH_MODES.EXACT_ONCE;
  }

  function readFirstChunkBehavior(boxEl) {
    const select = boxEl.querySelector('.first-chunk-select');
    if (select) return coerceFirstChunkBehavior(select.value);
    const toggle = boxEl.querySelector('.random-first-toggle');
    if (toggle) return isActive(toggle) ? FIRST_CHUNK_BEHAVIORS.BETWEEN : FIRST_CHUNK_BEHAVIORS.SIZE;
    return FIRST_CHUNK_BEHAVIORS.BETWEEN;
  }

  function getFirstChunkBehaviorConfig(config) {
    if (!config) return FIRST_CHUNK_BEHAVIORS.BETWEEN;
    if (config.firstChunkBehavior) return coerceFirstChunkBehavior(config.firstChunkBehavior);
    if (config.randomFirst === false) return FIRST_CHUNK_BEHAVIORS.SIZE;
    if (config.randomFirst === true) return FIRST_CHUNK_BEHAVIORS.BETWEEN;
    return FIRST_CHUNK_BEHAVIORS.BETWEEN;
  }

  function escapeSelector(value) {
    if (typeof value !== 'string') return '';
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
    return value.replace(/["\\]/g, '\\$&');
  }

  // Color presets are shared across boxes; custom entries are user-defined and serialized.
  const DEFAULT_COLOR_PRESETS = [
    { id: 'sunset', name: 'Sunset', color: '#f2aa48' },
    { id: 'citrus', name: 'Citrus', color: '#aae060' },
    { id: 'coral', name: 'Coral', color: '#f28878' },
    { id: 'gold', name: 'Gold', color: '#f2d266' },
    { id: 'sage', name: 'Sage', color: '#bcce60' },
    { id: 'rose', name: 'Rose', color: '#e67058' },
    { id: 'orchid', name: 'Orchid', color: '#ec78d6' },
    { id: 'amethyst', name: 'Amethyst', color: '#c878f6' }
  ];

  const MIX_AUTO_COLORS = ['#f2aa48', '#aae060', '#f28878', '#f2d266', '#bcce60', '#e67058'];
  const CHUNK_AUTO_COLORS = ['#ec78d6', '#c878f6', '#dc62dc', '#b660d6', '#e468b2', '#ac5ac2'];

  let customColorPresets = [];

  function normalizeHexColor(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(trimmed)) {
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
    }
    if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
    return '';
  }

  function slugifyPresetName(value) {
    if (typeof value !== 'string') return '';
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getAllColorPresets() {
    return [...DEFAULT_COLOR_PRESETS, ...customColorPresets];
  }

  function loadColorPresets(state) {
    const raw = Array.isArray(state?.colorPresets) ? state.colorPresets : [];
    customColorPresets = raw
      .map(entry => ({
        id: slugifyPresetName(entry?.name || entry?.id || ''),
        name: typeof entry?.name === 'string' ? entry.name.trim() : '',
        color: normalizeHexColor(entry?.color)
      }))
      .filter(entry => entry.id && entry.name && entry.color);
  }

  function exportColorPresets() {
    return customColorPresets.map(entry => ({
      id: entry.id,
      name: entry.name,
      color: entry.color
    }));
  }

  function upsertCustomPreset(name, color) {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanColor = normalizeHexColor(color);
    if (!cleanName || !cleanColor) return null;
    const id = slugifyPresetName(cleanName) || `preset-${Date.now()}`;
    const existing = customColorPresets.find(entry => entry.id === id);
    if (existing) {
      existing.name = cleanName;
      existing.color = cleanColor;
      return existing;
    }
    const preset = { id, name: cleanName, color: cleanColor };
    customColorPresets.push(preset);
    return preset;
  }

  function getPresetById(id) {
    if (!id) return null;
    return getAllColorPresets().find(entry => entry.id === id) || null;
  }

  function getAutoColorHex(box) {
    const autoColor = parseInt(box?.dataset?.autoColor, 10);
    const index = Number.isFinite(autoColor) ? Math.max(0, autoColor - 1) : 0;
    if (box?.classList?.contains('mix-box')) return MIX_AUTO_COLORS[index] || MIX_AUTO_COLORS[0];
    if (box?.classList?.contains('chunk-box')) return CHUNK_AUTO_COLORS[index] || CHUNK_AUTO_COLORS[0];
    return MIX_AUTO_COLORS[0];
  }

  function rgbFromHex(hex) {
    const clean = normalizeHexColor(hex);
    if (!clean) return { r: 0, g: 0, b: 0 };
    const num = parseInt(clean.slice(1), 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function clampByte(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function shiftRgb(rgb, amount) {
    return {
      r: clampByte(rgb.r + amount),
      g: clampByte(rgb.g + amount),
      b: clampByte(rgb.b + amount)
    };
  }

  function rgbaString(rgb, alpha) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function clearCustomBoxStyles(box) {
    if (!box) return;
    const header = box.querySelector('.box-header');
    box.style.borderColor = '';
    box.style.background = '';
    if (header) {
      header.style.background = '';
      header.style.borderColor = '';
    }
  }

  // Apply a gradient skin for a custom color so the box still matches the existing UI style.
  function applyCustomBoxStyles(box, hex) {
    if (!box) return;
    const header = box.querySelector('.box-header');
    const base = rgbFromHex(hex);
    const light = shiftRgb(base, 36);
    const lighter = shiftRgb(base, 60);
    const mid = shiftRgb(base, 12);
    const dark = shiftRgb(base, -50);
    const darker = shiftRgb(base, -90);

    box.style.borderColor = rgbaString(base, 0.9);
    box.style.background = `
      linear-gradient(0deg, rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0.28)),
      radial-gradient(circle at 14% 18%, ${rgbaString(lighter, 0.28)} 0 12px, transparent 16px),
      radial-gradient(circle at 70% 28%, ${rgbaString(light, 0.24)} 0 12px, transparent 16px),
      radial-gradient(circle at 34% 72%, ${rgbaString(mid, 0.22)} 0 14px, transparent 18px),
      linear-gradient(135deg, ${rgbaString(dark, 0.98)}, ${rgbaString(darker, 0.98)})
    `;

    if (header) {
      header.style.background = `linear-gradient(90deg, ${rgbaString(lighter, 0.95)}, ${rgbaString(base, 0.92)})`;
      header.style.borderColor = rgbaString(light, 0.75);
    }
  }

  // Switch between auto, preset, or custom colors while keeping the original auto variant on hand.
  function setBoxColorMode(box, mode, value) {
    if (!box) return;
    const autoColor = box.dataset.autoColor || box.dataset.color || '';
    if (mode === 'auto') {
      box.dataset.colorMode = 'auto';
      box.dataset.color = autoColor;
      delete box.dataset.colorValue;
      delete box.dataset.colorPreset;
      clearCustomBoxStyles(box);
      return;
    }
    if (mode === 'preset') {
      const preset = getPresetById(value);
      if (!preset) {
        // Preset missing? Fall back to auto rather than leaving stale colors.
        setBoxColorMode(box, 'auto');
        return;
      }
      box.dataset.colorMode = 'preset';
      box.dataset.colorPreset = preset.id;
      box.dataset.colorValue = preset.color;
      box.dataset.color = 'custom';
      applyCustomBoxStyles(box, preset.color);
      return;
    }
    const clean = normalizeHexColor(value);
    if (!clean) {
      setBoxColorMode(box, 'auto');
      return;
    }
    box.dataset.colorMode = 'custom';
    box.dataset.colorValue = clean;
    delete box.dataset.colorPreset;
    box.dataset.color = 'custom';
    applyCustomBoxStyles(box, clean);
  }

  function syncColorControls(box) {
    if (!box) return;
    const select = box.querySelector('.color-preset-select');
    const colorInput = box.querySelector('.color-custom-input');
    const mode = box.dataset.colorMode || 'auto';
    const value = box.dataset.colorValue || '';
    const presetId = box.dataset.colorPreset || '';
    if (select) {
      if (mode === 'preset' && presetId) {
        select.value = presetId;
      } else if (mode === 'custom') {
        select.value = 'custom';
      } else {
        select.value = 'auto';
      }
    }
    if (colorInput) {
      if (mode === 'custom' && value) {
        colorInput.value = value;
      } else if (mode === 'preset' && value) {
        colorInput.value = value;
      } else {
        colorInput.value = getAutoColorHex(box);
      }
    }
  }

  function refreshColorPresetSelects(scope) {
    const root = scope || document;
    const presets = getAllColorPresets();
    root.querySelectorAll('.color-preset-select').forEach(select => {
      const box = select.closest('.mix-box, .chunk-box');
      select.innerHTML = '';
      const autoOption = document.createElement('option');
      autoOption.value = 'auto';
      autoOption.textContent = 'Auto';
      select.appendChild(autoOption);
      const customOption = document.createElement('option');
      customOption.value = 'custom';
      customOption.textContent = 'Custom...';
      select.appendChild(customOption);
      presets.forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        select.appendChild(option);
      });
      syncColorControls(box);
    });
  }

  const mobileQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 768px)')
      : null;

  function isMobileLayout() {
    return !!(mobileQuery && mobileQuery.matches);
  }

  function applyMobileWindowState(target) {
    if (!isMobileLayout()) return;
    const windows = target
      ? [target]
      : Array.from(document.querySelectorAll('.app-window:not(.window-template)'));
    windows.forEach(win => {
      if (!win || win.classList.contains('is-hidden')) return;
      win.classList.add('is-maximized');
    });
  }

  // ======== Chunking + Mixing Engine ========
  // Single-pass length modes avoid repetition, and first-chunk offsets keep slice points varied.

  function buildChunkList(
    raw,
    delimiterConfig,
    limit,
    exact,
    randomize,
    singlePass = false,
    firstChunkBehavior = FIRST_CHUNK_BEHAVIORS.BETWEEN
  ) {
    const config = delimiterConfig || { regex: /\s/, size: 1, sentenceMode: false };
    const chunks = parseInput(raw || '', config.sentenceMode, config.regex, config.size, firstChunkBehavior);
    const base = chunks.filter(chunk => chunk.length > 0);
    if (!base.length) return [];
    const ordered = randomize ? shuffle(base.slice()) : base.slice();
    const max = singlePass
      ? Number.POSITIVE_INFINITY
      : Math.max(0, parseInt(limit, 10) || 0);
    if (!max) return [];
    const out = [];
    let length = 0;
    if (singlePass) {
      // Single-pass output never wraps; the limit is ignored so chunks emit once.
      for (let idx = 0; idx < ordered.length && length < max; idx += 1) {
        const chunk = ordered[idx];
        if (!chunk) continue;
        const remaining = max - length;
        if (chunk.length <= remaining) {
          out.push(chunk);
          length += chunk.length;
          continue;
        }
        if (exact && remaining > 0) {
          out.push(chunk.slice(0, remaining));
          length = max;
        }
        break;
      }
      return out;
    }
    let idx = 0;
    while (length < max) {
      const chunk = ordered[idx % ordered.length];
      idx += 1;
      if (!chunk) {
        if (idx > ordered.length * 2) break;
        continue;
      }
      const remaining = max - length;
      if (chunk.length <= remaining) {
        out.push(chunk);
        length += chunk.length;
        continue;
      }
      if (exact && remaining > 0) {
        out.push(chunk.slice(0, remaining));
        length = max;
      }
      break;
    }
    return out;
  }

  function mixChunkLists(
    lists,
    limit,
    exact,
    randomize,
    singlePass = false,
    singlePassFitMode = SINGLE_PASS_FIT_MODES.SMALLEST
  ) {
    const normalized = lists
      .filter(Array.isArray)
      .map(list => list.filter(chunk => typeof chunk === 'string'));
    if (
      singlePass &&
      singlePassFitMode === SINGLE_PASS_FIT_MODES.SMALLEST &&
      normalized.some(list => list.length === 0)
    ) {
      // Fit-to-smallest should stop immediately when any child has no chunks.
      return [];
    }
    const sources = normalized.filter(list => list.length);
    if (!sources.length) return [];
    const max = singlePass
      ? Number.POSITIVE_INFINITY
      : Math.max(0, parseInt(limit, 10) || 0);
    if (!max) return [];
    const out = [];
    let length = 0;
    if (singlePass) {
      const orderBase = Array.from({ length: sources.length }, (_, i) => i);
      const cycleCount = singlePassFitMode === SINGLE_PASS_FIT_MODES.LARGEST
        ? Math.max(...sources.map(list => list.length))
        : Math.min(...sources.map(list => list.length));
      for (let cycle = 0; cycle < cycleCount && length < max; cycle += 1) {
        const order = randomize ? shuffle(orderBase.slice()) : orderBase;
        for (const idx of order) {
          const list = sources[idx];
          const chunkIndex = singlePassFitMode === SINGLE_PASS_FIT_MODES.LARGEST
            ? cycle % list.length
            : cycle;
          const chunk = list[chunkIndex];
          if (chunk == null) continue;
          const remaining = max - length;
          if (chunk.length <= remaining) {
            out.push(chunk);
            length += chunk.length;
          } else {
            if (exact && remaining > 0) {
              out.push(chunk.slice(0, remaining));
              length = max;
            }
            return out;
          }
          if (length >= max) return out;
        }
      }
      return out;
    }

    const positions = sources.map(() => 0);
    while (length < max) {
      const order = randomize
        ? shuffle(Array.from({ length: sources.length }, (_, i) => i))
        : Array.from({ length: sources.length }, (_, i) => i);
      let added = false;
      let grew = false;
      for (const idx of order) {
        const list = sources[idx];
        if (!list.length) continue;
        const pos = positions[idx];
        const chunk = list[pos % list.length];
        positions[idx] = pos + 1;
        if (chunk == null) continue;
        const remaining = max - length;
        if (chunk.length <= remaining) {
          out.push(chunk);
          length += chunk.length;
          added = true;
          if (chunk.length > 0) grew = true;
        } else {
          if (exact && remaining > 0) {
            out.push(chunk.slice(0, remaining));
            length = max;
          }
          return out;
        }
        if (length >= max) return out;
      }
      if (!added) break;
      if (!grew) break;
    }
    return out;
  }

  function readMaxChunkLength(chunks) {
    if (!Array.isArray(chunks) || !chunks.length) return 0;
    return chunks.reduce((max, chunk) => {
      if (typeof chunk !== 'string') return max;
      return Math.max(max, chunk.length);
    }, 0);
  }

  function readMaxChunkLengthFromLists(lists) {
    if (!Array.isArray(lists) || !lists.length) return 0;
    return lists.reduce((max, list) => Math.max(max, readMaxChunkLength(list)), 0);
  }

  // Build a repeated cycle using full chunks only. This mirrors "Delete Final Chunk"
  // behavior (no trimming) and is used to seed dropout before random removals.
  function buildCycleWithinLimit(chunks, limit) {
    const source = Array.isArray(chunks) ? chunks.filter(chunk => typeof chunk === 'string') : [];
    const max = Math.max(0, parseInt(limit, 10) || 0);
    if (!source.length || !max) return [];
    const out = [];
    let length = 0;
    let grew = false;
    while (length < max) {
      for (const chunk of source) {
        const remaining = max - length;
        if (chunk.length <= remaining) {
          out.push(chunk);
          length += chunk.length;
          if (chunk.length > 0) grew = true;
        } else {
          return out;
        }
        if (length >= max) return out;
      }
      if (!grew) break;
    }
    return out;
  }

  // Dropout removes random full chunks until the concatenated output length
  // is at or under the configured limit.
  function dropChunksToLimit(chunks, limit) {
    const source = Array.isArray(chunks) ? chunks.filter(chunk => typeof chunk === 'string' && chunk.length > 0) : [];
    const max = Math.max(0, parseInt(limit, 10) || 0);
    if (!source.length || !max) return [];
    const out = source.slice();
    let length = out.reduce((total, chunk) => total + chunk.length, 0);
    while (out.length && length > max) {
      const idx = Math.floor(Math.random() * out.length);
      const [removed] = out.splice(idx, 1);
      if (removed) length -= removed.length;
    }
    return out;
  }

  // ======== Box Evaluation ========

  // Each generate pass uses a cache to keep repeated evaluations stable.
  // Mix variables add their own scope so they behave like local submix instances.
  function getEvaluationCache(context) {
    return context?.cache instanceof Map ? context.cache : null;
  }

  // Cache keys can be scoped so variable-referenced mixes evaluate like local submix copies.
  // When scope is empty, behavior stays global for top-level/direct child evaluation.
  function getEvaluationCacheKey(type, boxEl, context = {}) {
    const boxId = boxEl?.dataset?.boxId;
    if (!boxId) return '';
    const scope = context?.cacheScope ? `${context.cacheScope}:` : '';
    return `${scope}${type}:${boxId}`;
  }

  function evaluateChunkBox(boxEl, context = {}) {
    const input = boxEl.querySelector('.chunk-input');
    const limitInput = boxEl.querySelector('.length-input');
    const outputEl = boxEl.querySelector('.chunk-output-text');
    const cache = getEvaluationCache(context);
    const cacheKey = getEvaluationCacheKey('chunk', boxEl, context);
    if (cache && cacheKey && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey).slice();
      if (outputEl) outputEl.textContent = cached.join('');
      return cached;
    }
    const rawInput = input?.value || '';
    if (rawInput === '') {
      const emptyChunk = [''];
      if (outputEl) outputEl.textContent = '';
      if (cache && cacheKey) cache.set(cacheKey, emptyChunk.slice());
      return emptyChunk;
    }
    const limit = readNumber(limitInput, 1000);
    const lengthMode = readChunkLengthMode(boxEl);
    const dropoutMode = lengthMode === LENGTH_MODES.DROPOUT;
    const exact = readExactMode(boxEl);
    const singlePass = readSinglePassMode(boxEl);
    const orderMode = readChunkOrderMode(boxEl);
    const randomize = orderMode === ORDER_MODES.FULL;
    const firstChunkBehavior = readFirstChunkBehavior(boxEl);
    const delimiterConfig = getDelimiterConfig(boxEl);
    const result = dropoutMode
      ? (() => {
          const fullCycle = buildChunkList(
            rawInput,
            delimiterConfig,
            Number.POSITIVE_INFINITY,
            false,
            randomize,
            true,
            firstChunkBehavior
          );
          const overrunLimit = limit + Math.max(1, readMaxChunkLength(fullCycle));
          const seeded = buildCycleWithinLimit(fullCycle, overrunLimit);
          return dropChunksToLimit(seeded, limit);
        })()
      : buildChunkList(
          rawInput,
          delimiterConfig,
          limit,
          exact,
          randomize,
          singlePass,
          firstChunkBehavior
        );
    if (outputEl) outputEl.textContent = result.join('');
    if (cache && cacheKey) cache.set(cacheKey, result.slice());
    return result;
  }

  function evaluateVariableBox(boxEl, context) {
    const select = boxEl.querySelector('.variable-select');
    const targetId = select?.value || '';
    if (!targetId) return [];
    const root = context?.root || document;
    const target = root.querySelector(`[data-box-id="${escapeSelector(targetId)}"]`);
    if (!target) return [];
    if (target.classList.contains('mix-box')) {
      // Mix variables should behave as in-place submixes, so isolate cache scope per variable box.
      // This keeps evaluation deterministic within one variable while avoiding shared randomized output.
      const variableScope = `var:${boxEl?.dataset?.boxId || ''}`;
      const scopedContext = {
        ...context,
        cacheScope: context?.cacheScope ? `${context.cacheScope}/${variableScope}` : variableScope
      };
      return evaluateMixBox(target, scopedContext).slice();
    }
    if (target.classList.contains('chunk-box')) return evaluateChunkBox(target, context).slice();
    return [];
  }

  function evaluateMixBox(boxEl, context = {}) {
    const limitInput = boxEl.querySelector('.length-input');
    const sizeSelect = boxEl.querySelector('.delimiter-size');
    const outputEl = boxEl.querySelector('.mix-output-text');

    const limit = readNumber(limitInput, 1000);
    const lengthMode = readMixLengthMode(boxEl);
    const dropoutMode = lengthMode === LENGTH_MODES.DROPOUT;
    const exact = readExactMode(boxEl);
    const singlePass = readSinglePassMode(boxEl);
    const singlePassFitMode = readSinglePassFitMode(boxEl);
    const orderMode = readMixOrderMode(boxEl);
    const interleaveRandomize = orderMode === ORDER_MODES.INTERLEAVE;
    const fullRandomize = orderMode === ORDER_MODES.FULL;
    const firstChunkBehavior = readFirstChunkBehavior(boxEl);
    const preserve = sizeSelect?.value === 'preserve';
    const delimiterConfig = getDelimiterConfig(boxEl);

    const root = context.root || boxEl.closest('.mix-root') || document;
    const visiting = context.visiting || new Set();
    const cache = getEvaluationCache(context);
    const cacheKey = getEvaluationCacheKey('mix', boxEl, context);
    if (cache && cacheKey && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey).slice();
      if (outputEl) outputEl.textContent = cached.join('');
      return cached;
    }
    const boxId = boxEl.dataset.boxId;
    if (boxId) {
      if (visiting.has(boxId)) return [];
      visiting.add(boxId);
    }

    const childContainer = boxEl.querySelector('.mix-children');
    const children = childContainer
      ? Array.from(childContainer.children)
          .map(child => child.querySelector('.mix-box, .chunk-box, .variable-box'))
          .filter(Boolean)
      : [];

    const lists = children.map(child => {
      if (child.classList.contains('mix-box')) return evaluateMixBox(child, { root, visiting, cache });
      if (child.classList.contains('variable-box')) return evaluateVariableBox(child, { root, visiting, cache });
      return evaluateChunkBox(child, { root, visiting, cache });
    });

    const mixLimit = dropoutMode
      ? limit + Math.max(1, readMaxChunkLengthFromLists(lists))
      : limit;
    const mixExact = dropoutMode ? false : exact;
    const mixSinglePass = dropoutMode ? false : singlePass;
    const mixedBase = mixChunkLists(
      lists,
      mixLimit,
      mixExact,
      interleaveRandomize,
      mixSinglePass,
      singlePassFitMode
    );
    const mixedOrdered = fullRandomize ? shuffle(mixedBase.slice()) : mixedBase;
    const mixed = dropoutMode ? dropChunksToLimit(mixedOrdered, limit) : mixedOrdered;
    const outputString = mixed.join('');
    if (outputEl) outputEl.textContent = outputString;

    // Dropout already enforces final length, so rechunking should not repeat output.
    const reChunkSinglePass = dropoutMode ? true : singlePass;
    const reChunkLimit = dropoutMode ? Number.POSITIVE_INFINITY : limit;
    const result = preserve
      ? mixed
      : buildChunkList(
          outputString,
          delimiterConfig,
          reChunkLimit,
          exact,
          false,
          reChunkSinglePass,
          firstChunkBehavior
        );
    if (boxId) visiting.delete(boxId);
    if (cache && cacheKey) cache.set(cacheKey, result.slice());
    return result.slice();
  }

  function generate(rootEl) {
    const root = rootEl || document.querySelector('.mix-root');
    if (!root) return;
    const evaluationCache = new Map();
    // Update top-level strings so standalone outputs stay in sync.
    const chunkBoxes = Array.from(root.children)
      .filter(child => child.classList.contains('chunk-wrapper'))
      .map(wrapper => wrapper.querySelector('.chunk-box'))
      .filter(Boolean);
    chunkBoxes.forEach(box => evaluateChunkBox(box, { root, cache: evaluationCache }));
    const mixBoxes = Array.from(root.children)
      .filter(child => child.classList.contains('mix-wrapper'))
      .map(wrapper => wrapper.querySelector('.mix-box'))
      .filter(Boolean);
    mixBoxes.forEach(box => evaluateMixBox(box, { root, visiting: new Set(), cache: evaluationCache }));
  }

  // ======== Box Creation ========

  let idCounter = 0;
  const MIX_COLOR_VARIANTS = 6;
  const CHUNK_COLOR_VARIANTS = 6;

  function pickRandomVariant(max, avoid = []) {
    const avoidSet = new Set((Array.isArray(avoid) ? avoid : [avoid]).filter(Boolean).map(String));
    if (avoidSet.size >= max) return String(Math.floor(Math.random() * max) + 1);
    let choice = String(Math.floor(Math.random() * max) + 1);
    let attempts = 0;
    while (avoidSet.has(choice) && attempts < max * 4) {
      choice = String(Math.floor(Math.random() * max) + 1);
      attempts += 1;
    }
    return choice;
  }

  function initToggleButton(btn, force) {
    if (!btn) return;
    if (force === true) btn.classList.add('active');
    if (force === false) btn.classList.remove('active');
    if (btn.dataset.on && btn.dataset.off) {
      btn.textContent = btn.classList.contains('active') ? btn.dataset.on : btn.dataset.off;
    }
  }

  function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function syncTextareaHeights(scope) {
    const root = scope || document;
    root.querySelectorAll('.chunk-input').forEach(autoResizeTextarea);
  }

  function getBoxTitle(box) {
    const titleInput = box.querySelector('.box-title');
    if (titleInput) {
      if (typeof titleInput.value === 'string') return titleInput.value.trim() || titleInput.value;
      return (titleInput.textContent || '').trim();
    }
    return box.dataset.boxId || 'Untitled';
  }

  // Refresh variable selects and omit ancestor mixes so variables cannot target their parent chain.
  function refreshVariableOptions(scope) {
    const windowEl = scope?.closest?.('.app-window') || (scope?.classList?.contains?.('app-window') ? scope : null);
    const root = windowEl?.querySelector('.mix-root') || scope?.querySelector?.('.mix-root') || document.querySelector('.mix-root') || document;
    const templateRoot = root.closest('.window-template');
    const sourceBoxes = Array.from(root.querySelectorAll('.mix-box, .chunk-box'))
      .filter(box => templateRoot || !box.closest('.window-template'));
    const sources = sourceBoxes
      .map(box => ({
        id: box.dataset.boxId,
        label: `${getBoxTitle(box)}`
      }))
      .filter(entry => entry.id);
    const getAncestorMixIds = variableBox => {
      const ids = new Set();
      let node = variableBox?.parentElement || null;
      while (node) {
        if (node.classList?.contains('mix-box')) {
          const id = node.dataset.boxId;
          if (id) ids.add(id);
        }
        node = node.parentElement;
      }
      return ids;
    };
    const selects = (windowEl || root).querySelectorAll('.variable-select');
    selects.forEach(select => {
      const current =
        select.value ||
        select.closest('.variable-box')?.dataset.targetId ||
        '';
      const box = select.closest('.variable-box');
      // Filter ancestor mix ids so variables only target outside mixes.
      const forbiddenIds = getAncestorMixIds(box);
      const allowedSources = sources.filter(source => !forbiddenIds.has(source.id));
      select.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select a mix or string...';
      select.appendChild(placeholder);
      allowedSources.forEach(source => {
        const option = document.createElement('option');
        option.value = source.id;
        option.textContent = source.label;
        select.appendChild(option);
      });
      if (current && allowedSources.some(source => source.id === current)) {
        select.value = current;
      }
      if (box && select.value) {
        box.dataset.targetId = select.value;
      } else if (box) {
        // Clear stale selections when a parent mix target is no longer valid.
        box.dataset.targetId = '';
      }
      if (box) {
        const title = box.querySelector('.box-title');
        const target = sourceBoxes.find(sourceBox => sourceBox.dataset.boxId === select.value);
        if (title) {
          title.textContent = target ? `Copy of ${getBoxTitle(target)}` : 'Variable';
        }
      }
    });
  }

  function createMixWrapper(config = {}, context = {}) {
    const template = document.getElementById('mix-box-template');
    const fragment = template.content.cloneNode(true);
    const wrapper = fragment.querySelector('.mix-wrapper');
    const box = fragment.querySelector('.mix-box');
    const titleInput = fragment.querySelector('.box-title');
    const limitInput = fragment.querySelector('.length-input');
    const orderSelect = fragment.querySelector('.order-mode');
    const lengthMode = fragment.querySelector('.length-mode');
    const firstChunkSelect = fragment.querySelector('.first-chunk-select');
    const delimiterSelect = fragment.querySelector('.delimiter-select');
    const delimiterCustom = fragment.querySelector('.delimiter-custom');
    const delimiterSize = fragment.querySelector('.delimiter-size');
    const delimiterSizeCustom = fragment.querySelector('.delimiter-size-custom');

    box.dataset.boxId = config.id || `mix-${++idCounter}`;
    box.dataset.color = String(
      config.color || pickRandomVariant(MIX_COLOR_VARIANTS, [context.parentColor, context.previousColor])
    );
    box.dataset.autoColor = box.dataset.color;
    box.dataset.colorMode = 'auto';
    if (titleInput) titleInput.value = config.title || 'Mix';
    if (limitInput) limitInput.value = config.limit || 1000;
    if (lengthMode) {
      lengthMode.value = getMixLengthModeConfig(config);
    }
    if (delimiterSelect && config.delimiter?.mode) {
      delimiterSelect.value = normalizeDelimiterMode(config.delimiter.mode);
    }
    if (delimiterCustom) delimiterCustom.value = config.delimiter?.custom || '';
    if (delimiterSize) {
      if (config.preserve) {
        delimiterSize.value = 'preserve';
      } else if (config.delimiter?.size) {
        const sizeValue = String(config.delimiter.size);
        const optionValues = Array.from(delimiterSize.options).map(option => option.value);
        if (optionValues.includes(sizeValue)) {
          delimiterSize.value = sizeValue;
        } else {
          delimiterSize.value = 'custom';
          if (delimiterSizeCustom) delimiterSizeCustom.value = sizeValue;
        }
      }
    }

    if (orderSelect) {
      orderSelect.value = normalizeMixOrderMode(config.orderMode, !!config.randomize);
    }
    if (firstChunkSelect) firstChunkSelect.value = getFirstChunkBehaviorConfig(config);
    if (config.colorMode === 'custom' && config.colorValue) {
      setBoxColorMode(box, 'custom', config.colorValue);
    } else if (config.colorMode === 'preset' && config.colorPreset) {
      setBoxColorMode(box, 'preset', config.colorPreset);
    } else if (config.colorMode === 'auto') {
      setBoxColorMode(box, 'auto');
    } else if (config.colorValue) {
      setBoxColorMode(box, 'custom', config.colorValue);
    }

    const childContainer = fragment.querySelector('.mix-children');
    if (Array.isArray(config.children)) {
      let prevColor = null;
      config.children.forEach(child => {
        if (child.type === 'mix') {
          const childWrapper = createMixWrapper(child, {
            parentColor: box.dataset.color,
            previousColor: prevColor
          });
          childContainer.appendChild(childWrapper);
          prevColor = childWrapper.querySelector('.mix-box')?.dataset.color || prevColor;
        } else if (child.type === 'variable') {
          const childWrapper = createVariableWrapper(child);
          childContainer.appendChild(childWrapper);
        } else {
          const childWrapper = createChunkWrapper(child, {
            parentColor: box.dataset.color,
            previousColor: prevColor
          });
          childContainer.appendChild(childWrapper);
          prevColor = childWrapper.querySelector('.chunk-box')?.dataset.color || prevColor;
        }
      });
    }

    updatePreserveMode(box);
    setupSizeControls(wrapper);
    updateFirstChunkBehaviorLabels(box);
    updateLengthModeState(box);
    syncTextareaHeights(wrapper);
    syncColorControls(box);
    return wrapper;
  }

  // Build a chunk box from saved state, including custom chunk sizes for save/load fidelity.
  function createChunkWrapper(config = {}, context = {}) {
    const template = document.getElementById('chunk-box-template');
    const fragment = template.content.cloneNode(true);
    const wrapper = fragment.querySelector('.chunk-wrapper');
    const box = fragment.querySelector('.chunk-box');
    const titleInput = fragment.querySelector('.box-title');
    const input = fragment.querySelector('.chunk-input');
    const limitInput = fragment.querySelector('.length-input');
    const orderSelect = fragment.querySelector('.order-mode');
    const lengthMode = fragment.querySelector('.length-mode');
    const firstChunkSelect = fragment.querySelector('.first-chunk-select');
    const delimiterSelect = fragment.querySelector('.delimiter-select');
    const delimiterCustom = fragment.querySelector('.delimiter-custom');
    const delimiterSize = fragment.querySelector('.delimiter-size');
    const delimiterSizeCustom = fragment.querySelector('.delimiter-size-custom');

    box.dataset.boxId = config.id || `chunk-${++idCounter}`;
    box.dataset.color = String(
      config.color || pickRandomVariant(CHUNK_COLOR_VARIANTS, [context.parentColor, context.previousColor])
    );
    box.dataset.autoColor = box.dataset.color;
    box.dataset.colorMode = 'auto';
    if (titleInput) titleInput.value = config.title || 'String';
    if (input) input.value = config.text || '';
    if (limitInput) limitInput.value = config.limit || 1000;
    if (lengthMode) {
      lengthMode.value = getChunkLengthModeConfig(config);
    }
    if (delimiterSelect && config.delimiter?.mode) {
      delimiterSelect.value = normalizeDelimiterMode(config.delimiter.mode);
    }
    if (delimiterCustom) delimiterCustom.value = config.delimiter?.custom || '';
    if (delimiterSize && config.delimiter?.size) {
      const sizeValue = String(config.delimiter.size);
      const optionValues = Array.from(delimiterSize.options).map(option => option.value);
      if (optionValues.includes(sizeValue)) {
        delimiterSize.value = sizeValue;
      } else {
        delimiterSize.value = 'custom';
        // Custom sizes live in the numeric input; restore it so size roundtrips.
        if (delimiterSizeCustom) delimiterSizeCustom.value = sizeValue;
      }
    }

    if (orderSelect) {
      orderSelect.value = normalizeChunkOrderMode(config.orderMode, !!config.randomize);
    }
    if (firstChunkSelect) firstChunkSelect.value = getFirstChunkBehaviorConfig(config);
    if (config.colorMode === 'custom' && config.colorValue) {
      setBoxColorMode(box, 'custom', config.colorValue);
    } else if (config.colorMode === 'preset' && config.colorPreset) {
      setBoxColorMode(box, 'preset', config.colorPreset);
    } else if (config.colorMode === 'auto') {
      setBoxColorMode(box, 'auto');
    } else if (config.colorValue) {
      setBoxColorMode(box, 'custom', config.colorValue);
    }

    syncTextareaHeights(wrapper);
    setupSizeControls(wrapper);
    updateLengthModeState(box);
    updateFirstChunkBehaviorLabels(box);
    updateEmptyChunkMode(box);
    syncColorControls(box);
    return wrapper;
  }

  function createVariableWrapper(config = {}) {
    const template = document.getElementById('variable-box-template');
    const fragment = template.content.cloneNode(true);
    const wrapper = fragment.querySelector('.variable-wrapper');
    const box = fragment.querySelector('.variable-box');
    const select = fragment.querySelector('.variable-select');

    box.dataset.boxId = config.id || `var-${++idCounter}`;
    if (config.targetId) box.dataset.targetId = config.targetId;
    if (select && config.targetId) select.value = config.targetId;
    return wrapper;
  }

  function getBoxColorState(box) {
    const autoColor = box?.dataset?.autoColor || box?.dataset?.color || '';
    return {
      autoColor,
      mode: box?.dataset?.colorMode || 'auto',
      value: box?.dataset?.colorValue || '',
      preset: box?.dataset?.colorPreset || ''
    };
  }

  function serializeChunkBox(box) {
    const titleInput = box.querySelector('.box-title');
    const input = box.querySelector('.chunk-input');
    const limitInput = box.querySelector('.length-input');
    const delimiter = getDelimiterConfig(box);
    const colorState = getBoxColorState(box);
    const orderMode = readChunkOrderMode(box);
    return {
      type: 'chunk',
      id: box.dataset.boxId,
      title: titleInput?.value || 'String',
      text: input?.value || '',
      limit: readNumber(limitInput, 1000),
      lengthMode: readChunkLengthMode(box),
      exact: readExactMode(box),
      singlePass: readSinglePassMode(box),
      firstChunkBehavior: readFirstChunkBehavior(box),
      color: colorState.autoColor,
      colorMode: colorState.mode,
      colorValue: colorState.value,
      colorPreset: colorState.preset,
      orderMode,
      randomize: orderMode === ORDER_MODES.FULL,
      delimiter: {
        mode: delimiter.mode,
        custom: box.querySelector('.delimiter-custom')?.value || '',
        size: delimiter.size
      }
    };
  }

  function serializeVariableBox(box) {
    const select = box.querySelector('.variable-select');
    return {
      type: 'variable',
      id: box.dataset.boxId,
      targetId: select?.value || box.dataset.targetId || ''
    };
  }

  function serializeMixBox(box) {
    const titleInput = box.querySelector('.box-title');
    const limitInput = box.querySelector('.length-input');
    const delimiter = getDelimiterConfig(box);
    const sizeSelect = box.querySelector('.delimiter-size');
    const singlePass = readSinglePassMode(box);
    const preserve = sizeSelect?.value === 'preserve';
    const colorState = getBoxColorState(box);
    const orderMode = readMixOrderMode(box);
    const childContainer = box.querySelector('.mix-children');
    const children = childContainer
      ? Array.from(childContainer.children)
          .map(child => child.querySelector('.mix-box, .chunk-box, .variable-box'))
          .filter(Boolean)
          .map(child =>
            child.classList.contains('mix-box')
              ? serializeMixBox(child)
              : child.classList.contains('variable-box')
              ? serializeVariableBox(child)
              : serializeChunkBox(child)
          )
      : [];
    return {
      type: 'mix',
      id: box.dataset.boxId,
      title: titleInput?.value || 'Mix',
      limit: readNumber(limitInput, 1000),
      lengthMode: readMixLengthMode(box),
      exact: readExactMode(box),
      singlePass,
      ...(singlePass ? { singlePassMode: readSinglePassFitMode(box) } : {}),
      firstChunkBehavior: readFirstChunkBehavior(box),
      color: colorState.autoColor,
      colorMode: colorState.mode,
      colorValue: colorState.value,
      colorPreset: colorState.preset,
      preserve,
      orderMode,
      randomize: orderMode === ORDER_MODES.INTERLEAVE,
      delimiter: {
        mode: delimiter.mode,
        custom: box.querySelector('.delimiter-custom')?.value || '',
        size: delimiter.size
      },
      children
    };
  }

  function exportMixState(rootEl) {
    const root = rootEl || document.querySelector('.mix-root');
    if (!root) return { mixes: [] };
    // Keep the "mixes" key for compatibility, but include root-level strings too.
    const mixes = Array.from(root.children)
      .map(child => child.querySelector('.mix-box, .chunk-box'))
      .filter(Boolean)
      .map(box => (box.classList.contains('mix-box') ? serializeMixBox(box) : serializeChunkBox(box)));
    return {
      mixes,
      colorPresets: exportColorPresets()
    };
  }

  function applyMixState(state, rootEl) {
    const root = rootEl || document.querySelector('.mix-root');
    if (!root) return;
    root.innerHTML = '';
    loadColorPresets(state);
    const mixes = Array.isArray(state?.mixes) && state.mixes.length
      ? state.mixes
      : [
          { type: 'mix', title: 'Mix', children: [] }
        ];
    let prevMixColor = null;
    let prevChunkColor = null;
    mixes.forEach(cfg => {
      if (cfg?.type === 'chunk') {
        const wrapper = createChunkWrapper(cfg, { previousColor: prevChunkColor });
        root.appendChild(wrapper);
        prevChunkColor = wrapper.querySelector('.chunk-box')?.dataset.color || prevChunkColor;
        return;
      }
      const wrapper = createMixWrapper(cfg, { previousColor: prevMixColor });
      root.appendChild(wrapper);
      prevMixColor = wrapper.querySelector('.mix-box')?.dataset.color || prevMixColor;
    });
    updateEmptyState(root);

    setupDelimiterControls(root);
    setupSizeControls(root);
    syncCollapseButtons(root);
    root.querySelectorAll('.mix-box').forEach(updatePreserveMode);
    root.querySelectorAll('.mix-box, .chunk-box').forEach(updateLengthModeState);
    root.querySelectorAll('.chunk-box').forEach(updateEmptyChunkMode);
    refreshColorPresetSelects(root);
    syncTextareaHeights(root);
    refreshVariableOptions(root);
  }

  // ======== UI Helpers ========

  function setupTabs() {
    const buttons = Array.from(document.querySelectorAll('.tab-button'));
    const panels = Array.from(document.querySelectorAll('.tab-panel'));
    if (!buttons.length || !panels.length) return;

    const setActive = targetId => {
      buttons.forEach(btn => {
        const isActive = btn.dataset.tabTarget === targetId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      panels.forEach(panel => {
        const isActive = panel.id === targetId;
        panel.classList.toggle('active', isActive);
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });
    };

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tabTarget;
        if (target) setActive(target);
      });
    });

    const initial = buttons.find(btn => btn.classList.contains('active'))?.dataset.tabTarget;
    if (initial) setActive(initial);
  }

  function setupDelimiterControls(root) {
    const scope = root || document;
    scope.querySelectorAll('.delimiter-select').forEach(select => {
      let customRow = null;
      if (select.nextElementSibling?.classList?.contains('delimiter-custom-row')) {
        customRow = select.nextElementSibling;
      } else {
        const parent = select.parentElement;
        if (parent) {
          customRow = parent.querySelector(':scope > .delimiter-custom-row');
        }
      }
      const customInput = customRow?.querySelector('.delimiter-custom');
      const toggle = () => {
        if (!customRow) return;
        const isCustom = isCustomDelimiterMode(select.value);
        customRow.style.display = isCustom ? 'block' : 'none';
        if (!isCustom && customInput) customInput.value = '';
      };
      if (!select.dataset.delimiterInit) {
        select.addEventListener('change', toggle);
        select.dataset.delimiterInit = 'true';
      }
      toggle();
    });
  }

  // Blank strings emit a single empty chunk; while blank, lock chunking controls.
  function updateEmptyChunkMode(boxEl) {
    if (!boxEl?.classList?.contains('chunk-box')) return;
    const input = boxEl.querySelector('.chunk-input');
    const delimiterSelect = boxEl.querySelector('.delimiter-select');
    if (!delimiterSelect) return;
    const delimiterBlock = delimiterSelect.closest('.control-block');
    const customRow = boxEl.querySelector('.delimiter-custom-row');
    const customInput = boxEl.querySelector('.delimiter-custom');
    const sizeSelect = boxEl.querySelector('.delimiter-size');
    const sizeBlock = sizeSelect?.closest('.control-block');
    const sizeCustomRow = boxEl.querySelector('.delimiter-size-custom-row');
    const sizeCustomInput = boxEl.querySelector('.delimiter-size-custom');
    const firstChunkSelect = boxEl.querySelector('.first-chunk-select');
    const firstChunkBlock = firstChunkSelect?.closest('.control-block');
    const isEmpty = (input?.value || '') === '';

    if (isEmpty) {
      let emptyOption = delimiterSelect.querySelector(`option[value="${EMPTY_CHUNK_DELIMITER_MODE}"]`);
      if (!emptyOption) {
        emptyOption = document.createElement('option');
        emptyOption.value = EMPTY_CHUNK_DELIMITER_MODE;
        emptyOption.textContent = 'Empty chunk';
        delimiterSelect.insertBefore(emptyOption, delimiterSelect.firstChild);
      }
      if (delimiterSelect.value !== EMPTY_CHUNK_DELIMITER_MODE) {
        delimiterSelect.dataset.prevValue = delimiterSelect.value;
      }
      delimiterSelect.value = EMPTY_CHUNK_DELIMITER_MODE;
      delimiterSelect.disabled = true;
      if (customInput) customInput.disabled = true;
      if (customRow) customRow.style.display = 'none';
      if (sizeSelect) sizeSelect.disabled = true;
      if (sizeCustomInput) sizeCustomInput.disabled = true;
      if (sizeCustomRow) sizeCustomRow.style.display = 'none';
      if (firstChunkSelect) {
        firstChunkSelect.disabled = true;
        firstChunkSelect.setAttribute('aria-disabled', 'true');
      }
      if (delimiterBlock) delimiterBlock.classList.add('is-disabled');
      if (sizeBlock) sizeBlock.classList.add('is-disabled');
      if (firstChunkBlock) firstChunkBlock.classList.add('is-disabled');
      return;
    }

    delimiterSelect.disabled = false;
    const prevValue = delimiterSelect.dataset.prevValue;
    if (prevValue) {
      delimiterSelect.value = prevValue;
      delete delimiterSelect.dataset.prevValue;
    } else if (delimiterSelect.value === EMPTY_CHUNK_DELIMITER_MODE) {
      delimiterSelect.value = 'whitespace';
    }
    const emptyOption = delimiterSelect.querySelector(`option[value="${EMPTY_CHUNK_DELIMITER_MODE}"]`);
    if (emptyOption) emptyOption.remove();
    if (customInput) customInput.disabled = false;
    if (sizeSelect) sizeSelect.disabled = false;
    if (sizeCustomInput) sizeCustomInput.disabled = false;
    if (firstChunkSelect) {
      firstChunkSelect.disabled = false;
      firstChunkSelect.setAttribute('aria-disabled', 'false');
    }
    if (delimiterBlock) delimiterBlock.classList.remove('is-disabled');
    if (sizeBlock) sizeBlock.classList.remove('is-disabled');
    if (firstChunkBlock) firstChunkBlock.classList.remove('is-disabled');
    setupDelimiterControls(boxEl);
    setupSizeControls(boxEl);
    updateFirstChunkBehaviorLabels(boxEl);
  }

  function getDisabledReason(helpEl) {
    const block = helpEl?.closest?.('.control-block, .input-row');
    if (!block) return '';
    const disabledInput = block.querySelector('input:disabled, select:disabled, textarea:disabled');
    if (!disabledInput) return '';
    const box = helpEl.closest('.mix-box, .chunk-box');
    if (box?.classList?.contains('chunk-box')) {
      const chunkInput = box.querySelector('.chunk-input');
      if ((chunkInput?.value || '') === '' && block.querySelector('.delimiter-select, .delimiter-custom, .delimiter-size, .delimiter-size-custom, .first-chunk-select')) {
        return 'Disabled because blank strings emit one empty chunk and skip rechunk settings.';
      }
    }
    if (block.querySelector('.length-input') && readSinglePassMode(box)) {
      return 'Disabled because Exactly Once outputs each chunk one time and ignores length limits.';
    }
    if (block.querySelector('.delimiter-select, .delimiter-custom, .delimiter-size, .delimiter-size-custom, .first-chunk-select')) {
      const sizeSelect = box?.querySelector('.delimiter-size');
      if (sizeSelect?.value === 'preserve') {
        return 'Disabled because Preserve chunks skips rechunking at this level.';
      }
    }
    return 'Disabled because of the current settings.';
  }

  function resolveHelpContent(target, scope) {
    if (!target) return null;
    let helpEl = target.closest('[data-help], [data-help-detail], [data-help-key]');
    if (!helpEl) {
      const container = target.closest('.control-block, .input-row, .mix-output, .chunk-output');
      if (container) {
        helpEl = container.querySelector('[data-help], [data-help-detail], [data-help-key]');
      }
    }
    if (!helpEl || (scope && !scope.contains(helpEl))) return null;
    const shortText =
      (helpEl.dataset.help || '').trim() ||
      (helpEl.getAttribute('aria-label') || '').trim() ||
      (helpEl.getAttribute('title') || '').trim() ||
      (helpEl.textContent || '').trim();
    const detailText = (helpEl.dataset.helpDetail || '').trim();
    const fallbackDetail = detailText || (shortText ? `${shortText} (More detail coming soon.)` : 'No extra help is available yet.');
    const disabledReason = getDisabledReason(helpEl);
    const detail = disabledReason
      ? detailText
        ? `${detailText} ${disabledReason}`
        : disabledReason
      : fallbackDetail;
    return {
      short: shortText || 'Help',
      detail,
      element: helpEl
    };
  }

  function getHelpPopover(win) {
    if (!win) return null;
    let popover = win.querySelector('.help-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.className = 'help-popover is-hidden';
      popover.setAttribute('role', 'dialog');
      popover.setAttribute('aria-hidden', 'true');
      popover.setAttribute('aria-live', 'polite');
      popover.innerHTML = `
        <div class="help-popover-header">
          <span class="help-popover-title">Help</span>
          <button type="button" class="help-close" aria-label="Close help">×</button>
        </div>
        <div class="help-popover-short"></div>
        <div class="help-popover-detail"></div>
      `;
      win.appendChild(popover);
    }
    return popover;
  }

  function positionHelpPopover(popover, win, clientX, clientY) {
    if (!popover || !win) return;
    const rect = win.getBoundingClientRect();
    let x = clientX - rect.left + 12;
    let y = clientY - rect.top + 12;
    popover.style.left = `${x}px`;
    popover.style.top = `${y}px`;
    const popWidth = popover.offsetWidth;
    const popHeight = popover.offsetHeight;
    const maxX = rect.width - popWidth - 12;
    const maxY = rect.height - popHeight - 12;
    x = Math.max(12, Math.min(x, maxX));
    y = Math.max(12, Math.min(y, maxY));
    popover.style.left = `${x}px`;
    popover.style.top = `${y}px`;
  }

  function setupHelpMode(win) {
    if (!win || win.dataset.helpReady) return;
    const helpBtn = win.querySelector('.help-toggle');
    if (!helpBtn) return;
    win.dataset.helpReady = 'true';
    const popover = getHelpPopover(win);
    const overlay = win.querySelector('.help-overlay');
    const shortEl = popover?.querySelector('.help-popover-short');
    const detailEl = popover?.querySelector('.help-popover-detail');
    const closeBtn = popover?.querySelector('.help-close');

    const setHelpActive = active => {
      win.classList.toggle('help-active', active);
      helpBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (overlay) {
        overlay.classList.toggle('is-hidden', !active);
        overlay.setAttribute('aria-hidden', active ? 'false' : 'true');
      }
      if (!active && popover) {
        popover.classList.add('is-hidden');
        popover.setAttribute('aria-hidden', 'true');
      }
    };

    const showHelp = (target, event) => {
      if (!popover) return;
      const info = resolveHelpContent(target, win);
      if (!info) return;
      if (shortEl) shortEl.textContent = info.short;
      if (detailEl) detailEl.textContent = info.detail;
      popover.classList.remove('is-hidden');
      popover.setAttribute('aria-hidden', 'false');
      positionHelpPopover(popover, win, event.clientX, event.clientY);
    };

    helpBtn.addEventListener('click', event => {
      event.stopPropagation();
      setHelpActive(!win.classList.contains('help-active'));
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', event => {
        event.stopPropagation();
        if (popover) {
          popover.classList.add('is-hidden');
          popover.setAttribute('aria-hidden', 'true');
        }
      });
    }

    if (overlay && !overlay.dataset.bound) {
      const pickTarget = event => {
        overlay.style.pointerEvents = 'none';
        const target = document.elementFromPoint(event.clientX, event.clientY);
        overlay.style.pointerEvents = '';
        return target;
      };

      overlay.addEventListener('pointerdown', event => {
        if (!win.classList.contains('help-active')) return;
        event.preventDefault();
        event.stopPropagation();
      });

      overlay.addEventListener('click', event => {
        if (!win.classList.contains('help-active')) return;
        event.preventDefault();
        event.stopPropagation();
        const target = pickTarget(event);
        if (!target || target.closest('.help-toggle, .help-popover, .window-header')) return;
        showHelp(target, event);
      });
      overlay.dataset.bound = 'true';
    }

    win.addEventListener(
      'keydown',
      event => {
        if (!win.classList.contains('help-active')) return;
        if (event.key === 'Escape') {
          setHelpActive(false);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );
  }

  function updateFirstChunkBehaviorLabels(boxEl) {
    if (!boxEl) return;
    const select = boxEl.querySelector('.first-chunk-select');
    if (!select) return;
    const size = readChunkSize(boxEl);
    const sizeOption = select.querySelector(`option[value="${FIRST_CHUNK_BEHAVIORS.SIZE}"]`);
    const betweenOption = select.querySelector(`option[value="${FIRST_CHUNK_BEHAVIORS.BETWEEN}"]`);
    const randomStartOption = select.querySelector(`option[value="${FIRST_CHUNK_BEHAVIORS.RANDOM_START}"]`);
    if (sizeOption) sizeOption.textContent = `Size ${size}`;
    if (betweenOption) betweenOption.textContent = `Between 1 - ${size}`;
    if (randomStartOption) randomStartOption.textContent = `Size ${size}, random start location`;
  }

  function setupSizeControls(root) {
    const scope = root || document;
    scope.querySelectorAll('.delimiter-size').forEach(select => {
      let customRow = null;
      if (select.nextElementSibling?.classList?.contains('delimiter-size-custom-row')) {
        customRow = select.nextElementSibling;
      } else {
        const parent = select.parentElement;
        if (parent) {
          customRow = parent.querySelector(':scope > .delimiter-size-custom-row');
        }
      }
      const customInput = customRow?.querySelector('.delimiter-size-custom');
      const toggle = () => {
        if (!customRow) return;
        const isCustom = select.value === 'custom';
        customRow.style.display = isCustom ? 'block' : 'none';
        if (!isCustom && customInput) customInput.value = '';
      };
      if (!select.dataset.sizeInit) {
        select.addEventListener('change', toggle);
        select.dataset.sizeInit = 'true';
      }
      toggle();
    });
  }

  function updatePreserveMode(boxEl) {
    if (!boxEl) return;
    const sizeSelect = boxEl.querySelector('.delimiter-size');
    if (!sizeSelect) return;
    const preserve = sizeSelect.value === 'preserve';
    const delimiterSelect = boxEl.querySelector('.delimiter-select');
    const customRow = boxEl.querySelector('.delimiter-custom-row');
    const customInput = boxEl.querySelector('.delimiter-custom');
    const delimiterBlock = delimiterSelect?.closest('.control-block') || delimiterSelect?.parentElement;
    const firstChunkSelect = boxEl.querySelector('.first-chunk-select');
    const firstChunkBlock = firstChunkSelect?.closest('.control-block');
    const sizeCustomRow = boxEl.querySelector('.delimiter-size-custom-row');
    const sizeCustomInput = boxEl.querySelector('.delimiter-size-custom');

    if (delimiterSelect) delimiterSelect.disabled = preserve;
    if (customInput) customInput.disabled = preserve;
    if (customRow) {
      if (preserve) {
        customRow.style.display = 'none';
      } else {
        customRow.style.display = '';
      }
    }
    if (delimiterBlock) delimiterBlock.classList.toggle('is-disabled', preserve);
    if (sizeCustomInput) sizeCustomInput.disabled = preserve;
    if (sizeCustomRow && preserve) {
      sizeCustomRow.style.display = 'none';
    }
    if (firstChunkSelect) {
      // Preserve chunks skips rechunking, so lock the first-chunk behavior to size.
      if (preserve) {
        if (!firstChunkSelect.dataset.prevValue) {
          firstChunkSelect.dataset.prevValue = firstChunkSelect.value;
        }
        firstChunkSelect.value = FIRST_CHUNK_BEHAVIORS.SIZE;
        firstChunkSelect.disabled = true;
        firstChunkSelect.setAttribute('aria-disabled', 'true');
      } else {
        firstChunkSelect.disabled = false;
        firstChunkSelect.setAttribute('aria-disabled', 'false');
        if (firstChunkSelect.dataset.prevValue) {
          firstChunkSelect.value = firstChunkSelect.dataset.prevValue;
          delete firstChunkSelect.dataset.prevValue;
        }
      }
    }
    if (firstChunkBlock) firstChunkBlock.classList.toggle('is-disabled', preserve);
    if (!preserve) {
      setupDelimiterControls(boxEl);
      setupSizeControls(boxEl);
    }
    updateFirstChunkBehaviorLabels(boxEl);
  }

  // Length mode drives whether the length input is active (single-pass fit modes disable it).
  function updateLengthModeState(boxEl) {
    if (!boxEl) return;
    const lengthInput = boxEl.querySelector('.length-input');
    const lengthBlock = lengthInput?.closest('.control-block');
    const singlePass = readSinglePassMode(boxEl);
    if (lengthInput) lengthInput.disabled = singlePass;
    if (lengthBlock) lengthBlock.classList.toggle('is-disabled', singlePass);
  }

  function setCollapseButton(btn, collapsed) {
    if (!btn) return;
    const expandedIcon = btn.dataset.expanded || '-';
    const collapsedIcon = btn.dataset.collapsed || '+';
    btn.textContent = collapsed ? collapsedIcon : expandedIcon;
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  function syncCollapseButtons(scope) {
    const root = scope || document;
    root.querySelectorAll('.collapse-toggle').forEach(btn => {
      const box = btn.closest('.box-shell');
      const collapsed = box?.classList.contains('is-collapsed');
      setCollapseButton(btn, collapsed);
    });
  }

  // Empty state hides once any top-level mix or string exists.
  function updateEmptyState(rootEl) {
    const root = rootEl || document.querySelector('.mix-root');
    if (!root) return;
    const windowEl = root.closest('.app-window') || document;
    const emptyState = windowEl.querySelector('.empty-state');
    if (!emptyState) return;
    const hasBoxes = Array.from(root.children).some(child =>
      child.classList.contains('mix-wrapper') || child.classList.contains('chunk-wrapper')
    );
    emptyState.style.display = hasBoxes ? 'none' : 'flex';
  }

  // Walk backward to find the most recent box color for a given selector.
  function findPreviousBoxColor(root, selector) {
    if (!root) return null;
    const children = Array.from(root.children).reverse();
    for (const child of children) {
      const box = child.querySelector?.(selector);
      if (box?.dataset?.color) return box.dataset.color;
    }
    return null;
  }

  // Root-level add helpers keep empty-state + toolbar buttons consistent.
  function appendRootMix(root) {
    if (!root) return;
    const prevColor = findPreviousBoxColor(root, '.mix-box');
    root.appendChild(createMixWrapper({ title: 'Mix' }, { previousColor: prevColor }));
  }

  function appendRootChunk(root) {
    if (!root) return;
    // Strings use their own palette, so track the most recent chunk color separately.
    const prevColor = findPreviousBoxColor(root, '.chunk-box');
    root.appendChild(createChunkWrapper({ title: 'String' }, { previousColor: prevColor }));
  }

  // Copy helper shared by mix output + string input buttons.
  function copyTextWithFeedback(text, btn) {
    if (!btn) return;
    const signalCopied = () => {
      btn.classList.add('copied');
      const previousTitle = btn.title;
      const previousLabel = btn.dataset.originalLabel || btn.textContent;
      btn.dataset.originalLabel = previousLabel;
      btn.title = 'Copied!';
      btn.textContent = '✓';
      clearTimeout(btn._copyTimeout);
      btn._copyTimeout = setTimeout(() => {
        btn.classList.remove('copied');
        btn.title = previousTitle;
        btn.textContent = previousLabel;
      }, 900);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(signalCopied).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        signalCopied();
      } catch (err) {
        /* ignore */
      }
      ta.remove();
    }
  }

  function toggleButton(btn) {
    if (!btn) return;
    if (btn.disabled || btn.classList.contains('disabled') || btn.getAttribute('aria-disabled') === 'true') return;
    btn.classList.toggle('active');
    if (btn.dataset.on && btn.dataset.off) {
      btn.textContent = btn.classList.contains('active') ? btn.dataset.on : btn.dataset.off;
    }
  }

  function setupMixEvents(root) {
    if (!root || root.dataset.eventsReady) return;
    root.dataset.eventsReady = 'true';
    syncTextareaHeights(root);
    root.addEventListener('click', event => {
      const btn = event.target.closest('button');
      if (!btn) return;

      if (btn.classList.contains('add-chunk-child')) {
        const mixBox = btn.closest('.mix-box');
        const childContainer = mixBox?.querySelector('.mix-children');
        if (childContainer) {
          const prevChild = childContainer.lastElementChild;
          const prevColor = prevChild?.querySelector('.mix-box, .chunk-box')?.dataset.color || null;
          childContainer.appendChild(
            createChunkWrapper({}, { parentColor: mixBox?.dataset.color, previousColor: prevColor })
          );
        }
        setupDelimiterControls(mixBox || document);
        setupSizeControls(mixBox || document);
        syncCollapseButtons(mixBox || document);
        syncTextareaHeights(mixBox || document);
        refreshColorPresetSelects(mixBox || document);
        refreshVariableOptions(mixBox || document);
        return;
      }

      if (btn.classList.contains('add-mix-child')) {
        const mixBox = btn.closest('.mix-box');
        const childContainer = mixBox?.querySelector('.mix-children');
        if (childContainer) {
          const prevChild = childContainer.lastElementChild;
          const prevColor = prevChild?.querySelector('.mix-box, .chunk-box')?.dataset.color || null;
          childContainer.appendChild(
            createMixWrapper({ title: 'Mix' }, { parentColor: mixBox?.dataset.color, previousColor: prevColor })
          );
        }
        setupDelimiterControls(mixBox || document);
        setupSizeControls(mixBox || document);
        syncCollapseButtons(mixBox || document);
        updatePreserveMode(mixBox || document);
        refreshColorPresetSelects(mixBox || document);
        refreshVariableOptions(mixBox || document);
        return;
      }

      if (btn.classList.contains('add-variable-child')) {
        const mixBox = btn.closest('.mix-box');
        const childContainer = mixBox?.querySelector('.mix-children');
        if (childContainer) childContainer.appendChild(createVariableWrapper());
        syncCollapseButtons(mixBox || document);
        refreshColorPresetSelects(mixBox || document);
        refreshVariableOptions(mixBox || document);
        return;
      }

      if (btn.classList.contains('remove-box')) {
        // Resolve the wrapper from the nearest prompt box first so nested variable deletes
        // cannot climb to an ancestor mix wrapper.
        const box = btn.closest('.variable-box, .chunk-box, .mix-box');
        const wrapper = box?.closest('.variable-wrapper, .chunk-wrapper, .mix-wrapper');
        if (!wrapper) return;
        wrapper.remove();
        updateEmptyState(root);
        refreshVariableOptions(root);
        return;
      }

      if (btn.classList.contains('collapse-toggle')) {
        const box = btn.closest('.box-shell');
        if (box) {
          const collapsed = box.classList.toggle('is-collapsed');
          setCollapseButton(btn, collapsed);
        }
        return;
      }

      if (btn.classList.contains('color-toggle')) {
        const box = btn.closest('.mix-box, .chunk-box');
        const panel = box?.querySelector('.color-controls');
        if (!panel) return;
        const isHidden = panel.classList.toggle('is-hidden');
        btn.classList.toggle('active', !isHidden);
        return;
      }

      if (btn.classList.contains('copy-output')) {
        const box = btn.closest('.mix-box');
        const output = box?.querySelector('.mix-output-text');
        if (!output) return;
        const text = output.textContent || '';
        copyTextWithFeedback(text, btn);
        return;
      }

      if (btn.classList.contains('copy-input')) {
        const box = btn.closest('.chunk-box');
        if (!box) return;
        // Refresh output so randomization + limits are reflected before copying.
        evaluateChunkBox(box);
        const output = box.querySelector('.chunk-output-text');
        const fallback = box.querySelector('.chunk-input');
        const text = output?.textContent || fallback?.value || '';
        copyTextWithFeedback(text, btn);
        return;
      }

      if (btn.classList.contains('save-color-preset')) {
        const box = btn.closest('.mix-box, .chunk-box');
        if (!box) return;
        const nameInput = box.querySelector('.color-preset-name');
        const colorInput = box.querySelector('.color-custom-input');
        const preset = upsertCustomPreset(nameInput?.value || '', colorInput?.value || '');
        if (!preset) return;
        if (nameInput) nameInput.value = '';
        refreshColorPresetSelects(root);
        setBoxColorMode(box, 'preset', preset.id);
        syncColorControls(box);
        return;
      }

      if (btn.classList.contains('toggle-button')) {
        toggleButton(btn);
      }
    });

    root.addEventListener('input', event => {
      const textarea = event.target.closest('.chunk-input');
      if (!textarea) return;
      autoResizeTextarea(textarea);
      const box = textarea.closest('.chunk-box');
      if (box) updateEmptyChunkMode(box);
    });

    root.addEventListener('input', event => {
      const titleInput = event.target.closest('.mix-box .box-title, .chunk-box .box-title');
      if (!titleInput) return;
      refreshVariableOptions(root);
    });

    root.addEventListener('change', event => {
      const select = event.target.closest('.delimiter-size');
      if (!select) return;
      const chunkBox = select.closest('.chunk-box');
      if (chunkBox) {
        updateFirstChunkBehaviorLabels(chunkBox);
        return;
      }
      const mixBox = select.closest('.mix-box');
      if (mixBox) {
        updatePreserveMode(mixBox);
      }
    });

    root.addEventListener('change', event => {
      const select = event.target.closest('.length-mode');
      if (!select) return;
      const box = select.closest('.mix-box, .chunk-box');
      if (box) updateLengthModeState(box);
    });

    root.addEventListener('change', event => {
      const select = event.target.closest('.color-preset-select');
      if (!select) return;
      const box = select.closest('.mix-box, .chunk-box');
      if (!box) return;
      if (select.value === 'auto') {
        setBoxColorMode(box, 'auto');
      } else if (select.value === 'custom') {
        const colorInput = box.querySelector('.color-custom-input');
        setBoxColorMode(box, 'custom', colorInput?.value || getAutoColorHex(box));
      } else {
        setBoxColorMode(box, 'preset', select.value);
      }
      syncColorControls(box);
    });

    root.addEventListener('change', event => {
      const variableSelect = event.target.closest('.variable-select');
      if (!variableSelect) return;
      const box = variableSelect.closest('.variable-box');
      if (box) {
        box.dataset.targetId = variableSelect.value || '';
        refreshVariableOptions(root);
      }
    });

    root.addEventListener('input', event => {
      const colorInput = event.target.closest('.color-custom-input');
      if (!colorInput) return;
      const box = colorInput.closest('.mix-box, .chunk-box');
      if (!box) return;
      setBoxColorMode(box, 'custom', colorInput.value);
      const select = box.querySelector('.color-preset-select');
      if (select) select.value = 'custom';
      syncColorControls(box);
    });

    root.addEventListener('input', event => {
      const sizeInput = event.target.closest('.delimiter-size-custom');
      if (!sizeInput) return;
      const box = sizeInput.closest('.mix-box, .chunk-box');
      if (box) updateFirstChunkBehaviorLabels(box);
    });
  }

  function setupUIEvents() {
    document.querySelectorAll('.mix-root').forEach(root => {
      if (root.closest('.window-template')) return;
      setupMixEvents(root);
    });
  }

  function setupPromptControls(windowEl) {
    const scope = windowEl || document;
    if (scope.closest?.('.window-template')) return;
    const win = scope.closest?.('.app-window') || (scope.classList?.contains?.('app-window') ? scope : null);
    const windowTitle = win?.querySelector('.window-header .box-title') || null;
    if (win && !win.dataset.defaultTitle && windowTitle) {
      win.dataset.defaultTitle = windowTitle.textContent || 'Prompt Enhancer';
    }
    const getFileName = () => (win?.dataset.fileName || '');
    const setFileName = fileName => {
      if (!win || !windowTitle) return;
      const normalized = normalizeFileName(fileName);
      if (normalized) {
        win.dataset.fileName = normalized;
        windowTitle.textContent = stripJsonExtension(normalized) || normalized;
      } else {
        delete win.dataset.fileName;
        windowTitle.textContent = win.dataset.defaultTitle || 'Prompt Enhancer';
      }
    };
    const generateBtn = scope.querySelector('.generate-button');
    if (generateBtn && !generateBtn.dataset.bound) {
      generateBtn.addEventListener('click', () => {
        const root = scope.querySelector('.mix-root');
        if (root) generate(root);
      });
      generateBtn.dataset.bound = 'true';
    }
    const finalizeRootAdd = root => {
      // After any root-level add, refresh controls + empty-state visibility.
      setupDelimiterControls(scope);
      setupSizeControls(scope);
      syncCollapseButtons(scope);
      updateEmptyState(root);
      refreshColorPresetSelects(scope);
      refreshVariableOptions(scope);
    };
    const addEmpty = scope.querySelector('.add-empty-mix');
    if (addEmpty && !addEmpty.dataset.bound) {
      addEmpty.addEventListener('click', () => {
        const root = scope.querySelector('.mix-root');
        if (root) {
          appendRootMix(root);
          finalizeRootAdd(root);
        }
      });
      addEmpty.dataset.bound = 'true';
    }

    const addRoot = scope.querySelector('.add-root-mix');
    if (addRoot && !addRoot.dataset.bound) {
      addRoot.addEventListener('click', () => {
        const root = scope.querySelector('.mix-root');
        if (root) {
          appendRootMix(root);
          finalizeRootAdd(root);
        }
      });
      addRoot.dataset.bound = 'true';
    }

    const addEmptyChunk = scope.querySelector('.add-empty-chunk');
    if (addEmptyChunk && !addEmptyChunk.dataset.bound) {
      addEmptyChunk.addEventListener('click', () => {
        const root = scope.querySelector('.mix-root');
        if (root) {
          appendRootChunk(root);
          finalizeRootAdd(root);
        }
      });
      addEmptyChunk.dataset.bound = 'true';
    }

    const addRootChunk = scope.querySelector('.add-root-chunk');
    if (addRootChunk && !addRootChunk.dataset.bound) {
      addRootChunk.addEventListener('click', () => {
        const root = scope.querySelector('.mix-root');
        if (root) {
          appendRootChunk(root);
          finalizeRootAdd(root);
        }
      });
      addRootChunk.dataset.bound = 'true';
    }

    const loadInput = scope.querySelector('.load-mix-file');
    // File naming is per-window: Save reuses the stored name; Save As prompts and updates the title.
    const downloadMix = fileName => {
      const root = scope.querySelector('.mix-root');
      if (!root) return;
      const data = exportMixState(root);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    };

    const promptForFileName = () => {
      if (typeof window === 'undefined' || typeof window.prompt !== 'function') return '';
      const currentName = getFileName();
      const suggestion = stripJsonExtension(currentName) || 'prompt-enhancer-mix';
      const response = window.prompt('Save as...', suggestion);
      return normalizeFileName(response);
    };

    const saveMixAs = () => {
      const nextName = promptForFileName();
      if (!nextName) return;
      const canonicalName = ensureJsonExtension(nextName);
      setFileName(canonicalName);
      downloadMix(canonicalName);
    };

    const saveMix = () => {
      const currentName = getFileName();
      if (!currentName) {
        saveMixAs();
        return;
      }
      downloadMix(currentName);
    };

    const loadMix = file => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        let data = null;
        try {
          data = JSON.parse(reader.result);
        } catch (err) {
          return;
        }
        const root = scope.querySelector('.mix-root');
        if (!root) return;
        applyMixState(data, root);
        if (file?.name) setFileName(file.name);
      };
      reader.readAsText(file);
    };

    const presetItem = scope.querySelector('.prompt-menu-item[data-action="load-preset"]');
    const presetSubmenu = scope.querySelector('.prompt-menu-submenu');
    let presetRequestToken = 0;
    let currentPresetEntries = [];

    const renderPresetStatus = label => {
      if (!presetSubmenu) return;
      presetSubmenu.innerHTML = '';
      currentPresetEntries = [];
      const row = document.createElement('div');
      row.className = 'prompt-menu-subitem disabled';
      row.textContent = label;
      presetSubmenu.appendChild(row);
    };

    const renderPresetEntries = entries => {
      if (!presetSubmenu) return;
      presetSubmenu.innerHTML = '';
      currentPresetEntries = Array.isArray(entries) ? entries.slice() : [];
      if (!entries.length) {
        renderPresetStatus('No presets in catalog');
        return;
      }
      entries.forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'prompt-menu-subitem';
        row.dataset.action = 'load-preset-file';
        row.dataset.presetIndex = String(index);
        row.dataset.presetFile = entry.file;
        row.textContent = entry.label;
        presetSubmenu.appendChild(row);
      });
    };

    const refreshPresetEntries = async () => {
      if (!presetSubmenu) return;
      renderPresetStatus('Loading presets...');
      const token = ++presetRequestToken;
      try {
        const entries = readPresetCatalogEntries();
        if (token !== presetRequestToken) return;
        if (!entries.length) {
          renderPresetStatus('No presets in catalog');
          return;
        }
        renderPresetEntries(entries);
      } catch (err) {
        if (token !== presetRequestToken) return;
        renderPresetStatus('Preset catalog load failed');
      }
    };

    const loadPresetFromMenuItem = async item => {
      if (!item) return false;
      const presetIndex = parseInt(item.dataset.presetIndex || '', 10);
      const entry = Number.isFinite(presetIndex) ? currentPresetEntries[presetIndex] : null;
      if (!entry) return false;
      const root = scope.querySelector('.mix-root');
      if (!root) return false;
      const state = clonePresetState(entry.state);
      if (!state) {
        renderPresetStatus('Preset load failed (invalid catalog state)');
        return false;
      }
      applyMixState(state, root);
      if (entry.file) setFileName(ensureJsonExtension(entry.file));
      return true;
    };

    const menuToggle = scope.querySelector('.prompt-menu-start');
    const menuDropdown = scope.querySelector('.prompt-menu-dropdown');
    if (menuToggle && menuDropdown && !menuToggle.dataset.bound) {
      const closePresetMenu = () => {
        if (!presetItem || !presetSubmenu) return;
        presetItem.classList.remove('open');
        presetSubmenu.setAttribute('aria-hidden', 'true');
      };
      const openPresetMenu = () => {
        if (!presetItem || !presetSubmenu) return;
        presetItem.classList.add('open');
        presetSubmenu.setAttribute('aria-hidden', 'false');
      };
      const closeMenu = () => {
        closePresetMenu();
        menuDropdown.classList.remove('open');
        menuDropdown.setAttribute('aria-hidden', 'true');
        menuToggle.setAttribute('aria-expanded', 'false');
      };
      const openMenu = () => {
        menuDropdown.classList.add('open');
        menuDropdown.setAttribute('aria-hidden', 'false');
        menuToggle.setAttribute('aria-expanded', 'true');
      };
      menuToggle.addEventListener('click', event => {
        event.stopPropagation();
        if (menuDropdown.classList.contains('open')) {
          closeMenu();
        } else {
          openMenu();
        }
      });
      scope.addEventListener('click', event => {
        if (event.target.closest('.prompt-menu')) return;
        closeMenu();
      });
      // Prompt menu actions mirror visible items (open/load preset/save/save as).
      menuDropdown.addEventListener('click', async event => {
        const presetRow = event.target.closest('.prompt-menu-subitem[data-action="load-preset-file"]');
        if (presetRow) {
          const loaded = await loadPresetFromMenuItem(presetRow);
          if (loaded) closeMenu();
          return;
        }
        const item = event.target.closest('.prompt-menu-item');
        if (!item) return;
        const action = item.dataset.action;
        if (action === 'open') {
          // Open uses the hidden file input.
          loadInput?.click();
        } else if (action === 'load-preset') {
          const isOpen = item.classList.contains('open');
          if (isOpen) {
            closePresetMenu();
          } else {
            openPresetMenu();
            refreshPresetEntries();
          }
          return;
        } else if (action === 'save') {
          // Save exports the current mix state as JSON.
          saveMix();
        } else if (action === 'save-as') {
          // Save As always prompts for a new name.
          saveMixAs();
        }
        closeMenu();
      });
      menuToggle.dataset.bound = 'true';
    }

    if (loadInput && !loadInput.dataset.bound) {
      loadInput.addEventListener('change', event => {
        const file = event.target.files?.[0];
        loadMix(file);
        loadInput.value = '';
      });
      loadInput.dataset.bound = 'true';
    }

    setupHelpMode(win || scope);
  }

  const WINDOW_DEFS = {
    prompts: { templateId: 'window-prompts-template', label: 'Prompt Enhancer', icon: 'icon-prompts' },
    audio: { templateId: 'window-audio-template', label: 'Audio Interpolator', icon: 'icon-audio' },
    diskrot: { templateId: 'window-diskrot-template', label: '///diskrot', icon: 'icon-diskrot' },
    about: { templateId: 'window-about-template', label: 'About', icon: 'icon-about' }
  };

  const windowCounts = {
    prompts: 0,
    audio: 0,
    diskrot: 0,
    about: 0
  };

  let zCounter = 20;
  let currentFocusInstance = null;
  let taskbarAccentCounter = 0;
  const TASKBAR_ACCENTS = 10;

  function ensureTaskbarButton(instanceId, label, icon) {
    const bar = document.getElementById('taskbar');
    if (!bar) return null;
    let btn = bar.querySelector(`.taskbar-button[data-instance=\"${instanceId}\"]`);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'taskbar-button';
      btn.dataset.instance = instanceId;
      btn.dataset.accent = String((taskbarAccentCounter++ % TASKBAR_ACCENTS) + 1);
      btn.innerHTML = `<span class=\"task-icon ${icon}\"></span>`;
      btn.addEventListener('click', () => toggleWindow(instanceId));
      bar.appendChild(btn);
    }
    return btn;
  }

  function clearTaskbarActive() {
    const bar = document.getElementById('taskbar');
    if (!bar) return;
    bar.querySelectorAll('.taskbar-button').forEach(btn => btn.classList.remove('active'));
  }

  function getWindowByInstance(instanceId) {
    return document.querySelector(`.app-window[data-instance=\"${instanceId}\"]`);
  }

  function focusWindow(instanceId) {
    const win = getWindowByInstance(instanceId);
    if (!win) return;
    win.classList.remove('is-hidden');
    win.classList.remove('is-collapsed');
    applyMobileWindowState(win);
    zCounter += 1;
    win.style.zIndex = String(zCounter);
    currentFocusInstance = instanceId;
    const taskBtn = ensureTaskbarButton(instanceId, win.dataset.windowLabel, win.dataset.windowIcon);
    if (taskBtn) {
      clearTaskbarActive();
      taskBtn.classList.add('active');
    }
  }

  function toggleWindow(instanceId) {
    const win = getWindowByInstance(instanceId);
    if (!win) return;
    const isHidden = win.classList.contains('is-hidden');
    if (!isHidden && instanceId === currentFocusInstance) {
      win.classList.add('is-hidden');
      clearTaskbarActive();
      currentFocusInstance = null;
      return;
    }
    focusWindow(instanceId);
  }

  function getTopWindowByType(windowType) {
    const windows = Array.from(document.querySelectorAll(`.app-window[data-window=\"${windowType}\"]`))
      .filter(win => !win.classList.contains('window-template'));
    if (!windows.length) return null;
    let top = windows[0];
    let topZ = Number(top.style.zIndex || 0);
    windows.slice(1).forEach(win => {
      const z = Number(win.style.zIndex || 0);
      if (z >= topZ) {
        top = win;
        topZ = z;
      }
    });
    return top;
  }

  function getTopWindow() {
    const windows = Array.from(document.querySelectorAll('.app-window'))
      .filter(win => !win.classList.contains('window-template') && !win.classList.contains('is-hidden'));
    if (!windows.length) return null;
    let top = windows[0];
    let topZ = Number(top.style.zIndex || 0);
    windows.slice(1).forEach(win => {
      const z = Number(win.style.zIndex || 0);
      if (z >= topZ) {
        top = win;
        topZ = z;
      }
    });
    return top;
  }

  function positionNewWindow(win) {
    const area = document.getElementById('window-area');
    if (!area || !win) return;
    const bounds = area.getBoundingClientRect();
    const winRect = win.getBoundingClientRect();
    const computed = window.getComputedStyle(win);
    const winWidth = winRect.width || parseFloat(computed.width) || 480;
    const winHeight = winRect.height || parseFloat(computed.height) || 360;
    const offsetStep = 28;
    const windows = Array.from(document.querySelectorAll('.app-window'))
      .filter(el => !el.classList.contains('window-template'));
    const index = Math.max(0, windows.length - 1);
    const offset = (index % 6) * offsetStep;
    let x = 24 + offset;
    let y = 24 + offset;
    const maxX = Math.max(0, bounds.width - winWidth - 12);
    const maxY = Math.max(0, bounds.height - winHeight - 12);
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));
    win.style.left = `${x}px`;
    win.style.top = `${y}px`;
    win.style.right = 'auto';
    win.style.bottom = 'auto';
  }

  function openWindow(windowType) {
    const def = WINDOW_DEFS[windowType];
    if (!def) return;
    const template = document.getElementById(def.templateId);
    if (!template) return;
    windowCounts[windowType] = (windowCounts[windowType] || 0) + 1;
    const instanceId = `${windowType}-${windowCounts[windowType]}`;
    const clone = template.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.remove('window-template');
    clone.classList.add('app-window');
    clone.dataset.window = windowType;
    clone.dataset.instance = instanceId;
    clone.dataset.windowLabel = def.label + (windowCounts[windowType] > 1 ? ` ${windowCounts[windowType]}` : '');
    clone.dataset.windowIcon = def.icon;
    clone.style.display = '';
    clone.classList.remove('is-hidden');
    applyMobileWindowState(clone);
    clone.querySelectorAll('[data-bound]').forEach(el => el.removeAttribute('data-bound'));
    clone.querySelectorAll('[data-events-ready]').forEach(el => el.removeAttribute('data-events-ready'));
    const area = document.getElementById('window-area');
    if (!area) return;
    area.appendChild(clone);
    const computedHeight = window.getComputedStyle(clone).height;
    if (computedHeight && !clone.style.height) {
      clone.style.height = computedHeight;
    }
    const computedWidth = window.getComputedStyle(clone).width;
    if (computedWidth && !clone.style.width) {
      // Lock the initial width so long outputs do not auto-expand the window.
      clone.style.width = computedWidth;
    }
    positionNewWindow(clone);
    const schedule =
      (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
        ? window.requestAnimationFrame
        : fn => setTimeout(fn, 0);
    schedule(() => positionNewWindow(clone));
    if (windowType === 'prompts') {
      const root = clone.querySelector('.mix-root');
      if (root) applyMixState(null, root);
      setupMixEvents(root);
      setupPromptControls(clone);
    }
    syncCollapseButtons(clone);
    focusWindow(instanceId);
  }

  function closeWindow(instanceId) {
    const win = getWindowByInstance(instanceId);
    if (!win) return;
    win.remove();
    const bar = document.getElementById('taskbar');
    const taskBtn = bar?.querySelector(`.taskbar-button[data-instance=\"${instanceId}\"]`);
    if (taskBtn) taskBtn.remove();
    if (currentFocusInstance === instanceId) currentFocusInstance = null;
  }

  function setupWindowControls() {
    const area = document.getElementById('window-area');
    if (!area) return;
    area.addEventListener('click', event => {
      const btn = event.target.closest('button');
      if (!btn) return;
      if (btn.closest('.mix-box') || btn.closest('.chunk-box')) return;
      const win = btn.closest('.app-window');
      if (!win) return;
      const instanceId = win.dataset.instance;
      if (btn.classList.contains('collapse-toggle')) {
        if (instanceId) {
          win.classList.add('is-hidden');
          win.classList.remove('is-collapsed');
          setCollapseButton(btn, false);
          if (currentFocusInstance === instanceId) currentFocusInstance = null;
          clearTaskbarActive();
        } else {
          const collapsed = win.classList.toggle('is-collapsed');
          setCollapseButton(btn, collapsed);
        }
        return;
      }
    if (btn.classList.contains('maximize-toggle')) {
        if (isMobileLayout()) {
          win.classList.add('is-maximized');
          return;
        }
        win.classList.toggle('is-maximized');
        return;
      }
      if (btn.classList.contains('remove-box')) {
        if (instanceId) closeWindow(instanceId);
      }
    });
  }

  function setupWindowDrag() {
    const area = document.getElementById('window-area');
    if (!area) return;
    let dragState = null;

    const onMove = event => {
      if (!dragState) return;
      const { win, offsetX, offsetY } = dragState;
      const bounds = area.getBoundingClientRect();
      const x = event.clientX - bounds.left - offsetX;
      const y = event.clientY - bounds.top - offsetY;
      win.style.left = `${Math.max(0, x)}px`;
      win.style.top = `${Math.max(0, y)}px`;
    };

    const endDrag = () => {
      if (dragState?.pointerId != null && dragState?.captureEl?.releasePointerCapture) {
        try {
          dragState.captureEl.releasePointerCapture(dragState.pointerId);
        } catch (err) {
          /* ignore */
        }
      }
      dragState = null;
      document.body?.classList.remove('is-dragging');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', endDrag);
    };

    area.addEventListener('pointerdown', event => {
      const header = event.target.closest('.app-window .window-header');
      if (!header) return;
      if (event.target.closest('button, input, select, textarea')) return;
      const win = header.closest('.app-window');
      if (!win || win.classList.contains('is-hidden') || win.classList.contains('is-maximized')) return;
      event.preventDefault();
      if (header.setPointerCapture) {
        try {
          header.setPointerCapture(event.pointerId);
        } catch (err) {
          /* ignore */
        }
      }
      const instanceId = win.dataset.instance;
      if (instanceId) focusWindow(instanceId);
      const rect = win.getBoundingClientRect();
      const bounds = area.getBoundingClientRect();
      dragState = {
        win,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        pointerId: event.pointerId,
        captureEl: header
      };
      document.body?.classList.add('is-dragging');
      win.style.right = 'auto';
      win.style.transform = 'none';
      win.style.left = `${rect.left - bounds.left}px`;
      win.style.top = `${rect.top - bounds.top}px`;
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', endDrag);
    });
  }

  function setupWindowResize() {
    const area = document.getElementById('window-area');
    if (!area) return;
    let resizeState = null;

    const onMove = event => {
      if (!resizeState) return;
      const { win, startX, startY, startWidth, startHeight } = resizeState;
      const nextWidth = Math.max(320, startWidth + (event.clientX - startX));
      const nextHeight = Math.max(200, startHeight + (event.clientY - startY));
      win.style.width = `${nextWidth}px`;
      win.style.height = `${nextHeight}px`;
    };

    const endResize = () => {
      resizeState = null;
      document.body?.classList.remove('is-dragging');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', endResize);
    };

    area.addEventListener('pointerdown', event => {
      const handle = event.target.closest('.resize-handle');
      if (!handle) return;
      const win = handle.closest('.app-window');
      if (!win || win.classList.contains('is-hidden') || win.classList.contains('is-maximized')) return;
      event.preventDefault();
      const rect = win.getBoundingClientRect();
      resizeState = {
        win,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rect.width,
        startHeight: rect.height
      };
      win.style.right = 'auto';
      win.style.bottom = 'auto';
      document.body?.classList.add('is-dragging');
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', endResize);
    });
  }

  function setupMenu() {
    const menuBar = document.getElementById('menu-bar');
    const menuStart = document.getElementById('menu-start');
    const menu = document.getElementById('menu-dropdown');
    if (!menuBar || !menu) return;
    const closeMenu = () => {
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
      if (menuBar) menuBar.setAttribute('aria-expanded', 'false');
    };
    const openMenu = () => {
      menu.classList.add('open');
      menu.setAttribute('aria-hidden', 'false');
      if (menuBar) menuBar.setAttribute('aria-expanded', 'true');
    };
    const toggleMenu = event => {
      if (event) event.stopPropagation();
      if (menu.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    };
    if (menuStart) menuStart.addEventListener('click', toggleMenu);
    menuBar.addEventListener('click', event => {
      if (event.target.closest('#menu-start')) return;
      if (menu.classList.contains('open')) closeMenu();
    });
    menu.addEventListener('click', event => {
      const item = event.target.closest('.menu-item');
      if (!item) return;
      const windowId = item.dataset.window;
      if (windowId) {
        openWindow(windowId);
      }
      closeMenu();
    });
    menu.addEventListener('mousemove', event => {
      const item = event.target.closest('.menu-item');
      if (!item) return;
      menu.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
    });
    document.addEventListener('click', event => {
      if (menu.contains(event.target) || menuBar.contains(event.target)) return;
      closeMenu();
    });
  }

  // ======== Data Load/Save ========

  const STORAGE_KEY = 'promptEnhancerMixData';

  function exportData() {
    return JSON.stringify(exportMixState(), null, 2);
  }

  function importData(raw) {
    if (!raw) return;
    let data = raw;
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw);
      } catch (err) {
        return;
      }
    }
    applyMixState(data);
    persist();
  }

  function persist() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, exportData());
    } catch (err) {
      /* ignore */
    }
  }

  function loadPersisted() {
    if (typeof localStorage === 'undefined') return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      importData(raw);
      return true;
    } catch (err) {
      return false;
    }
  }

  function resetData() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        /* ignore */
      }
    }
    applyMixState(null);
  }

  function setupDataButtons() {
    const loadBtn = document.getElementById('load-data');
    const saveBtn = document.getElementById('save-data');
    const resetBtn = document.getElementById('reset-data');
    const fileInput = document.getElementById('data-file');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const data = exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prompt-enhancer-mix.json';
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    if (loadBtn && fileInput) {
      loadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => {
        const f = e.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          importData(reader.result);
        };
        reader.readAsText(f);
        fileInput.value = '';
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', resetData);
    }
  }

  // ======== Initialization ========

  function initializeUI() {
    setupTabs();
    if (!loadPersisted()) applyMixState(null, document.querySelector('.mix-root'));
    setupDelimiterControls(document);
    setupSizeControls(document);
    setupUIEvents();
    setupWindowControls();
    setupWindowDrag();
    setupWindowResize();
    setupMenu();
    setupDataButtons();
    syncCollapseButtons(document);

    document.querySelectorAll('.app-window').forEach(win => {
      if (win.classList.contains('window-template')) return;
      const computedWidth = window.getComputedStyle(win).width;
      if (computedWidth && !win.style.width) {
        // Existing windows get a fixed width once to prevent first-run expansion.
        win.style.width = computedWidth;
      }
      setupPromptControls(win);
    });
    applyMobileWindowState();
    if (mobileQuery) {
      const handler = () => applyMobileWindowState();
      if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', handler);
      } else if (typeof mobileQuery.addListener === 'function') {
        mobileQuery.addListener(handler);
      }
      window.addEventListener('resize', handler);
      window.addEventListener('orientationchange', handler);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', persist);
    }
  }

  const api = {
    buildDelimiterRegex,
    parseInput,
    normalizeCustomDelimiter,
    buildChunkList,
    mixChunkLists,
    dropChunksToLimit,
    evaluateMixBox,
    exportMixState,
    applyMixState,
    generate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    window.PromptMixer = api;
  }

  if (
    typeof document !== 'undefined' &&
    !(typeof window !== 'undefined' && window.__TEST__) &&
    !(typeof global !== 'undefined' && global.__TEST__)
  ) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeUI);
    } else {
      initializeUI();
    }
  }
})();

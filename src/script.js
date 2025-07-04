/**
 * Prompt Enhancer - Main Application Logic
 * 
 * This script handles the generation of positive and negative prompt variations
 * by cycling through base prompts and applying different modifiers.
 * 
 * The tool is designed for AI prompt engineering, particularly for:
 * - Audio generation (Suno AI)
 * - Image generation (Stable Diffusion, DALL-E, etc.)
 * - Other AI models that benefit from negative prompting
 */

// Global preset storage for negative and positive modifier lists
let NEG_PRESETS = {};
let POS_PRESETS = {};
let LENGTH_PRESETS = {};
let DIVIDER_PRESETS = {};
let BASE_PRESETS = {};

// Combined lists object used for import/export operations
let LISTS;
if (typeof ALL_LISTS !== 'undefined' && Array.isArray(ALL_LISTS.presets)) {
  LISTS = JSON.parse(JSON.stringify(ALL_LISTS));
} else if (
  typeof NEGATIVE_LISTS !== 'undefined' ||
  typeof POSITIVE_LISTS !== 'undefined' ||
  typeof LENGTH_LISTS !== 'undefined'
) {
  LISTS = { presets: [] };
  if (typeof NEGATIVE_LISTS !== 'undefined') {
    NEGATIVE_LISTS.presets.forEach(p =>
      LISTS.presets.push({ ...p, type: 'negative' })
    );
  }
  if (typeof POSITIVE_LISTS !== 'undefined') {
    POSITIVE_LISTS.presets.forEach(p =>
      LISTS.presets.push({ ...p, type: 'positive' })
    );
  }
  if (typeof LENGTH_LISTS !== 'undefined') {
    LENGTH_LISTS.presets.forEach(p =>
      LISTS.presets.push({ ...p, type: 'length' })
    );
  }
} else {
  LISTS = { presets: [] };
}

/**
 * Populates a select element with options from preset data
 * @param {HTMLSelectElement} selectEl - The select element to populate
 * @param {Array} presets - Array of preset objects with id, title, and items
 */
function populateSelect(selectEl, presets) {
  // Clear existing options
  selectEl.innerHTML = '';
  
  // Add preset options
  presets.forEach((preset, index) => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.title;
    // Select first non-empty preset by default
    if (index === 0 || (selectEl.value === '' && preset.items && preset.items.length > 0)) {
      option.selected = true;
    }
    selectEl.appendChild(option);
  });
  
}

/**
 * Loads preset lists from external JavaScript files and populates dropdowns
 * Dynamically structures the data based on available lists
 */
function loadLists() {
  NEG_PRESETS = {};
  POS_PRESETS = {};
  LENGTH_PRESETS = {};
  DIVIDER_PRESETS = {};
  BASE_PRESETS = {};
  const neg = [];
  const pos = [];
  const len = [];
  const divs = [];
  const base = [];

  if (LISTS.presets && Array.isArray(LISTS.presets)) {
    LISTS.presets.forEach(p => {
      if (p.type === 'negative') {
        NEG_PRESETS[p.id] = p.items || [];
        neg.push(p);
      } else if (p.type === 'positive') {
        POS_PRESETS[p.id] = p.items || [];
        pos.push(p);
      } else if (p.type === 'length') {
        LENGTH_PRESETS[p.id] = p.items || [];
        len.push(p);
      } else if (p.type === 'divider') {
        DIVIDER_PRESETS[p.id] = p.items || [];
        divs.push(p);
      } else if (p.type === 'base') {
        BASE_PRESETS[p.id] = p.items || [];
        base.push(p);
      }
    });
  }

  const negSelect = document.getElementById('neg-select');
  if (negSelect) populateSelect(negSelect, neg);

  const posSelect = document.getElementById('pos-select');
  if (posSelect) populateSelect(posSelect, pos);

  const lengthSelect = document.getElementById('length-select');
  if (lengthSelect) populateSelect(lengthSelect, len);

  const dividerSelect = document.getElementById('divider-select');
  if (dividerSelect) populateSelect(dividerSelect, divs);

  const baseSelect = document.getElementById('base-select');
  if (baseSelect) populateSelect(baseSelect, base);

  // Uncomment the following lines for a quick summary when debugging
  // console.log('Lists loaded:', {
  //   negPresets: Object.keys(NEG_PRESETS).length,
  //   posPresets: Object.keys(POS_PRESETS).length,
  //   lengthPresets: Object.keys(LENGTH_PRESETS).length
  // });
}

/**
 * Parses user input string into an array of items
 * Handles multiple delimiters: comma, semicolon, and newline
 * 
 * @param {string} raw - Raw input string from textarea
 * @returns {string[]} Array of trimmed, non-empty items
 */
function parseInput(raw, keepDelim = false) {
  if (!raw) return [];

  if (!keepDelim) {
    const normalized = raw.replace(/;/g, ',').replace(/\s*,\s*/g, ',');
    return normalized
      .split(/[,\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  const normalized = raw.replace(/\r\n/g, '\n');
  const delims = [',', '.', ';', ':', '!', '?', '\n'];
  const items = [];
  let current = '';

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    current += ch;
    if (delims.includes(ch)) {
      let natural = /[,.!:;?\n]/.test(ch);
      while (i + 1 < normalized.length) {
        const next = normalized[i + 1];
        if (delims.includes(next)) {
          if (/[,.!:;?\n]/.test(next)) natural = true;
          current += next;
          i++;
          continue;
        }
        if (next === ' ' && natural) {
          current += ' ';
          i++;
          continue;
        }
        break;
      }
      items.push(current);
      current = '';
    }
  }

  if (current) {
    if (!/[,.!:;?\n]\s*$/.test(current)) {
      current += '. ';
    }
    items.push(current);
  }

  return items.filter(Boolean);
}

// Parse divider list where each line represents a divider phrase
function parseDividerInput(raw) {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .filter(line => line !== '');
}

/**
 * Utility to shuffle an array in place using Fisher-Yates.
 *
 * @param {Array} arr - Array to shuffle
 * @returns {Array} The same array shuffled
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Returns new arrays trimmed to the length of the shorter one.
 *
 * @param {Array} a - First array
 * @param {Array} b - Second array
 * @returns {[Array, Array]} Tuple of trimmed arrays
 */
function equalizeLength(a, b) {
  const len = Math.min(a.length, b.length);
  return [a.slice(0, len), b.slice(0, len)];
}

/**
 * Builds a comma-separated list by pairing items with prefixes
 * until the character limit is reached.
 *
 * @param {string[]} orderedItems - Items in the order they should appear
 * @param {string[]} prefixes - Prefix strings to cycle through
 * @param {number} limit - Character length limit for output
 * @param {boolean} shufflePrefixes - Whether to shuffle the prefixes once
 * @param {boolean} delimited - Items already include punctuation delimiters
 * @param {string[]} dividers - Optional divider strings inserted on repeats
 * @returns {string[]} Array of prefixed items within the limit
 */
function buildPrefixedList(
  orderedItems,
  prefixes,
  limit,
  shufflePrefixes = false,
  delimited = false,
  dividers = []
) {
  if (!Array.isArray(orderedItems) || orderedItems.length === 0) return [];

  const items = orderedItems.slice();
  const prefixPool = prefixes.slice();
  if (shufflePrefixes) shuffle(prefixPool);
  const dividerPool = dividers.slice();

  const result = [];
  let idx = 0;
  let divIdx = 0;
  while (true) {
    const needDivider = idx > 0 && idx % items.length === 0 && dividerPool.length;
    const prefix = prefixPool.length ? prefixPool[idx % prefixPool.length] : '';
    const item = items[idx % items.length];
    const term = prefix ? `${prefix} ${item}` : item;
    const pieces = [];
    if (needDivider) {
      pieces.push(dividerPool[divIdx % dividerPool.length]);
    }
    pieces.push(term);
    const candidate =
      (result.length ? result.join(delimited ? '' : ', ') + (delimited ? '' : ', ') : '') +
      pieces.join(delimited ? '' : ', ');
    if (candidate.length > limit) break;
    if (needDivider) {
      result.push(dividerPool[divIdx % dividerPool.length]);
      divIdx++;
    }
    result.push(term);
    idx++;
  }

  return result;
}

// Apply a stack of modifier lists sequentially
function applyModifierStack(
  baseItems,
  modifiers,
  limit,
  stackSize = 1,
  shuffleMods = false,
  delimited = false,
  dividers = []
) {
  const count = stackSize > 0 ? stackSize : 1;
  if (count === 1) {
    const mods = modifiers.slice();
    if (shuffleMods) shuffle(mods);
    return buildPrefixedList(baseItems, mods, limit, false, delimited, dividers);
  }

  const orders = [];
  for (let i = 0; i < count; i++) {
    const mods = modifiers.slice();
    shuffle(mods);
    orders.push(mods);
  }

  const dividerPool = dividers.slice();
  const items = baseItems.slice();
  const result = [];
  let idx = 0;
  let divIdx = 0;

  while (true) {
    const needDivider = idx > 0 && idx % items.length === 0 && dividerPool.length;
    let term = items[idx % items.length];
    orders.forEach(mods => {
      const mod = mods[idx % mods.length];
      term = mod ? `${mod} ${term}` : term;
    });
    const pieces = [];
    if (needDivider) pieces.push(dividerPool[divIdx % dividerPool.length]);
    pieces.push(term);
    const candidate =
      (result.length ? result.join(delimited ? '' : ', ') + (delimited ? '' : ', ') : '') +
      pieces.join(delimited ? '' : ', ');
    if (candidate.length > limit) break;
    if (needDivider) {
      result.push(dividerPool[divIdx % dividerPool.length]);
      divIdx++;
    }
    result.push(term);
    idx++;
  }

  return result;
}

// Apply negative modifiers to an already positive list while preserving
// the placement of natural divider tokens. Divider terms are left
// untouched and the modifier cycle only advances on non-divider items.
function applyNegativeOnPositive(
  posTerms,
  negMods,
  limit,
  stackSize = 1,
  shuffleMods = false,
  delimited = false,
  dividers = []
) {
  const count = stackSize > 0 ? stackSize : 1;
  const orders = [];
  for (let i = 0; i < count; i++) {
    const mods = negMods.slice();
    if (shuffleMods) shuffle(mods);
    orders.push(mods);
  }

  const dividerSet = new Set(dividers);
  const result = [];
  let modIdx = 0;

  for (let i = 0; i < posTerms.length; i++) {
    const base = posTerms[i];
    if (dividerSet.has(base)) {
      const candidate =
        (result.length ? result.join(delimited ? '' : ', ') + (delimited ? '' : ', ') : '') +
        base;
      if (candidate.length > limit) break;
      result.push(base);
      continue;
    }

    let term = base;
    orders.forEach(mods => {
      const mod = mods[modIdx % mods.length];
      term = mod ? `${mod} ${term}` : term;
    });
    const candidate =
      (result.length ? result.join(delimited ? '' : ', ') + (delimited ? '' : ', ') : '') +
      term;
    if (candidate.length > limit) break;
    result.push(term);
    modIdx++;
  }

  return result;
}

/**
 * Core algorithm that builds two prefixed versions of the prompts.
 * Uses the same base order for both versions and cycles prefixes
 * until the character limit is reached.
 *
 * @param {string[]} items - Base prompt items to enhance
 * @param {string[]} negMods - Negative modifiers for the negative version
 * @param {string[]} posMods - Positive modifiers for the positive version
 * @param {boolean} shuffleBase - Whether to randomize base items
 * @param {boolean} shuffleNeg - Whether to randomize negative modifiers
 * @param {boolean} shufflePos - Whether to randomize positive modifiers
 * @param {number} limit - Character limit for output
 * @param {boolean} includePosForNeg - Whether negative generation should use the positive terms as its base
 * @param {string[]} dividers - Optional divider strings inserted on repeats
 * @returns {{positive: string, negative: string}} Object with positive and negative prompt strings
*/
function buildVersions(
  items,
  negMods,
  posMods,
  shuffleBase,
  shuffleNeg,
  shufflePos,
  limit,
  includePosForNeg = false,
  dividers = [],
  shuffleDividers = true,
  posStackSize = 1,
  negStackSize = 1
) {
  if (!items.length) {
    return { positive: '', negative: '' };
  }

  if (shuffleBase) shuffle(items);

  const delimited = /[,.!:;?\n]\s*$/.test(items[0]);

  const dividerPool = dividers.map(d => (d.startsWith('\n') ? d : '\n' + d));
  if (dividerPool.length && shuffleDividers) shuffle(dividerPool);

  const posTerms = applyModifierStack(
    items,
    posMods,
    limit,
    posStackSize,
    shufflePos,
    delimited,
    dividerPool
  );

  const negTerms = includePosForNeg
    ? applyNegativeOnPositive(
        posTerms,
        negMods,
        limit,
        negStackSize,
        shuffleNeg,
        delimited,
        dividerPool
      )
    : applyModifierStack(
        items,
        negMods,
        limit,
        negStackSize,
        shuffleNeg,
        delimited,
        dividerPool
      );

  const [trimNeg, trimPos] = equalizeLength(negTerms, posTerms);

  return {
    positive: trimPos.join(delimited ? '' : ', '),
    negative: trimNeg.join(delimited ? '' : ', ')
  };
}

/**
 * Processes a lyrics string by removing punctuation, collapsing line breaks
 * and spaces, lowercasing, then inserting a random number of spaces between
 * each word.
 *
 * @param {string} text - Raw lyrics text
 * @param {number} maxSpaces - Maximum number of spaces to insert
 * @param {boolean} removeParens - Remove text within parentheses
 * @param {boolean} removeBrackets - Remove text within brackets
 * @returns {string} The processed lyrics string
 */
function processLyrics(text, maxSpaces, removeParens = false, removeBrackets = false) {
  if (!text) return '';
  const limit = parseInt(maxSpaces, 10);
  const max = !isNaN(limit) && limit > 0 ? limit : 1;
  let cleaned = text.toLowerCase();

  if (removeParens) {
    cleaned = cleaned.replace(/\([^()]*\)/g, ' ');
  }
  if (removeBrackets) {
    cleaned = cleaned.replace(/\[[^\]]*\]|\{[^}]*\}|<[^>]*>/g, ' ');
  }

  let pattern = '[^\\w\\s';
  if (!removeParens) pattern += '\\(\\)';
  if (!removeBrackets) pattern += '\\[\\]\\{\\}<>';
  pattern += ']';

  cleaned = cleaned.replace(new RegExp(pattern, 'g'), '');
  cleaned = cleaned.replace(/\r?\n/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ');
  return words
    .map((w, i) => {
      if (i === words.length - 1) return w;
      const spaces = 1 + Math.floor(Math.random() * max);
      return w + ' '.repeat(spaces);
    })
    .join('');
}

/**
 * Loads the selected preset into the textarea
 *
 * @param {HTMLSelectElement} selectEl - Dropdown element
 * @param {HTMLTextAreaElement} textareaEl - Associated textarea
 * @param {Object|string} presetsOrType - Preset lists object or type key
 */
function applyPreset(selectEl, inputEl, presetsOrType) {
  let presets = presetsOrType;
  if (typeof presetsOrType === 'string') {
    if (presetsOrType === 'negative') {
      presets = NEG_PRESETS;
    } else if (presetsOrType === 'positive') {
      presets = POS_PRESETS;
    } else if (presetsOrType === 'length') {
      presets = LENGTH_PRESETS;
    } else if (presetsOrType === 'divider') {
      presets = DIVIDER_PRESETS;
    } else if (presetsOrType === 'base') {
      presets = BASE_PRESETS;
    } else {
      presets = {};
    }
  }
  const key = selectEl.value;
  const list = presets[key] || [];
  if (inputEl.tagName === 'TEXTAREA') {
    const sep = presetsOrType === 'divider' || presets === DIVIDER_PRESETS ? '\n' : ', ';
    inputEl.value = list.join(sep);
  } else {
    inputEl.value = list[0] || '';
  }
  inputEl.disabled = false;
}

// Attach preset dropdowns to their inputs
function setupPresetListener(selectId, inputId, type) {
  const select = document.getElementById(selectId);
  const input = document.getElementById(inputId);
  if (!select || !input) return;
  select.addEventListener('change', () => applyPreset(select, input, type));
}


/**
 * Collects all input values from the UI
 * @returns {Object} Object containing all configuration values
 */
function collectInputs() {
  const baseItems = parseInput(
    document.getElementById('base-input').value,
    true
  );
  const negMods = parseInput(document.getElementById('neg-input').value);
  const posMods = parseInput(document.getElementById('pos-input').value);
  const shuffleBase = document.getElementById('base-shuffle').checked;
  const shufflePos = document.getElementById('pos-shuffle').checked;
  const posStackOn = document.getElementById('pos-stack').checked;
  const posStackSize = parseInt(
    document.getElementById('pos-stack-size')?.value || '1',
    10
  );
  const includePosForNeg = document.getElementById('neg-include-pos').checked;
  const shuffleNeg = document.getElementById('neg-shuffle').checked;
  const negStackOn = document.getElementById('neg-stack').checked;
  const negStackSize = parseInt(
    document.getElementById('neg-stack-size')?.value || '1',
    10
  );
  const dividerMods = parseDividerInput(
    document.getElementById('divider-input')?.value || ''
  );
  const shuffleDividers = document.getElementById('divider-shuffle')?.checked;
  const lengthSelect = document.getElementById('length-select');
  const lengthInput = document.getElementById('length-input');

  // Determine character limit
  let limit = parseInt(lengthInput.value, 10);
  if (isNaN(limit) || limit <= 0) {
    const preset = LENGTH_PRESETS[lengthSelect.value];
    limit = preset ? parseInt(preset[0], 10) : 1000;
    lengthInput.value = limit;
  }
  
  return {
    baseItems,
    negMods,
    posMods,
    shuffleBase,
    shuffleNeg,
    shufflePos,
    posStackOn,
    posStackSize,
    negStackOn,
    negStackSize,
    limit,
    includePosForNeg,
    dividerMods,
    shuffleDividers
  };
}

/**
 * Displays the generated output in the UI
 * @param {{positive: string, negative: string}} result - Generated prompts
*/
function displayOutput(result) {
  document.getElementById('positive-output').textContent = result.positive;
  document.getElementById('negative-output').textContent = result.negative;
}

/**
 * Main generation function triggered by Generate button
 * Validates input and generates both versions
 */
function generate() {
  const {
    baseItems,
    negMods,
    posMods,
    shuffleBase,
    shuffleNeg,
    shufflePos,
    posStackOn,
    posStackSize,
    negStackOn,
    negStackSize,
    limit,
    includePosForNeg,
    dividerMods,
    shuffleDividers
  } = collectInputs();
  if (!baseItems.length) {
    alert('Please enter at least one base prompt item.');
    return;
  }
  const dividers = dividerMods.length ? dividerMods : [];
  const result = buildVersions(
    baseItems,
    negMods,
    posMods,
    shuffleBase,
    negStackOn ? true : shuffleNeg,
    posStackOn ? true : shufflePos,
    limit,
    includePosForNeg,
    dividers,
    shuffleDividers,
    posStackOn ? posStackSize : 1,
    negStackOn ? negStackSize : 1
  );
  displayOutput(result);

  const lyricsInput = document.getElementById('lyrics-input');
  if (lyricsInput && lyricsInput.value.trim()) {
    const spaceSel = document.getElementById('lyrics-space');
    const maxSpaces = spaceSel ? spaceSel.value : 1;
    const removeParens = document.getElementById('lyrics-remove-parens')?.checked;
    const removeBrackets = document.getElementById('lyrics-remove-brackets')?.checked;
    const processed = processLyrics(
      lyricsInput.value,
      maxSpaces,
      removeParens,
      removeBrackets
    );
    document.getElementById('lyrics-output').textContent = processed;
  } else {
    const out = document.getElementById('lyrics-output');
    if (out) out.textContent = '';
  }
}

// Update button appearance and text based on checkbox state
function updateButtonState(btn, checkbox) {
  btn.classList.toggle('active', checkbox.checked);
  if (btn.dataset.on && btn.dataset.off) {
    btn.textContent = checkbox.checked ? btn.dataset.on : btn.dataset.off;
  }
}

// Toggle button helper
function setupToggleButtons() {
  document.querySelectorAll('.toggle-button').forEach(btn => {
    const target = btn.dataset.target;
    const checkbox = document.getElementById(target);
    if (!checkbox) return;
    updateButtonState(btn, checkbox);
    btn.addEventListener('click', () => {
      checkbox.checked = !checkbox.checked;
      updateButtonState(btn, checkbox);
      checkbox.dispatchEvent(new Event('change'));
    });
  });
}

// Randomize all toggles
function setupShuffleAll() {
  const allRandom = document.getElementById('all-random');
  if (!allRandom) return;
  const shuffleCheckboxes = [
    document.getElementById('base-shuffle'),
    document.getElementById('pos-shuffle'),
    document.getElementById('neg-shuffle')
  ].filter(Boolean);
  allRandom.addEventListener('change', () => {
    shuffleCheckboxes.forEach(cb => {
      const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
      if (btn && btn.classList.contains('disabled')) {
        return;
      }
      cb.checked = allRandom.checked;
      if (btn) updateButtonState(btn, cb);
    });
    const allBtn = document.querySelector('.toggle-button[data-target="all-random"]');
    if (allBtn) updateButtonState(allBtn, allRandom);
  });
}

// Manage stack size controls and shuffle lock
function setupStackControls() {
  const configs = [
    { stack: 'pos-stack', size: 'pos-stack-size', shuffle: 'pos-shuffle' },
    { stack: 'neg-stack', size: 'neg-stack-size', shuffle: 'neg-shuffle' }
  ];
  configs.forEach(cfg => {
    const stackCb = document.getElementById(cfg.stack);
    const sizeEl = document.getElementById(cfg.size);
    const shuffleCb = document.getElementById(cfg.shuffle);
    const shuffleBtn = document.querySelector(
      `.toggle-button[data-target="${cfg.shuffle}"]`
    );
    if (!stackCb || !sizeEl || !shuffleCb) return;
    let prev = shuffleCb.checked;
    const update = () => {
      if (stackCb.checked) {
        prev = shuffleCb.checked;
        shuffleCb.checked = true;
        if (shuffleBtn) {
          shuffleBtn.classList.add('disabled');
          shuffleBtn.setAttribute('disabled', 'true');
          updateButtonState(shuffleBtn, shuffleCb);
        }
        sizeEl.style.display = '';
      } else {
        if (shuffleBtn) {
          shuffleBtn.classList.remove('disabled');
          shuffleBtn.removeAttribute('disabled');
          updateButtonState(shuffleBtn, shuffleCb);
        }
        shuffleCb.checked = prev;
        sizeEl.style.display = 'none';
      }
    };
    stackCb.addEventListener('change', update);
    update();
  });
}

// Show/hide overwrite toggle when combining lists
function setupCombineToggle() {
  const combineCb = document.getElementById('combine-lists');
  const overwriteBtn = document.querySelector(
    '.toggle-button[data-target="overwrite-lists"]'
  );
  if (!combineCb || !overwriteBtn) return;
  const update = () => {
    overwriteBtn.style.display = combineCb.checked ? '' : 'none';
  };
  combineCb.addEventListener('change', update);
  update();
}

// Show/hide element toggles
function setupHideToggles() {
  const hideCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"][data-targets]'));
  hideCheckboxes.forEach(cb => {
    const ids = cb.dataset.targets.split(',').map(id => id.trim());
    const elems = ids.map(id => document.getElementById(id)).filter(Boolean);
    const update = () => {
      elems.forEach(el => {
        el.style.display = cb.checked ? 'none' : '';
      });
      const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
      if (btn) {
        updateButtonState(btn, cb);
        const col = btn.parentElement;
        if (col && col.classList.contains('button-col')) {
          const row = col.parentElement;
          if (row && row.classList.contains('input-row')) {
            row.style.justifyContent = cb.checked ? 'flex-end' : '';
          }
        }
      }
    };
    cb.addEventListener('change', update);
    update();
  });
  return hideCheckboxes;
}

// Copy text buttons
function setupCopyButtons() {
  document.querySelectorAll('.copy-button').forEach(btn => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    if (!btn.dataset.orig) {
      btn.dataset.orig = btn.innerHTML;
    }
    btn.addEventListener('click', async () => {
      try {
        const text = target.value !== undefined ? target.value : target.textContent;
        await navigator.clipboard.writeText(text);
        btn.innerHTML = '&#10003;';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = btn.dataset.orig;
          btn.classList.remove('copied');
        }, 800);
      } catch (err) {
        console.error('Copy failed', err);
      }
    });
  });
}

// Export the current LISTS object as a JSON string
function exportLists() {
  return JSON.stringify(LISTS, null, 2);
}

// Replace LISTS with the provided object and reload presets
function importLists(obj, combine = false, overwrite = false) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.presets)) return;
  if (!combine) {
    LISTS = {
      presets: obj.presets.map(p => ({
        id: p.id,
        title: p.title,
        type: p.type,
        items: Array.isArray(p.items) ? p.items : []
      }))
    };
  } else {
    const existing = LISTS.presets.slice();
    obj.presets.forEach(p => {
      const idx = existing.findIndex(
        e => e.id === p.id && e.type === p.type
      );
      const preset = {
        id: p.id,
        title: p.title,
        type: p.type,
        items: Array.isArray(p.items) ? p.items : []
      };
      if (idx !== -1) {
        if (overwrite) {
          existing[idx] = preset;
        }
      } else {
        existing.push(preset);
      }
    });
    LISTS.presets = existing;
  }
  loadLists();
}

// Load lists from a File object
function loadListsFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const combine = document.getElementById('combine-lists');
      const overwrite = document.getElementById('overwrite-lists');
      importLists(
        data,
        combine ? combine.checked : false,
        overwrite ? overwrite.checked : false
      );
    } catch (err) {
      alert('Invalid lists file');
    }
  };
  reader.readAsText(file);
}

// Trigger download of the current lists
function downloadLists() {
  const blob = new Blob([exportLists()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lists.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Save the current textarea values back into LISTS
function saveList(type) {
  const map = {
    base: { select: 'base-select', input: 'base-input', store: BASE_PRESETS },
    negative: { select: 'neg-select', input: 'neg-input', store: NEG_PRESETS },
    positive: { select: 'pos-select', input: 'pos-input', store: POS_PRESETS },
    length: { select: 'length-select', input: 'length-input', store: LENGTH_PRESETS },
    divider: { select: 'divider-select', input: 'divider-input', store: DIVIDER_PRESETS }
  };
  const cfg = map[type];
  if (!cfg) return;
  const sel = document.getElementById(cfg.select);
  const inp = document.getElementById(cfg.input);
  if (!sel || !inp) return;
  const name = prompt('Enter list name', sel.value);
  if (!name) return;
  const items = type === 'divider' ? parseDividerInput(inp.value) : parseInput(inp.value);
  let preset = LISTS.presets.find(p => p.id === name && p.type === type);
  if (!preset) {
    preset = { id: name, title: name, type, items };
    LISTS.presets.push(preset);
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  } else {
    preset.items = items;
  }
  cfg.store[name] = items;
  sel.value = name;
}


/**
 * Initialize the UI with default selections
 * Populates textareas based on the initially selected dropdown options
 */
function initializeUI() {
  // Load lists and populate dropdowns
  loadLists();

  // Populate textareas with initially selected presets
  applyPreset(
    document.getElementById('neg-select'),
    document.getElementById('neg-input'),
    'negative'
  );
  applyPreset(
    document.getElementById('pos-select'),
    document.getElementById('pos-input'),
    'positive'
  );
  applyPreset(
    document.getElementById('length-select'),
    document.getElementById('length-input'),
    'length'
  );
  applyPreset(
    document.getElementById('divider-select'),
    document.getElementById('divider-input'),
    'divider'
  );
  applyPreset(
    document.getElementById('base-select'),
    document.getElementById('base-input'),
    'base'
  );

  setupPresetListener('neg-select', 'neg-input', 'negative');
  setupPresetListener('pos-select', 'pos-input', 'positive');
  setupPresetListener('length-select', 'length-input', 'length');
  setupPresetListener('divider-select', 'divider-input', 'divider');
  setupPresetListener('base-select', 'base-input', 'base');
  document.getElementById('generate').addEventListener('click', generate);

  setupToggleButtons();
  setupStackControls();
  setupShuffleAll();
  setupCombineToggle();
  const hideCheckboxes = setupHideToggles();

  const allHide = document.getElementById('all-hide');
  if (allHide) {
    allHide.addEventListener('change', () => {
      hideCheckboxes.forEach(cb => {
        cb.checked = allHide.checked;
        const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
        if (btn) updateButtonState(btn, cb);
        cb.dispatchEvent(new Event('change'));
      });
      const allHideBtn = document.querySelector('.toggle-button[data-target="all-hide"]');
      if (allHideBtn) updateButtonState(allHideBtn, allHide);
    });
  }

  setupCopyButtons();

  const loadBtn = document.getElementById('load-lists');
  const fileInput = document.getElementById('lists-file');
  if (loadBtn && fileInput) {
    loadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) loadListsFromFile(f);
      fileInput.value = '';
    });
  }
  const dlBtn = document.getElementById('download-lists');
  if (dlBtn) dlBtn.addEventListener('click', downloadLists);
  const baseSave = document.getElementById('base-save');
  if (baseSave) baseSave.addEventListener('click', () => saveList('base'));
  const posSave = document.getElementById('pos-save');
  if (posSave) posSave.addEventListener('click', () => saveList('positive'));
  const negSave = document.getElementById('neg-save');
  if (negSave) negSave.addEventListener('click', () => saveList('negative'));
  const lenSave = document.getElementById('length-save');
  if (lenSave) lenSave.addEventListener('click', () => saveList('length'));
  const divSave = document.getElementById('divider-save');
  if (divSave) divSave.addEventListener('click', () => saveList('divider'));
}

// Initialize UI when DOM is ready
if (typeof document !== 'undefined' && !(typeof window !== 'undefined' && window.__TEST__)) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUI);
  } else {
    // DOM is already loaded
    initializeUI();
  }
}

// Export functions for testing in Node
if (typeof module !== 'undefined') {
  module.exports = {
    parseInput,
    shuffle,
    equalizeLength,
    buildPrefixedList,
    applyModifierStack,
    applyNegativeOnPositive,
    buildVersions,
    processLyrics,
    setupShuffleAll,
    setupStackControls,
    setupCombineToggle,
    setupHideToggles,
    applyPreset,
    parseDividerInput,
    exportLists,
    importLists,
    saveList,
    downloadLists,
    loadListsFromFile,
  };
}

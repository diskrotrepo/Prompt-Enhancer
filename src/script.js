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
  // Process negative modifier presets
  if (typeof NEGATIVE_LISTS === 'object' && NEGATIVE_LISTS.presets) {
    // Convert presets array to object for easier access
    NEG_PRESETS = {};
    NEGATIVE_LISTS.presets.forEach(preset => {
      NEG_PRESETS[preset.id] = preset.items || [];
    });
    
    // Populate the negative modifier dropdown
    const negSelect = document.getElementById('neg-select');
    if (negSelect) {
      populateSelect(negSelect, NEGATIVE_LISTS.presets);
    }
  }
  
  // Process positive modifier presets
  if (typeof POSITIVE_LISTS === 'object' && POSITIVE_LISTS.presets) {
    // Convert presets array to object for easier access
    POS_PRESETS = {};
    POSITIVE_LISTS.presets.forEach(preset => {
      POS_PRESETS[preset.id] = preset.items || [];
    });
    
    // Populate the positive modifier dropdown
    const posSelect = document.getElementById('pos-select');
    if (posSelect) {
      populateSelect(posSelect, POSITIVE_LISTS.presets);
    }
  }

  // Process length limit presets
  if (typeof LENGTH_LISTS === 'object' && LENGTH_LISTS.presets) {
    LENGTH_PRESETS = {};
    LENGTH_LISTS.presets.forEach(preset => {
      LENGTH_PRESETS[preset.id] = preset.items || [];
    });

    const lengthSelect = document.getElementById('length-select');
    if (lengthSelect) {
      populateSelect(lengthSelect, LENGTH_LISTS.presets);
    }
  }

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
function parseInput(raw) {
  if (!raw) return [];
  // Normalize delimiters to commas, then split
  const normalized = raw.replace(/;/g, ',').replace(/\s*,\s*/g, ',');
  return normalized.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
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
 * @returns {string[]} Array of prefixed items within the limit
 */
function buildPrefixedList(orderedItems, prefixes, limit, shufflePrefixes = false) {
  if (!Array.isArray(orderedItems) || orderedItems.length === 0) return [];

  const items = orderedItems.slice();
  const prefixPool = prefixes.slice();
  if (shufflePrefixes) shuffle(prefixPool);

  const result = [];
  let idx = 0;
  while (true) {
    const item = items[idx % items.length];
    const prefix = prefixPool.length ? prefixPool[idx % prefixPool.length] : '';
    const term = prefix ? `${prefix} ${item}` : item;
    const next = result.length ? `${result.join(', ')}, ${term}` : term;
    if (next.length > limit) break;
    result.push(term);
    idx++;
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
 * @returns {{positive: string, negative: string}} Object with positive and negative prompt strings
*/
function buildVersions(items, negMods, posMods, shuffleBase, shuffleNeg, shufflePos, limit, includePosForNeg = false) {
  if (!items.length) {
    return { positive: '', negative: '' };
  }

  if (shuffleBase) shuffle(items);

  const posTerms = buildPrefixedList(items, posMods, limit, shufflePos);
  const negBase = includePosForNeg ? posTerms : items;
  const negTerms = buildPrefixedList(negBase, negMods, limit, shuffleNeg);

  const [trimNeg, trimPos] = equalizeLength(negTerms, posTerms);

  return {
    positive: trimPos.join(', '),
    negative: trimNeg.join(', ')
  };
}

/**
 * Loads the selected preset into the textarea
 *
 * @param {HTMLSelectElement} selectEl - Dropdown element
 * @param {HTMLTextAreaElement} textareaEl - Associated textarea
 * @param {Object} presets - Preset lists object
 */
function applyPreset(selectEl, inputEl, presets) {
  const key = selectEl.value;
  const list = presets[key] || [];
  if (inputEl.tagName === 'TEXTAREA') {
    inputEl.value = list.join(', ');
  } else {
    inputEl.value = list[0] || '';
  }
  inputEl.disabled = false;
}

// Attach preset dropdowns to their inputs
function setupPresetListener(selectId, inputId, presets) {
  const select = document.getElementById(selectId);
  const input = document.getElementById(inputId);
  if (!select || !input) return;
  select.addEventListener('change', () => applyPreset(select, input, presets));
}


/**
 * Collects all input values from the UI
 * @returns {Object} Object containing all configuration values
 */
function collectInputs() {
  const baseItems = parseInput(document.getElementById('base-input').value);
  const negMods = parseInput(document.getElementById('neg-input').value);
  const posMods = parseInput(document.getElementById('pos-input').value);
  const shuffleBase = document.getElementById('base-shuffle').checked;
  const shuffleNeg = document.getElementById('neg-shuffle').checked;
  const shufflePos = document.getElementById('pos-shuffle').checked;
  const includePosForNeg = document.getElementById('neg-include-pos').checked;
  const lengthSelect = document.getElementById('length-select');
  const lengthInput = document.getElementById('length-input');

  // Determine character limit
  let limit = parseInt(lengthInput.value, 10);
  if (isNaN(limit) || limit <= 0) {
    const preset = LENGTH_PRESETS[lengthSelect.value];
    limit = preset ? parseInt(preset[0], 10) : 1000;
    lengthInput.value = limit;
  }
  
  return { baseItems, negMods, posMods, shuffleBase, shuffleNeg, shufflePos, limit, includePosForNeg };
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
  const { baseItems, negMods, posMods, shuffleBase, shuffleNeg, shufflePos, limit, includePosForNeg } = collectInputs();
  if (!baseItems.length) {
    alert('Please enter at least one base prompt item.');
    return;
  }
  const result = buildVersions(baseItems, negMods, posMods, shuffleBase, shuffleNeg, shufflePos, limit, includePosForNeg);
  displayOutput(result);
}

// Toggle button helper
function setupToggleButtons() {
  document.querySelectorAll('.toggle-button').forEach(btn => {
    const target = btn.dataset.target;
    const checkbox = document.getElementById(target);
    if (!checkbox) return;
    btn.classList.toggle('active', checkbox.checked);
    btn.addEventListener('click', () => {
      checkbox.checked = !checkbox.checked;
      btn.classList.toggle('active', checkbox.checked);
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
    document.getElementById('neg-shuffle'),
    document.getElementById('pos-shuffle')
  ].filter(Boolean);
  allRandom.addEventListener('change', () => {
    shuffleCheckboxes.forEach(cb => {
      cb.checked = allRandom.checked;
      const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
      if (btn) btn.classList.toggle('active', cb.checked);
    });
  });
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
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(target.textContent);
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1000);
      } catch (err) {
        console.error('Copy failed', err);
      }
    });
  });
}


/**
 * Initialize the UI with default selections
 * Populates textareas based on the initially selected dropdown options
 */
function initializeUI() {
  // Load lists and populate dropdowns
  loadLists();

  // Populate textareas with initially selected presets
  applyPreset(document.getElementById('neg-select'), document.getElementById('neg-input'), NEG_PRESETS);
  applyPreset(document.getElementById('pos-select'), document.getElementById('pos-input'), POS_PRESETS);
  applyPreset(document.getElementById('length-select'), document.getElementById('length-input'), LENGTH_PRESETS);

  setupPresetListener('neg-select', 'neg-input', NEG_PRESETS);
  setupPresetListener('pos-select', 'pos-input', POS_PRESETS);
  setupPresetListener('length-select', 'length-input', LENGTH_PRESETS);
  document.getElementById('generate').addEventListener('click', generate);

  setupToggleButtons();
  setupShuffleAll();
  const hideCheckboxes = setupHideToggles();

  const allHide = document.getElementById('all-hide');
  if (allHide) {
    allHide.addEventListener('change', () => {
      hideCheckboxes.forEach(cb => {
        cb.checked = allHide.checked;
        const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
        if (btn) btn.classList.toggle('active', cb.checked);
        cb.dispatchEvent(new Event('change'));
      });
    });
  }

  setupCopyButtons();
}

// Initialize UI when DOM is ready
if (typeof document !== 'undefined') {
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
    buildVersions,
  };
}

/**
 * Prompt Enhancer - Main Application Logic
 * 
 * This script handles the generation of "good" and "bad" prompt variations
 * by cycling through base prompts and applying different modifiers.
 * 
 * The tool is designed for AI prompt engineering, particularly for:
 * - Audio generation (Suno AI)
 * - Image generation (Stable Diffusion, DALL-E, etc.)
 * - Other AI models that benefit from negative prompting
 */

// Global preset storage for descriptor and positive modifier lists
let DESC_PRESETS = {};
let POS_PRESETS = {};

/**
 * Populates a select element with options from preset data
 * @param {HTMLSelectElement} selectEl - The select element to populate
 * @param {Array} presets - Array of preset objects with id, title, and items
 */
function populateSelect(selectEl, presets) {
  // Clear existing options except custom
  const customOption = selectEl.querySelector('option[value="custom"]');
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
  
  // Re-add custom option at the end
  if (customOption) {
    selectEl.appendChild(customOption);
  }
}

/**
 * Loads preset lists from external JavaScript files and populates dropdowns
 * Dynamically structures the data based on available lists
 */
function loadLists() {
  // Process bad descriptor presets
  if (typeof BAD_LISTS === 'object' && BAD_LISTS.presets) {
    // Convert presets array to object for easier access
    DESC_PRESETS = {};
    BAD_LISTS.presets.forEach(preset => {
      DESC_PRESETS[preset.id] = preset.items || [];
    });
    
    // Populate the bad descriptor dropdown
    const descSelect = document.getElementById('desc-select');
    if (descSelect) {
      populateSelect(descSelect, BAD_LISTS.presets);
    }
  }
  
  // Process positive modifier presets
  if (typeof GOOD_LISTS === 'object' && GOOD_LISTS.presets) {
    // Convert presets array to object for easier access
    POS_PRESETS = {};
    GOOD_LISTS.presets.forEach(preset => {
      POS_PRESETS[preset.id] = preset.items || [];
    });
    
    // Populate the positive modifier dropdown
    const posSelect = document.getElementById('pos-select');
    if (posSelect) {
      populateSelect(posSelect, GOOD_LISTS.presets);
    }
  }

  console.log('Lists loaded:', {
    descPresets: Object.keys(DESC_PRESETS).length,
    posPresets: Object.keys(POS_PRESETS).length
  });
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
 * Core algorithm that builds good and bad versions of prompts
 * Cycles through items and modifiers to create variations up to the character limit
 * 
 * @param {string[]} items - Base prompt items to enhance
 * @param {string[]} descs - Negative descriptors for bad version
 * @param {string[]} posMods - Positive modifiers for good version
 * @param {boolean} shuffleBase - Whether to randomize base items
 * @param {boolean} shuffleBad - Whether to randomize bad descriptors
 * @param {boolean} shufflePos - Whether to randomize positive modifiers
 * @param {number} limit - Character limit for output
 * @returns {{good: string, bad: string}} Object with good and bad prompt strings
 */
function buildVersions(items, descs, posMods, shuffleBase, shuffleBad, shufflePos, limit) {
  /**
   * Creates a cycling iterator for an array
   * Optionally shuffles the array on each cycle
   * 
   * @param {string[]} arr - Array to cycle through
   * @param {boolean} shuffle - Whether to shuffle on each cycle
   * @returns {Function} Iterator function that returns next item
   */
  function makeCycler(arr, shuffle) {
    let pool = shuffle ? [] : arr.slice();
    let idx = 0;
    return () => {
      if (!arr.length) return null;
      // Reset and optionally shuffle when we've used all items
      if (idx >= pool.length) {
        pool = shuffle ? arr.slice().sort(() => Math.random() - 0.5) : arr.slice();
        idx = 0;
      }
      return pool[idx++];
    };
  }

  // Create cyclers for each list type
  const nextItem = makeCycler(items, shuffleBase);
  const nextPrefix = makeCycler(descs, shuffleBad);
  const nextPos = makeCycler(posMods, shufflePos);

  // Output arrays
  const bad = [];
  const good = [];

  /**
   * Creates a term by combining a prefix with the next base item
   * @param {string} prefix - Prefix to add (negative descriptor)
   * @returns {{term: string, item: string}|null} Object with combined term and original item
   */
  function makeTerm(prefix) {
    if (prefix === null) return null;
    const item = nextItem();
    return { term: `${prefix} ${item}`, item };
  }

  /**
   * Creates positive version of an item by adding positive modifier
   * @param {string} item - Base item to enhance
   * @returns {string} Enhanced item with positive modifier
   */
  function makePosTerm(item) {
    if (posMods.length === 0) return item;
    const prefix = nextPos();
    return `${prefix} ${item}`;
  }

  /**
   * Attempts to add a term to both good and bad outputs
   * Checks character limit before adding
   * @param {Object} obj - Term object from makeTerm
   * @returns {boolean} Whether the term was successfully added
   */
  function tryAdd(obj) {
    if (!obj) return false;
    // Check if adding this term would exceed the limit
    const test = [...bad, obj.term].join(', ');
    if (test.length > limit) return false;
    // Add to both versions
    bad.push(obj.term);
    good.push(makePosTerm(obj.item));
    return true;
  }

  // Main generation loop - continues until character limit is reached
  while (true) {
    const prefix = nextPrefix();
    if (prefix === null) break; // No more prefixes available
    const obj = makeTerm(prefix);
    if (!tryAdd(obj)) break; // Character limit reached
  }

  return {
    good: good.join(', '),
    bad: bad.join(', ')
  };
}

/**
 * Gets the appropriate list based on select dropdown value
 * Handles preset lists and custom input
 * 
 * @param {HTMLSelectElement} selectEl - Dropdown element
 * @param {HTMLTextAreaElement} textareaEl - Associated textarea
 * @param {Object} presets - Preset lists object
 * @returns {string[]} Selected or custom list
 */
function getList(selectEl, textareaEl, presets) {
  const key = selectEl.value;
  if (key === 'custom') {
    textareaEl.disabled = false;
    return parseInput(textareaEl.value);
  }
  // Use preset list
  const list = presets[key] || [];
  textareaEl.value = list.join(', ');
  textareaEl.disabled = true;
  return list;
}

// Event listener for bad descriptor dropdown changes
document.getElementById('desc-select').addEventListener('change', () => {
  console.log('Desc select changed to:', document.getElementById('desc-select').value);
  getList(document.getElementById('desc-select'), document.getElementById('desc-input'), DESC_PRESETS);
});

// Event listener for positive modifier dropdown changes
document.getElementById('pos-select').addEventListener('change', () => {
  console.log('Pos select changed to:', document.getElementById('pos-select').value);
  getList(document.getElementById('pos-select'), document.getElementById('pos-input'), POS_PRESETS);
});

// Event listener for length limit dropdown changes
document.getElementById('length-select').addEventListener('change', () => {
  const select = document.getElementById('length-select');
  const input = document.getElementById('length-input');
  if (select.value === 'custom') {
    input.disabled = false;
  } else {
    input.value = select.value;
    input.disabled = true;
  }
});

/**
 * Collects all input values from the UI
 * @returns {Object} Object containing all configuration values
 */
function collectInputs() {
  const baseItems = parseInput(document.getElementById('base-input').value);
  const descs = getList(document.getElementById('desc-select'), document.getElementById('desc-input'), DESC_PRESETS);
  const posMods = getList(document.getElementById('pos-select'), document.getElementById('pos-input'), POS_PRESETS);
  const shuffleBase = document.getElementById('base-shuffle').checked;
  const shuffleBad = document.getElementById('desc-shuffle').checked;
  const shufflePos = document.getElementById('pos-shuffle').checked;
  const lengthSelect = document.getElementById('length-select');
  const lengthInput = document.getElementById('length-input');
  
  // Determine character limit
  let limit;
  if (lengthSelect.value === 'custom') {
    limit = parseInt(lengthInput.value, 10) || 1000;
  } else {
    limit = parseInt(lengthSelect.value, 10);
    lengthInput.value = limit;
  }
  
  return { baseItems, descs, posMods, shuffleBase, shuffleBad, shufflePos, limit };
}

/**
 * Displays the generated output in the UI
 * @param {{good: string, bad: string}} result - Generated prompts
 */
function displayOutput(result) {
  document.getElementById('good-output').textContent = result.good;
  document.getElementById('bad-output').textContent = result.bad;
}

/**
 * Main generation function triggered by Generate button
 * Validates input and generates both versions
 */
function generate() {
  const { baseItems, descs, posMods, shuffleBase, shuffleBad, shufflePos, limit } = collectInputs();
  if (!baseItems.length) {
    alert('Please enter at least one base prompt item.');
    return;
  }
  const result = buildVersions(baseItems, descs, posMods, shuffleBase, shuffleBad, shufflePos, limit);
  displayOutput(result);
}

// Attach generate function to button click
document.getElementById('generate').addEventListener('click', generate);


/**
 * Initialize the UI with default selections
 * Populates textareas based on the initially selected dropdown options
 */
function initializeUI() {
  // Load lists and populate dropdowns
  loadLists();

  // Set up toggle buttons linked to hidden checkboxes
  document.querySelectorAll('.toggle-button').forEach(btn => {
    const target = btn.dataset.target;
    const checkbox = document.getElementById(target);
    if (!checkbox) return;
    // Reflect initial state
    btn.classList.toggle('active', checkbox.checked);
    btn.addEventListener('click', () => {
      checkbox.checked = !checkbox.checked;
      btn.classList.toggle('active', checkbox.checked);
      checkbox.dispatchEvent(new Event('change'));
    });
  });

  // Set up hide toggles that show/hide target elements
  document.querySelectorAll('input[type="checkbox"][data-targets]').forEach(cb => {
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

  // Copy buttons
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

// Initialize UI when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUI);
} else {
  // DOM is already loaded
  initializeUI();
}

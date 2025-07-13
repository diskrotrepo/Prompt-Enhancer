/*
 * Prompt Enhancer main script
 *
 * The file is intentionally monolithic so all logic is searchable in one place.
 * Functions are grouped by responsibility: side effect free helpers first,
 * then UI helpers, and finally initialization. When reviewing or modifying
 * code keep comments in sync with logic to aid debugging. Small consistent
 * improvements follow the **50% Rule**—each refinement boosts the odds that
 * future work succeeds.
 *
 * Applying the 50% Rule to Documentation:
 * - Layer multiple methods (TOC, section summaries, function purposes, line-by-line comments) to ensure >50% clarity per method, compounding to robust understanding.
 * - Diversify explanations: structural overviews for architecture, detailed comments for logic, examples for usage.
 * - This redundancy reinforces intent, like diverse token combinations in prompts.
 *
 * Detailed Table of Contents:
 * 1. Pure Utility Functions
 *    - Parsing and manipulation helpers (parseInput, countWords, etc.)
 *    - Core prompt building logic (applyModifierStack, buildVersions)
 * 2. List Management
 *    - Preset loading and population (populateSelect, loadLists)
 *    - Export/import and saving lists
 * 3. State Management
 *    - DOM interaction for state (getVal, setVal, loadFromDOM)
 *    - Export/import state
 * 4. Storage Handling
 *    - LocalStorage operations (saveLocal, loadLocal)
 *    - Data persistence (persist, loadPersisted)
 * 5. UI Controls
 *    - Input collection and output display (collectInputs, displayOutput)
 *    - Event handlers and setup (setupPresetListener, initializeUI)
 *    - Reusable id iteration (forEachId)
 *    - Watcher utilities (depthWatchIds)
 * 6. Initialization and Exports
 *    - IIFE setup and module exports
 */
(function (global) {
  "use strict";
// ======== Pure Utility Functions ========
// Section Purpose: Side-effect-free helpers for parsing, manipulating, and building prompts.
// These functions are pure to ensure predictability, following the 50% Rule by combining small, reliable operations.
// Structural Overview: Grouped utilities that avoid DOM or state changes, enabling easy testing and reuse.
// Section Summary: Provides foundational tools for text processing and prompt generation, used throughout the app.

  /**
   * Split a raw text block into individual items.
   * If keepDelim is true, punctuation is preserved and a trailing period is added when missing
   * so other code can treat each string as a sentence.
   * Purpose: Parse user input into arrays, handling delimiters flexibly for prompts and modifiers.
   * Usage Example: parseInput("item1, item2.", true) returns ["item1,", "item2."].
   * 50% Rule: Employs multiple strategies (normalization, splitting, trimming) for robust parsing; diverse methods ensure clarity.
   * @param {string} raw - Text entered by the user.
   * @param {boolean} [keepDelim=false] - Keep punctuation delimiters.
   * @returns {string[]} - Array of parsed items.
   */
  function parseInput(raw, keepDelim = false) {
    // Check for empty input
    if (!raw) return [];
    if (!keepDelim) {
      // Normalize delimiters to commas
      const normalized = raw.replace(/;/g, ',').replace(/\s*,\s*/g, ',');
      // Split, trim, and filter empty items
      return normalized
        .split(/[,\n]+/)
        .map(s => s.trim())
        .filter(Boolean);
    }
    // Handle delimiter preservation
    const normalized = raw.replace(/\r\n/g, '\n');
    const delims = [',', '.', ';', ':', '!', '?', '\n'];
    const items = [];
    let current = '';
    // Iterate through each character
    for (let i = 0; i < normalized.length; i++) {
      const ch = normalized[i];
      current += ch;
      if (delims.includes(ch)) {
        let natural = /[,.!:;?\n]/.test(ch);
        // Handle consecutive delimiters and spaces
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
    // Handle trailing item with period if needed
    if (current) {
      if (!/[,.!:;?\n]\s*$/.test(current)) {
        current += '. ';
      }
      items.push(current);
    }
    return items.filter(Boolean);
  }

  /**
   * Count how many words a string contains.
   * Trailing punctuation is ignored so "cat." counts as one word.
   * Purpose: Calculate word count for depth insertion and limits.
   * Usage Example: countWords("hello world.") returns 2.
   * 50% Rule: Cleans string via trim and replace for accurate counting; explained via example and purpose for reinforcement.
   * @param {string} str - Text to examine.
   * @returns {number} - Word count.
   */
  function countWords(str) {
    const cleaned = str.trim().replace(/[,.!:;?]$/, '');
    if (!cleaned) return 0;
    return cleaned.split(/\s+/).length;
  }

  /**
   * Parse a textarea of divider lines.
   * Empty lines are removed but whitespace is preserved.
   * Purpose: Split divider input into array for prompt separation.
   * Usage Example: parseDividerInput("line1\n\nline2") returns ["line1", "line2"].
   * 50% Rule: Simple split and filter; documented with example and line comments.
   * @param {string} raw - Raw divider text.
   * @returns {string[]} - Array of non-empty lines.
   */
  function parseDividerInput(raw) {
    if (!raw) return [];
    return raw.split(/\r?\n/).filter(line => line !== '');
  }

  /**
   * Convert a comma or space separated list into numeric indices.
   * Purpose: Parse order strings into index arrays for reordering.
   * Usage Example: parseOrderInput("1, 3") returns [1, 3].
   * 50% Rule: Uses split, map, filter for parsing; multiple docs reinforce usage.
   * @param {string} raw - Input string of indices.
   * @returns {number[]} - Array of parsed numbers.
   */
  function parseOrderInput(raw) {
    if (!raw) return [];
    return raw
      .split(/[,\s]+/)
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n));
  }

  /**
   * Reorder items according to an index array. If order is shorter than the
   * items list it cycles through.
   * Purpose: Apply custom ordering to arrays like modifiers.
   * Usage Example: applyOrder(["a", "b", "c"], [2, 0]) returns ["c", "a", "c"] (cycling).
   * 50% Rule: Modular arithmetic for cycling; example shows behavior.
   * @param {string[]} items - Array to reorder.
   * @param {number[]} order - Indices for reordering.
   * @returns {string[]} - Reordered array.
   */
  function applyOrder(items, order) {
    if (!Array.isArray(order) || !order.length) return items.slice();
    return items.map((_, i) => {
      const idx = order[i % order.length];
      return items[idx % items.length];
    });
  }

  /**
   * Insert a term into a phrase at a given word position. Punctuation at the
   * end is preserved and the term can be placed past the end (wraps around).
   * Purpose: Insert modifiers at specific depths in phrases.
   * Usage Example: insertAtDepth("hello world.", "beautiful", 1) returns "hello beautiful world.".
   * 50% Rule: Handles tail punctuation separately; wraps with modulo.
   * @param {string} phrase - Base phrase.
   * @param {string} term - Term to insert.
   * @param {number} depth - Word position to insert at.
   * @returns {string} - Modified phrase.
   */
  function insertAtDepth(phrase, term, depth) {
    if (!term) return phrase;
    const match = phrase.match(/([,.!:;?\n]\s*)$/);
    let tail = '';
    let body = phrase;
    if (match) {
      tail = match[1];
      body = phrase.slice(0, -tail.length).trim();
    } else {
      body = phrase.trim();
    }
    const words = body ? body.split(/\s+/) : [];
    const idx = depth % (words.length + 1);
    words.splice(idx, 0, term);
    return words.join(' ') + tail;
  }

  /** 
   * Randomize an array in place using Fisher-Yates.
   * Purpose: Shuffle arrays for random ordering.
   * Usage Example: shuffle([1,2,3]) might return [3,1,2].
   * 50% Rule: Standard algorithm with loop; in-place for efficiency.
   * @param {any[]} arr - Array to shuffle.
   * @returns {any[]} - Shuffled array (same reference).
   */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Trim two arrays to the same length by taking the shorter length from each.
   * Purpose: Equalize positive/negative prompt lengths.
   * Usage Example: equalizeLength([1,2,3], [a,b]) returns [[1,2], [a,b]].
   * 50% Rule: Simple min length; used for consistency in outputs.
   * @param {any[]} a - First array.
   * @param {any[]} b - Second array.
   * @returns {any[][]} - Pair of trimmed arrays.
   */
  function equalizeLength(a, b) {
    const len = Math.min(a.length, b.length);
    return [a.slice(0, len), b.slice(0, len)];
  }

  /**
   * Combine base items with one or more modifier lists. Modifiers may be
   * stacked so multiple sets are applied in sequence. Divider items are
   * inserted when the base list repeats. The return value is trimmed so the
   * cumulative string length does not exceed `limit`.
   * Purpose: Core logic to apply stacked modifiers to base items.
   * Usage: Internal to buildVersions; builds prompt arrays.
   * 50% Rule: Complex loop with length checks; documented via params and logic summary.
   * @param {string[]} baseItems - Base prompt items.
   * @param {string[]|string[][]} modifiers - Modifiers or stacked lists.
   * @param {number} limit - Max length for result.
   * @param {number} [stackSize=1] - Number of stacks.
   * @param {number[]|number[][]} [modOrders=null] - Orders for modifiers.
   * @param {boolean} [delimited=false] - If items are delimited.
   * @param {string[]} [dividers=[]] - Dividers to insert.
   * @param {number[]} [itemOrder=null] - Order for base items.
   * @param {number[]|number[][]} [depths=null] - Depths for insertions.
   * @returns {string[]} - Modified items array.
   */
  function applyModifierStack(
    baseItems,
    modifiers,
    limit,
    stackSize = 1,
    modOrders = null,
    delimited = false,
    dividers = [],
    itemOrder = null,
    depths = null
  ) {
    const count = stackSize > 0 ? stackSize : 1;
    const modLists = Array.isArray(modifiers[0]) ? modifiers : Array(count).fill(modifiers);
    const orders = [];
    if (Array.isArray(modOrders) && Array.isArray(modOrders[0])) {
      for (let i = 0; i < count; i++) {
        const mods = modLists[i % modLists.length];
        const ord = modOrders[i % modOrders.length];
        orders.push(ord ? applyOrder(mods, ord) : mods.slice());
      }
    } else {
      for (let i = 0; i < count; i++) {
        const mods = modLists[i % modLists.length];
        const orderedMods = modOrders ? applyOrder(mods, modOrders) : mods.slice();
        orders.push(orderedMods);
      }
    }
    const dividerPool = dividers.slice();
    let items = baseItems.slice();
    if (itemOrder) items = applyOrder(items, itemOrder);
    let depthPool = null;
    if (Array.isArray(depths)) {
      depthPool = Array.isArray(depths[0]) ? depths.map(d => d.slice()) : depths.slice();
    }
    const result = [];
    let idx = 0;
    let divIdx = 0;
    while (true) {
      const needDivider = idx > 0 && idx % items.length === 0 && dividerPool.length;
      let term = items[idx % items.length];
      const inserted = [];
      orders.forEach((mods, sidx) => {
        const mod = mods[idx % mods.length];
        let depth = 0;
        if (depthPool) {
          if (Array.isArray(depthPool[sidx])) {
            const arr = depthPool[sidx];
            depth = arr[idx % arr.length] || 0;
          } else {
            depth = depthPool[idx % depthPool.length] || 0;
          }
        }
        const offset = inserted.filter(d => d <= depth).length;
        const adj = depth + offset;
        if (mod) {
          term = insertAtDepth(term, mod, adj);
          inserted.push(adj);
        }
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

  /**
   * Build negative versions by inserting negative modifiers into already
   * modified positive terms. This keeps divider placement consistent between
   * positive and negative outputs.
   * Purpose: Apply negative modifiers on top of positive ones for consistency.
   * Usage: Internal to buildVersions when includePosForNeg is true.
   * 50% Rule: Mirrors applyModifierStack logic for negatives; example in usage.
   * @param {string[]} posTerms - Positive terms to modify.
   * @param {string[]|string[][]} negMods - Negative modifiers.
   * @param {number} limit - Max length.
   * @param {number} [stackSize=1] - Stack size.
   * @param {number[]|number[][]} [modOrders=null] - Orders.
   * @param {boolean} [delimited=false] - Delimited flag.
   * @param {string[]} [dividers=[]] - Dividers.
   * @param {number[]} [itemOrder=null] - Item order.
   * @param {number[]|number[][]} [depths=null] - Depths.
   * @returns {string[]} - Negative terms array.
   */
  function applyNegativeOnPositive(
    posTerms,
    negMods,
    limit,
    stackSize = 1,
    modOrders = null,
    delimited = false,
    dividers = [],
    itemOrder = null,
    depths = null
  ) {
    const count = stackSize > 0 ? stackSize : 1;
    const modLists = Array.isArray(negMods[0]) ? negMods : Array(count).fill(negMods);
    const orders = [];
    if (Array.isArray(modOrders) && Array.isArray(modOrders[0])) {
      for (let i = 0; i < count; i++) {
        const mods = modLists[i % modLists.length];
        const ord = modOrders[i % modOrders.length];
        orders.push(ord ? applyOrder(mods, ord) : mods.slice());
      }
    } else {
      for (let i = 0; i < count; i++) {
        const mods = modLists[i % modLists.length];
        const orderedMods = modOrders ? applyOrder(mods, modOrders) : mods.slice();
        orders.push(orderedMods);
      }
    }
    const dividerSet = new Set(dividers);
    const result = [];
    let modIdx = 0;
    let items = posTerms.slice();
    if (itemOrder) items = applyOrder(items, itemOrder);
    let depthPool = null;
    if (Array.isArray(depths)) {
      depthPool = Array.isArray(depths[0]) ? depths.map(d => d.slice()) : depths.slice();
    }
    for (let i = 0; i < items.length; i++) {
      const base = items[i];
      if (dividerSet.has(base)) {
        const candidate =
          (result.length ? result.join(delimited ? '' : ', ') + (delimited ? '' : ', ') : '') +
          base;
        if (candidate.length > limit) break;
        result.push(base);
        continue;
      }
      let term = base;
      const inserted = [];
      orders.forEach((mods, sidx) => {
        const mod = mods[modIdx % mods.length];
        let depth = 0;
        if (depthPool) {
          if (Array.isArray(depthPool[sidx])) {
            const arr = depthPool[sidx];
            depth = arr[modIdx % arr.length] || 0;
          } else {
            depth = depthPool[modIdx % depthPool.length] || 0;
          }
        }
        const offset = inserted.filter(d => d <= depth).length;
        const adj = depth + offset;
        if (mod) {
          term = insertAtDepth(term, mod, adj);
          inserted.push(adj);
        }
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
   * High level builder that returns both positive and negative prompt strings.
   * It delegates to applyModifierStack and optionally applyNegativeOnPositive.
   * Purpose: Generate final positive and negative prompts from inputs.
   * Usage Example: buildVersions(items, negMods, posMods, 1000) returns {positive: '...', negative: '...'}.
   * 50% Rule: Orchestrates stacking and equalization; trims for limits.
   * @param {string[]} items - Base items.
   * @param {string[]|string[][]} negMods - Negative modifiers.
   * @param {string[]|string[][]} posMods - Positive modifiers.
   * @param {number} limit - Max length.
   * @param {boolean} [includePosForNeg=false] - Include positives in negatives.
   * @param {string[]} [dividers=[]] - Dividers.
   * @param {boolean} [shuffleDividers=true] - Shuffle dividers.
   * @param {number} [posStackSize=1] - Positive stack size.
   * @param {number} [negStackSize=1] - Negative stack size.
   * @param {number[]|number[][]} [posDepths=null] - Positive depths.
   * @param {number[]|number[][]} [negDepths=null] - Negative depths.
   * @param {number[]} [baseOrder=null] - Base order.
   * @param {number[]|number[][]} [posOrder=null] - Positive order.
   * @param {number[]|number[][]} [negOrder=null] - Negative order.
   * @param {number[]} [dividerOrder=null] - Divider order.
   * @returns {{positive: string, negative: string}} - Generated prompts.
   */
  function buildVersions(
    items,
    negMods,
    posMods,
    limit,
    includePosForNeg = false,
    dividers = [],
    shuffleDividers = true,
    posStackSize = 1,
    negStackSize = 1,
    posDepths = null,
    negDepths = null,
    baseOrder = null,
    posOrder = null,
    negOrder = null,
    dividerOrder = null
  ) {
    if (!items.length) {
      return { positive: '', negative: '' };
    }
    if (Array.isArray(baseOrder)) items = applyOrder(items, baseOrder);
    const delimited = /[,.!:;?\n]\s*$/.test(items[0]);
    let dividerPool = dividers.map(d => (d.startsWith('\n') ? d : '\n' + d));
    if (Array.isArray(dividerOrder)) dividerPool = applyOrder(dividerPool, dividerOrder);
    if (dividerPool.length && shuffleDividers && !dividerOrder) shuffle(dividerPool);
    const posTerms = applyModifierStack(
      items,
      posMods,
      limit,
      posStackSize,
      posOrder,
      delimited,
      dividerPool,
      baseOrder,
      posDepths
    );
    let useNegDepths = negDepths;
    const negTerms = includePosForNeg
      ? applyNegativeOnPositive(
          posTerms,
          negMods,
          limit,
          negStackSize,
          negOrder,
          delimited,
          dividerPool,
          null,
          useNegDepths
        )
      : applyModifierStack(
          items,
          negMods,
          limit,
          negStackSize,
          negOrder,
          delimited,
          dividerPool,
          baseOrder,
          negDepths
        );
    const [trimNeg, trimPos] = equalizeLength(negTerms, posTerms);
    return {
      positive: trimPos.join(delimited ? '' : ', '),
      negative: trimNeg.join(delimited ? '' : ', ')
    };
  }

  /**
   * Normalize a block of lyrics text.
   * All punctuation is stripped, optionally removing parentheses or brackets,
   * and random spacing up to `maxSpaces` is introduced between words.
   * Purpose: Process lyrics for use in prompts, adding randomness.
   * Usage Example: processLyrics("hello (world)", 2, true) might return "hello  world".
   * 50% Rule: Regex cleaning and random spacing; handles options.
   * @param {string} text - Input lyrics.
   * @param {number} maxSpaces - Max spaces between words.
   * @param {boolean} [removeParens=false] - Remove parentheses.
   * @param {boolean} [removeBrackets=false] - Remove brackets.
   * @returns {string} - Processed lyrics.
   */
  function processLyrics(text, maxSpaces, removeParens = false, removeBrackets = false) {
    if (!text) return '';
    const limit = parseInt(maxSpaces, 10);
    const max = !isNaN(limit) && limit > 0 ? limit : 1;
    let cleaned = text.toLowerCase();
    if (removeParens) cleaned = cleaned.replace(/\([^()]*\)/g, ' ');
    if (removeBrackets) cleaned = cleaned.replace(/\[[^\]]*\]|\{[^}]*\}|<[^>]*>/g, ' ');
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

  const utils = {
    parseInput,
    countWords,
    parseDividerInput,
    parseOrderInput,
    applyOrder,
    insertAtDepth,
    shuffle,
    equalizeLength,
    applyModifierStack,
    applyNegativeOnPositive,
    buildVersions,
    processLyrics
  };

// ======== List Management ========
// Section Purpose: Manage preset lists for modifiers, lengths, etc.
// Structures data for easy access and UI population, using 50% Rule via redundant checks and deep copies.
// Structural Overview: Initializes preset maps from global lists, handles loading/saving.
// Section Summary: Centralizes preset handling for reusability across UI and logic.

  let NEG_PRESETS = {};
  let POS_PRESETS = {};
  let LENGTH_PRESETS = {};
  let DIVIDER_PRESETS = {};
  let BASE_PRESETS = {};
  let LYRICS_PRESETS = {};
  let ORDER_PRESETS = {};

  let LISTS;
  if (typeof DEFAULT_LIST !== 'undefined' && Array.isArray(DEFAULT_LIST.presets)) {
    LISTS = JSON.parse(JSON.stringify(DEFAULT_LIST));
  } else if (
    typeof NEGATIVE_LISTS !== 'undefined' ||
    typeof POSITIVE_LISTS !== 'undefined' ||
    typeof LENGTH_LISTS !== 'undefined'
  ) {
    LISTS = { presets: [] };
    if (typeof NEGATIVE_LISTS !== 'undefined') {
      NEGATIVE_LISTS.presets.forEach(p => LISTS.presets.push({ ...p, type: 'negative' }));
    }
    if (typeof POSITIVE_LISTS !== 'undefined') {
      POSITIVE_LISTS.presets.forEach(p => LISTS.presets.push({ ...p, type: 'positive' }));
    }
    if (typeof LENGTH_LISTS !== 'undefined') {
      LENGTH_LISTS.presets.forEach(p => LISTS.presets.push({ ...p, type: 'length' }));
    }
  } else {
    LISTS = { presets: [] };
  }

  /**
   * Fill a <select> element with options derived from preset objects.
   * The first preset is selected by default for convenience.
   * Purpose: Populate dropdowns with preset titles.
   * Usage: Called in loadLists to update UI selects.
   * 50% Rule: Loops with conditional selection; ensures non-empty defaults.
   * @param {HTMLSelectElement} selectEl - Select element to populate.
   * @param {Object[]} presets - Array of preset objects.
   */
  function populateSelect(selectEl, presets) {
    selectEl.innerHTML = '';
    presets.forEach((preset, index) => {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.title;
      if (index === 0 || (selectEl.value === '' && preset.items && preset.items.length > 0)) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
  }

  /**
   * Populate a depth selection dropdown. Depth presets allow inserting
   * modifiers at a specific word index.
   * Purpose: Set up options for depth selection including presets.
   * Usage: Called in loadLists for depth selects.
   * 50% Rule: Static options plus dynamic presets; simple loop.
   * @param {HTMLSelectElement} selectEl - Select to populate.
   * @param {Object[]} presets - Preset objects.
   */
  function populateDepthSelect(selectEl, presets) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    const opts = [
      { id: 'prepend', title: 'Prepend' },
      { id: 'append', title: 'Append' },
      { id: 'random', title: 'Random Depth' }
    ];
    presets.forEach(p => opts.push({ id: p.id, title: p.title }));
    opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.title;
      selectEl.appendChild(opt);
    });
  }

  /**
   * Initialize preset maps from the LISTS structure. This also rebuilds the
   * dropdown menus in the UI when presets change.
   * Purpose: Load and categorize presets, update UI selects.
   * Usage: Called on init and after imports.
   * 50% Rule: Filters by type with arrays; calls populate for each.
   * No params/returns; side-effect on global presets and UI.
   */
  function loadLists() {
    NEG_PRESETS = {};
    POS_PRESETS = {};
    LENGTH_PRESETS = {};
    DIVIDER_PRESETS = {};
    BASE_PRESETS = {};
    LYRICS_PRESETS = {};
    const neg = [];
    const pos = [];
    const len = [];
    const divs = [];
    const base = [];
    const lyrics = [];
    const order = [];
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
        } else if (p.type === 'lyrics') {
          LYRICS_PRESETS[p.id] = p.items || [];
          lyrics.push(p);
        } else if (p.type === 'order') {
          ORDER_PRESETS[p.id] = p.items || [];
          order.push(p);
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
    const lyricsSelect = document.getElementById('lyrics-select');
    if (lyricsSelect) populateSelect(lyricsSelect, lyrics);
    const posDepthSelect = document.getElementById('pos-depth-select');
    if (posDepthSelect) populateDepthSelect(posDepthSelect, order);
    const negDepthSelect = document.getElementById('neg-depth-select');
    if (negDepthSelect) populateDepthSelect(negDepthSelect, order);
  }

  /** 
   * Serialize current preset lists into JSON.
   * Purpose: Export lists for saving or sharing.
   * Usage: Called in exportData.
   * 50% Rule: Simple stringify; no params.
   * @returns {string} - JSON string of lists.
   */
  function exportLists() {
    return JSON.stringify(LISTS, null, 2);
  }

  /**
   * Import preset lists from an object. When additive is true existing lists
   * are merged, otherwise they are replaced.
   * Purpose: Load external lists, optionally merging.
   * Usage Example: importLists(obj, true) merges with existing.
   * 50% Rule: Checks and merges with findIndex; cleans items.
   * @param {Object} obj - Lists object to import.
   * @param {boolean} [additive=false] - Merge mode.
   */
  function importLists(obj, additive = false) {
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.presets)) return;
    if (!additive) {
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
          e => e.id === p.id && e.type === p.type && e.title === p.title
        );
        const preset = {
          id: p.id,
          title: p.title,
          type: p.type,
          items: Array.isArray(p.items) ? p.items : []
        };
        if (idx !== -1) {
          existing[idx] = preset;
        } else {
          existing.push(preset);
        }
      });
      LISTS.presets = existing;
    }
    loadLists();
  }

  /**
   * Save the list typed into the UI back into the preset store. Prompts the
   * user for a preset name.
   * Purpose: Persist user-entered lists as presets.
   * Usage: Called on save button clicks.
   * 50% Rule: Handles different types with map; updates UI.
   * @param {string} type - List type (e.g., 'positive').
   * @param {number} [index=1] - Stack index.
   */
  function saveList(type, index = 1) {
    const map = {
      base: { select: 'base-select', input: 'base-input', store: BASE_PRESETS },
      negative: { select: 'neg-select', input: 'neg-input', store: NEG_PRESETS },
      positive: { select: 'pos-select', input: 'pos-input', store: POS_PRESETS },
      length: { select: 'length-select', input: 'length-input', store: LENGTH_PRESETS },
      divider: { select: 'divider-select', input: 'divider-input', store: DIVIDER_PRESETS },
      lyrics: { select: 'lyrics-select', input: 'lyrics-input', store: LYRICS_PRESETS },
      order: { select: 'pos-depth-select', input: 'pos-depth-input', store: ORDER_PRESETS }
    };
    const cfg = map[type];
    if (!cfg) return;
    const selId = index === 1 ? cfg.select : `${cfg.select}-${index}`;
    const inpId = index === 1 ? cfg.input : `${cfg.input}-${index}`;
    const sel = document.getElementById(selId);
    const inp = document.getElementById(inpId);
    if (!sel || !inp) return;
    const name = prompt('Enter list name', sel.value);
    if (!name) return;
    let items;
    if (type === 'divider') {
      items = utils ? utils.parseDividerInput(inp.value) : [];
    } else if (type === 'lyrics') {
      items = [inp.value];
    } else {
      items = utils ? utils.parseInput(inp.value) : [];
    }
    let preset = LISTS.presets.find(p => p.id === name && p.type === type);
    if (!preset) {
      preset = { id: name, title: name, type, items };
      LISTS.presets.push(preset);
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      document
        .querySelectorAll(`select[id^="${cfg.select}"]`)
        .forEach(s => {
          if (!s.querySelector(`option[value="${name}"]`)) {
            s.appendChild(opt.cloneNode(true));
          }
        });
    } else {
      preset.items = items;
    }
    cfg.store[name] = items;
    sel.value = name;
  }

  const lists = {
    get NEG_PRESETS() { return NEG_PRESETS; },
    get POS_PRESETS() { return POS_PRESETS; },
    get LENGTH_PRESETS() { return LENGTH_PRESETS; },
    get DIVIDER_PRESETS() { return DIVIDER_PRESETS; },
    get BASE_PRESETS() { return BASE_PRESETS; },
    get LYRICS_PRESETS() { return LYRICS_PRESETS; },
    get ORDER_PRESETS() { return ORDER_PRESETS; },
    loadLists,
    exportLists,
    importLists,
    saveList
  };

// ======== State Management ========
// Section Purpose: Handle application state synchronization with DOM.
// Ensures consistent state loading/saving, layering getters/setters for reliability.
// Structural Overview: Uses global State object for form values.
// Section Summary: Abstracts form I/O for export/import and persistence.

  const State = {};

  /**
   * Helper to read a form element's value, abstracting checkbox state.
   * Purpose: Get value from input elements uniformly.
   * Usage: Internal to loadFromDOM.
   * 50% Rule: Handles checkbox specially; simple.
   * @param {HTMLElement} el - Form element.
   * @returns {any} - Value or undefined.
   */
  function getVal(el) {
    if (!el) return undefined;
    if (el.type === 'checkbox') return el.checked;
    return el.value;
  }

  /**
   * Mirror of getVal that writes a value back to the element and dispatches a
   * change event so listeners update.
   * Purpose: Set value and trigger updates.
   * Usage: Internal to applyToDOM.
   * 50% Rule: Dispatches event for reactivity.
   * @param {HTMLElement} el - Form element.
   * @param {any} val - Value to set.
   */
  function setVal(el, val) {
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = !!val;
    } else {
      el.value = val != null ? val : '';
    }
    el.dispatchEvent(new Event('change'));
  }

  /** 
   * List all form control ids present in the document.
   * Purpose: Get ids for state operations.
   * Usage: In loadFromDOM and applyToDOM.
   * 50% Rule: Queries and maps; environment check.
   * @returns {string[]} - Array of ids.
   */
  function getFieldIds() {
    if (typeof document === 'undefined') return [];
    return Array.from(
      document.querySelectorAll('input[id], textarea[id], select[id]')
    ).map(el => el.id);
  }

  /** 
   * Capture the current form state into the State object.
   * Purpose: Sync DOM to State.
   * Usage: Before exports.
   * 50% Rule: Loops over ids; assigns to State.
   * @returns {Object} - State object.
   */
  function loadFromDOM() {
    const obj = {};
    getFieldIds().forEach(id => {
      const el = typeof document !== 'undefined' && document.getElementById(id);
      if (el) obj[id] = getVal(el);
    });
    Object.keys(State).forEach(k => delete State[k]);
    Object.assign(State, obj);
    return obj;
  }

  /** 
   * Populate form controls from a state object.
   * Purpose: Apply state to DOM.
   * Usage: On imports.
   * 50% Rule: Loops and sets values.
   * @param {Object} state - State to apply.
   */
  function applyToDOM(state) {
    if (!state) return;
    getFieldIds().forEach(id => {
      if (Object.prototype.hasOwnProperty.call(state, id)) {
        const el = typeof document !== 'undefined' && document.getElementById(id);
        setVal(el, state[id]);
      }
    });
    Object.keys(State).forEach(k => delete State[k]);
    Object.assign(State, state);
  }

  /** 
   * Serialize State as JSON.
   * Purpose: Export state.
   * Usage: In exportData.
   * 50% Rule: Simple stringify.
   * @returns {string} - JSON string.
   */
  function exportState() {
    return JSON.stringify(State, null, 2);
  }

  /**
   * Load state from JSON or object and apply to the DOM. Invalid data is
   * ignored silently.
   * Purpose: Import and apply state.
   * Usage: On load.
   * 50% Rule: Error handling; applies to DOM.
   * @param {string|Object} obj - JSON or object.
   */
  function importState(obj) {
    if (!obj) return;
    let data = obj;
    if (typeof obj === 'string') {
      try {
        data = JSON.parse(obj);
      } catch (err) {
        return;
      }
    }
    if (typeof data !== 'object') return;
    applyToDOM(data);
  }

  const state = { State, loadFromDOM, applyToDOM, exportState, importState };

// ======== Storage Handling ========
// Section Purpose: Persist data to localStorage.
// Combines error handling and fallbacks to apply 50% Rule for robust storage.
// Structural Overview: Uses KEY for storage; handles JSON.
// Section Summary: Manages persistence for lists and state.

  const KEY = 'promptEnhancerData';

  /** 
   * Persist data to localStorage. Errors are ignored.
   * Purpose: Save data safely.
   * Usage: In persist.
   * 50% Rule: Try-catch ignore.
   * @param {Object} data - Data to save.
   */
  function saveLocal(data) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      /* ignore */
    }
  }

  /** 
   * Retrieve persisted data from localStorage.
   * Purpose: Load saved data.
   * Usage: In loadPersisted.
   * 50% Rule: Try-catch return null.
   * @returns {Object|null} - Loaded data or null.
   */
  function loadLocal() {
    if (typeof localStorage === 'undefined') return null;
    try {
      const json = localStorage.getItem(KEY);
      return json ? JSON.parse(json) : null;
    } catch (err) {
      return null;
    }
  }

  /** 
   * Combine lists and form state into a single JSON string.
   * Purpose: Full export.
   * Usage: On save.
   * 50% Rule: Combines exports.
   * @returns {string} - JSON string.
   */
  function exportData() {
    const listData = JSON.parse(lists.exportLists());
    state.loadFromDOM();
    const stateData = JSON.parse(state.exportState());
    return JSON.stringify({ lists: listData, state: stateData }, null, 2);
  }

  /**
   * Load list and state data from an object or JSON string. Unknown fields are
   * ignored.
   * Purpose: Full import.
   * Usage: On load.
   * 50% Rule: Parses and imports parts.
   * @param {string|Object} obj - Data to import.
   */
  function importData(obj) {
    if (!obj) return;
    let data = obj;
    if (typeof obj === 'string') {
      try {
        data = JSON.parse(obj);
      } catch (err) {
        return;
      }
    }
    if (typeof data !== 'object') return;
    if (data.lists) lists.importLists(data.lists);
    if (data.state) {
      state.importState(data.state);
      // second pass to populate elements created during import
      state.applyToDOM(data.state);
    }
    saveLocal(data);
  }

  /** 
   * Save the current state to localStorage.
   * Purpose: Persist on changes.
   * Usage: On beforeunload.
   * 50% Rule: Calls export and save.
   */
  function persist() {
    const json = exportData();
    saveLocal(JSON.parse(json));
  }

  /** 
   * Load state from localStorage or fallback defaults.
   * Purpose: Init from storage.
   * Usage: In initializeUI.
   * 50% Rule: Fallback to DEFAULT_DATA.
   */
  function loadPersisted() {
    const stored = loadLocal();
    if (stored) {
      importData(stored);
      return;
    }
    if (typeof DEFAULT_DATA !== 'undefined') {
      importData(DEFAULT_DATA);
    }
  }

  /** 
   * Clear localStorage and reload defaults.
   * Purpose: Reset data.
   * Usage: On reset button.
   * 50% Rule: Remove and import default.
   */
  function resetData() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(KEY);
      } catch (err) {
        /* ignore */
      }
    }
    if (typeof DEFAULT_DATA !== 'undefined') {
      importData(DEFAULT_DATA);
    }
  }

  const storage = { exportData, importData, persist, loadPersisted, resetData };

// ======== UI Controls ========
// Section Purpose: Handle user interface interactions and event setups.
// Layers multiple setup functions and event listeners for comprehensive UI control.
// Structural Overview: Many setup functions for buttons, toggles, etc.
// Section Summary: Manages all DOM interactions and event binding.

  /** 
   * Infer the section prefix from a control id.
   * Purpose: Extract prefix for dynamic ids.
   * Usage: Internal utility.
   * 50% Rule: Regex match.
   * @param {string} id - Element id.
   * @returns {string} - Prefix.
   */
  function guessPrefix(id) {
    const m = id.match(/^([a-z]+)(?:-(?:order|depth))?-select/);
    return m ? m[1] : id.replace(/-select.*$/, '');
  }

  /**
   * Gather all select/input pairs that share a prefix and base id. Useful for
   * iterating over stacked modifiers.
   * Purpose: Collect controls for stacks.
   * Usage: In various setups.
   * 50% Rule: Loop until no more.
   * @param {string} prefix - Section prefix.
   * @param {string} base - Base id part.
   * @returns {Object[]} - Array of {select, input}.
   */
  function gatherControls(prefix, base) {
    const results = [];
    forEachId(`${prefix}-${base}-select`, (sel, idx) => {
      const inp = document.getElementById(`${prefix}-${base}-input${idx === 1 ? '' : '-' + idx}`);
      results.push({ select: sel, input: inp });
    });
    return results;
  }

  /**
   * Iterate over sequentially numbered ids, invoking a callback for each.
   * Example: forEachId('pos-hide', cb) visits pos-hide, pos-hide-2, ...
   * Purpose: Consolidate repeated while loops for dynamic controls.
   * Usage: In setupSectionHide, setupSectionOrder, and other loops.
   * 50% Rule: Simple iteration with example for clarity.
   * @param {string} baseId - Id prefix for index 1.
   * @param {Function} fn - Callback receiving element and index.
   */
  function forEachId(baseId, fn) {
    let i = 1;
    let id = baseId;
    let el = document.getElementById(id);
    if (!el) {
      id = `${baseId}-1`;
      el = document.getElementById(id);
    }
    while (el) {
      fn(el, i);
      i++;
      id = `${baseId}-${i}`;
      el = document.getElementById(id);
    }
  }

  /** 
   * Retrieve modifiers for a stack index, applying any user-supplied order.
   * Purpose: Get ordered mods for building.
   * Usage: In collectInputs.
   * 50% Rule: Parses and applies order.
   * @param {string} prefix - Prefix.
   * @param {number} [idx=1] - Index.
   * @returns {string[]} - Ordered modifiers.
   */
  function getOrderedMods(prefix, idx = 1) {
    const inp = document.getElementById(
      `${prefix}-input${idx === 1 ? '' : '-' + idx}`
    );
    const mods = utils.parseInput(inp?.value || '');
    const ordEl = document.getElementById(
      `${prefix}-order-input${idx === 1 ? '' : '-' + idx}`
    );
    const ord = utils.parseOrderInput(ordEl?.value || '');
    return ord.length ? utils.applyOrder(mods, ord) : mods;
  }

  /** 
   * Word counts for each base prompt item.
   * Purpose: Compute base word counts for depths.
   * Usage: In computeDepthCounts.
   * 50% Rule: Maps parse and count.
   * @returns {number[]} - Array of counts.
   */
  function baseCounts() {
    const baseInput = document.getElementById('base-input');
    return utils
      .parseInput(baseInput?.value || '', true)
      .map(b => utils.countWords(b));
  }

  /** 
   * How many words of positive modifiers would precede index i.
   * Purpose: Calculate positive word impact for neg depths.
   * Usage: In computeDepthCounts.
   * 50% Rule: Loops over stacks.
   * @param {number} i - Index.
   * @returns {number} - Total words.
   */
  function getTotalPosWords(i) {
    const stackOn = document.getElementById('pos-stack')?.checked;
    const stackSize = parseInt(
      document.getElementById('pos-stack-size')?.value || '1',
      10
    );
    const count = stackOn ? stackSize : 1;
    let total = 0;
    for (let s = 1; s <= count; s++) {
      const mods = getOrderedMods('pos', s);
      if (!mods.length) continue;
      total += utils.countWords(mods[i % mods.length]);
    }
    return total;
  }

  /**
   * Determine insertion depths for modifiers so negative depth calculations
   * know where the base phrase ends.
   * Purpose: Compute word counts for depth insertions.
   * Usage: In setupDepthControl.
   * 50% Rule: Includes positives if needed and respects base ordering.
   * @param {string} prefix - Prefix (pos/neg).
   * @param {number} [idx=1] - Index.
   * @returns {number[]} - Array of counts.
   */
  function computeDepthCounts(prefix, idx = 1) {
    let bases = baseCounts();
    // Apply base order so counts align with current item sequence
    const ord = utils.parseOrderInput(
      document.getElementById('base-order-input')?.value || ''
    );
    if (ord.length) bases = utils.applyOrder(bases, ord);
    if (!bases.length) return [];
    const mods = getOrderedMods(prefix, idx);
    const includePos =
      prefix === 'neg' &&
      document.getElementById('neg-include-pos')?.checked;
    const len = mods.length || bases.length;
    const counts = [];
    for (let i = 0; i < len; i++) {
      let total = bases[i % bases.length];
      if (includePos) total += getTotalPosWords(i);
      counts.push(total);
    }
    return counts;
  }

  /** 
   * Load preset values into an input when the associated select changes.
   * Purpose: Apply selected preset to input.
   * Usage: In setupPresetListener.
   * 50% Rule: Handles different types.
   * @param {HTMLSelectElement} selectEl - Select.
   * @param {HTMLElement} inputEl - Input.
   * @param {string|Object} presetsOrType - Type or presets.
   */
  function applyPreset(selectEl, inputEl, presetsOrType) {
    let presets = presetsOrType;
    if (typeof presetsOrType === 'string') {
      if (presetsOrType === 'negative') {
        presets = lists.NEG_PRESETS;
      } else if (presetsOrType === 'positive') {
        presets = lists.POS_PRESETS;
      } else if (presetsOrType === 'length') {
        presets = lists.LENGTH_PRESETS;
      } else if (presetsOrType === 'divider') {
        presets = lists.DIVIDER_PRESETS;
      } else if (presetsOrType === 'base') {
        presets = lists.BASE_PRESETS;
      } else if (presetsOrType === 'lyrics') {
        presets = lists.LYRICS_PRESETS;
      } else {
        presets = {};
      }
    }
    const key = selectEl.value;
    const list = presets[key] || [];
    if (inputEl.tagName === 'TEXTAREA') {
      const sep = presetsOrType === 'divider' || presets === lists.DIVIDER_PRESETS ? '\n' : ', ';
      inputEl.value = list.join(sep);
    } else {
      inputEl.value = list[0] || '';
    }
    inputEl.disabled = false;
    inputEl.dispatchEvent(new Event('input'));
    inputEl.dispatchEvent(new Event('change'));
  }

  /** 
   * Wire up a preset select so the input updates on change.
   * Purpose: Add listener for preset application.
   * Usage: In initializeUI.
   * 50% Rule: Event listener.
   * @param {string} selectId - Select id.
   * @param {string} inputId - Input id.
   * @param {string} type - Type.
   */
  function setupPresetListener(selectId, inputId, type) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    if (!select || !input) return;
    select.addEventListener('change', () => applyPreset(select, input, type));
  }

  /**
   * Gather all user input from the page and normalize it for buildVersions.
   * Purpose: Collect and parse all form inputs.
   * Usage: In generate.
   * 50% Rule: Handles stacking, parses all fields.
   * @returns {Object} - Input object for buildVersions.
   */
  function collectInputs() {
    const baseItems = utils.parseInput(document.getElementById('base-input').value, true);
    function collectLists(prefix, count) {
      const result = [];
      for (let i = 1; i <= count; i++) {
        const id = `${prefix}-input${i === 1 ? '' : '-' + i}`;
        const el = document.getElementById(id);
        result.push(utils.parseInput(el?.value || ''));
      }
      return result;
    }

    const posStackOn = document.getElementById('pos-stack').checked;
    const posStackSize = parseInt(document.getElementById('pos-stack-size')?.value || '1', 10);
    const negStackOn = document.getElementById('neg-stack').checked;
    const negStackSize = parseInt(document.getElementById('neg-stack-size')?.value || '1', 10);

    const posMods = posStackOn ? collectLists('pos', posStackSize) : utils.parseInput(document.getElementById('pos-input').value);
    const negMods = negStackOn ? collectLists('neg', negStackSize) : utils.parseInput(document.getElementById('neg-input').value);
    const includePosForNeg = document.getElementById('neg-include-pos').checked;
    const dividerMods = utils.parseDividerInput(document.getElementById('divider-input')?.value || '');
    const shuffleDividers = document.getElementById('divider-shuffle')?.checked;
    const lengthSelect = document.getElementById('length-select');
    const lengthInput = document.getElementById('length-input');
    let limit = parseInt(lengthInput.value, 10);
    if (isNaN(limit) || limit <= 0) {
      const preset = lists.LENGTH_PRESETS[lengthSelect.value];
      limit = preset ? parseInt(preset[0], 10) : 1000;
      lengthInput.value = limit;
    }
    function collectDepths(prefix, count) {
      const result = [];
      for (let i = 1; i <= count; i++) {
        const id = `${prefix}-depth-input${i === 1 ? '' : '-' + i}`;
        const el = document.getElementById(id);
        result.push(utils.parseOrderInput(el?.value || ''));
      }
      return result;
    }

    const rawPosDepths = collectDepths('pos', posStackOn ? posStackSize : 1);
    const posDepths = posStackOn ? rawPosDepths : rawPosDepths[0];
    const rawNegDepths = collectDepths('neg', negStackOn ? negStackSize : 1);
    const negDepths = negStackOn ? rawNegDepths : rawNegDepths[0];
    const baseOrder = utils.parseOrderInput(document.getElementById('base-order-input')?.value || '');
    function collectOrders(prefix, count) {
      const result = [];
      for (let i = 1; i <= count; i++) {
        const id = `${prefix}-order-input${i === 1 ? '' : '-' + i}`;
        const el = document.getElementById(id);
        result.push(utils.parseOrderInput(el?.value || ''));
      }
      return result;
    }

    const posOrder = collectOrders('pos', posStackOn ? posStackSize : 1);
    const negOrder = collectOrders('neg', negStackOn ? negStackSize : 1);
    const dividerOrder = utils.parseOrderInput(document.getElementById('divider-order-input')?.value || '');
    return {
      baseItems,
      negMods,
      posMods,
      posStackOn,
      posStackSize,
      negStackOn,
      negStackSize,
      limit,
      includePosForNeg,
      dividerMods,
      shuffleDividers,
      dividerOrder,
      posDepths,
      negDepths,
      baseOrder,
      posOrder,
      negOrder
    };
  }

  /** 
   * Show generated prompt strings in the output fields.
   * Purpose: Update output textareas.
   * Usage: In generate.
   * 50% Rule: Simple set textContent.
   * @param {{positive: string, negative: string}} result - Prompts.
   */
  function displayOutput(result) {
    document.getElementById('positive-output').textContent = result.positive;
    document.getElementById('negative-output').textContent = result.negative;
  }

  /**
   * Main click handler for the Generate button. Reads inputs, builds prompts
   * and updates the UI. Alerts if no base items were entered.
   * Purpose: Orchestrate generation.
   * Usage: On generate click.
   * 50% Rule: Calls collect, build, display; handles lyrics too.
   */
  function generate() {
    rerollRandomOrders();
    const {
      baseItems,
      negMods,
      posMods,
      posStackOn,
      posStackSize,
      negStackOn,
      negStackSize,
      limit,
      includePosForNeg,
      dividerMods,
      shuffleDividers,
      dividerOrder,
      posDepths,
      negDepths,
      baseOrder,
      posOrder,
      negOrder
    } = collectInputs();
    if (!baseItems.length) {
      alert('Please enter at least one base prompt item.');
      return;
    }
    const dividers = dividerMods.length ? dividerMods : [];
    const result = utils.buildVersions(
      baseItems,
      negMods,
      posMods,
      limit,
      includePosForNeg,
      dividers,
      shuffleDividers,
      posStackOn ? posStackSize : 1,
      negStackOn ? negStackSize : 1,
      posDepths,
      negDepths,
      baseOrder,
      posOrder,
      negOrder,
      dividerOrder
    );
    displayOutput(result);

    const lyricsInput = document.getElementById('lyrics-input');
    if (lyricsInput && lyricsInput.value.trim()) {
      const spaceSel = document.getElementById('lyrics-space');
      const maxSpaces = spaceSel ? spaceSel.value : 1;
      const removeParens = document.getElementById('lyrics-remove-parens')?.checked;
      const removeBrackets = document.getElementById('lyrics-remove-brackets')?.checked;
      const processed = utils.processLyrics(
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

  /** 
   * Toggle a button's active style to reflect checkbox state.
   * Purpose: Visual sync for toggles.
   * Usage: In setupToggleButtons.
   * 50% Rule: Class toggle and text update.
   * @param {HTMLElement} btn - Button.
   * @param {HTMLInputElement} checkbox - Checkbox.
   */
  function updateButtonState(btn, checkbox) {
    btn.classList.toggle('active', checkbox.checked);
    if (btn.dataset.on && btn.dataset.off) {
      btn.textContent = checkbox.checked ? btn.dataset.on : btn.dataset.off;
    }
  }

  /** 
   * Apply active or indeterminate classes without changing checkbox state.
   * Purpose: Reflect state visually.
   * Usage: In reflect functions.
   * 50% Rule: Class management.
   * @param {HTMLElement} btn - Button.
   * @param {boolean} active - Active state.
   * @param {boolean} indeterminate - Indeterminate state.
   */
  function reflectToggleState(btn, active, indeterminate) {
    if (!btn) return;
    btn.classList.remove('active', 'indeterminate');
    if (active) btn.classList.add('active');
    else if (indeterminate) btn.classList.add('indeterminate');
    if (btn.dataset.on && btn.dataset.off) {
      btn.textContent = active ? btn.dataset.on : btn.dataset.off;
    }
  }

  /** 
   * Enable buttons that act as proxies for hidden checkboxes.
   * Purpose: Setup toggle behavior.
   * Usage: In initializeUI.
   * 50% Rule: Event listeners.
   */
  function setupToggleButtons() {
    document.querySelectorAll('.toggle-button').forEach(btn => {
      const target = btn.dataset.target;
      const checkbox = document.getElementById(target);
      if (!checkbox) return;
      updateButtonState(btn, checkbox);
      if (!btn.dataset.toggleInit) {
        btn.addEventListener('click', () => {
          checkbox.checked = !checkbox.checked;
          updateButtonState(btn, checkbox);
          checkbox.dispatchEvent(new Event('change'));
        });
        btn.dataset.toggleInit = 'true';
      }
    });
  }

  /** 
   * Global randomization toggle affecting all order/depth selects.
   * Purpose: Sync all to random or canonical.
   * Usage: In initializeUI.
   * 50% Rule: Reflect and update functions.
   */
  function setupShuffleAll() {
    const allRandom = document.getElementById('all-random');
    if (!allRandom) return;
    const canonicalFor = sel =>
      sel.id.includes('-depth-select') ? 'prepend' : 'canonical';
    const reflect = () => {
      const selects = Array.from(
        document.querySelectorAll('[id*="-order-select"], [id*="-depth-select"]')
      );
      const allRand = selects.every(s => s.value === 'random');
      const allCan = selects.every(s => s.value === canonicalFor(s));
      const btn = document.querySelector('.toggle-button[data-target="all-random"]');
      if (btn) {
        btn.classList.remove('active', 'indeterminate');
        if (allRand) btn.classList.add('active');
        else if (!allCan) btn.classList.add('indeterminate');
      }
    };
    const updateAll = () => {
      const selects = Array.from(
        document.querySelectorAll('[id*="-order-select"], [id*="-depth-select"]')
      );
      selects.forEach(sel => {
        sel.value = allRandom.checked ? 'random' : canonicalFor(sel);
        sel.dispatchEvent(new Event('change'));
      });
      ['pos', 'neg'].forEach(p => {
        const cb = document.getElementById(`${p}-order-random`);
        if (cb) {
          cb.checked = allRandom.checked;
          const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
          if (btn) updateButtonState(btn, cb);
          cb.dispatchEvent(new Event('change'));
        }
      });
      reflect();
    };
    allRandom.addEventListener('change', updateAll);
    document.querySelectorAll('[id*="-order-select"], [id*="-depth-select"]').forEach(sel => {
      sel.addEventListener('change', reflect);
    });
    reflect();
  }

  /** 
   * Control dynamic creation of stacked modifier blocks.
   * Purpose: Handle stack toggles and sizes.
   * Usage: In initializeUI.
   * 50% Rule: Updates blocks on change.
   */
  function setupStackControls() {
    const configs = [
      { prefix: 'pos', stack: 'pos-stack', size: 'pos-stack-size', shuffle: 'pos-shuffle' },
      { prefix: 'neg', stack: 'neg-stack', size: 'neg-stack-size', shuffle: 'neg-shuffle' }
    ];
    configs.forEach(cfg => {
      const stackCb = document.getElementById(cfg.stack);
      const sizeEl = document.getElementById(cfg.size);
      const shuffleCb = document.getElementById(cfg.shuffle);
      const shuffleBtn = document.querySelector(`.toggle-button[data-target="${cfg.shuffle}"]`);
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
        const count = stackCb.checked ? parseInt(sizeEl.value, 10) || 1 : 1;
        updateStackBlocks(cfg.prefix, count);
        if (cfg.prefix === 'pos') {
          const negCount = document.getElementById('neg-stack')?.checked
            ? parseInt(document.getElementById('neg-stack-size')?.value || '1', 10)
            : 1;
          updateDepthContainers('neg', negCount, true);
        }
      };
      stackCb.addEventListener('change', update);
      sizeEl.addEventListener('change', update);
      update();
    });
  }

  /** 
   * Update section hide button state based on individual hide checkboxes.
   * Purpose: Reflect hide state.
   * Usage: In setupSectionHide.
   * 50% Rule: Loops to check all/any.
   * @param {string} prefix - Section prefix.
   */
  function reflectSectionHide(prefix) {
    const cb = document.getElementById(`${prefix}-all-hide`);
    if (!cb) return;
    let all = true;
    let any = false;
    forEachId(`${prefix}-hide`, hide => {
      all = all && hide.checked;
      any = any || hide.checked;
    });
    const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
    reflectToggleState(btn, all, any && !all);
  }

  /** 
   * Update the global hide button to reflect overall section state.
   * Purpose: Global hide reflection.
   * Usage: In setupHideToggles.
   * 50% Rule: Every/some checks.
   */
  function reflectAllHide() {
    const cbs = Array.from(
      document.querySelectorAll('input[type="checkbox"][data-targets]')
    );
    const all = cbs.every(cb => cb.checked);
    const any = cbs.some(cb => cb.checked);
    const globalCb = document.getElementById('all-hide');
    if (globalCb) globalCb.checked = all;
    const btn = document.querySelector('.toggle-button[data-target="all-hide"]');
    reflectToggleState(btn, all, any && !all);
  }

  /** 
   * Update the global randomization button to reflect dropdown values.
   * Purpose: Global random reflection.
   * Usage: In setupShuffleAll.
   * 50% Rule: Every checks.
   */
  function reflectAllRandom() {
    const canonicalFor = sel =>
      sel.id.includes('-depth-select') ? 'prepend' : 'canonical';
    const sels = Array.from(
      document.querySelectorAll('[id*="-order-select"], [id*="-depth-select"]')
    );
    const allRand = sels.every(s => s.value === 'random');
    const allCan = sels.every(s => s.value === canonicalFor(s));
    const btn = document.querySelector('.toggle-button[data-target="all-random"]');
    reflectToggleState(btn, allRand, !allCan && !allRand);
  }

  /** 
   * Mirror randomization state for a section's order/depth controls.
   * Purpose: Section random reflection.
   * Usage: In setupSectionOrder.
   * 50% Rule: Every checks.
   * @param {string} prefix - Prefix.
   */
  function reflectSectionOrder(prefix) {
    const cb = document.getElementById(`${prefix}-order-random`);
    if (!cb) return;
    const canonicalFor = s => (s.id.includes('-depth-select') ? 'prepend' : 'canonical');
    const sels = [
      ...gatherControls(prefix, 'order'),
      ...gatherControls(prefix, 'depth')
    ].map(p => p.select).filter(Boolean);
    const allRand = sels.every(s => s.value === 'random');
    const allCan = sels.every(s => s.value === canonicalFor(s));
    const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
    reflectToggleState(btn, allRand, !allCan && !allRand);
  }

  /** 
   * Keep the global advanced toggle consistent with per-section states.
   * Purpose: Global advanced reflection.
   * Usage: In setupSectionAdvanced.
   * 50% Rule: Every checks.
   */
  function reflectGlobalAdvanced() {
    const secs = Array.from(document.querySelectorAll('[id$="-advanced"]'));
    if (!secs.length) return;
    const allOn = secs.every(cb => cb.checked);
    const allOff = secs.every(cb => !cb.checked);
    const btn = document.querySelector('.toggle-button[data-target="advanced-mode"]');
    reflectToggleState(btn, allOn, !allOff && !allOn);
  }

  /** 
   * Hook up the hide-all checkbox for a section.
   * Purpose: Sync section hides.
   * Usage: In initializeUI.
   * 50% Rule: Event and reflect.
   * @param {string} prefix - Prefix.
   */
  function setupSectionHide(prefix) {
    const cb = document.getElementById(`${prefix}-all-hide`);
    if (!cb) return;
    const update = () => {
      forEachId(`${prefix}-hide`, hide => {
        hide.checked = cb.checked;
        const btn = document.querySelector(`.toggle-button[data-target="${hide.id}"]`);
        if (btn) updateButtonState(btn, hide);
        hide.dispatchEvent(new Event('change'));
      });
      reflectSectionHide(prefix);
    };
    cb.addEventListener('change', update);
    forEachId(`${prefix}-hide`, hide => {
      hide.addEventListener('change', () => reflectSectionHide(prefix));
    });
    update();
  }

  /** 
   * Hook up the randomize-order checkbox for a section.
   * Purpose: Sync section random.
   * Usage: In initializeUI.
   * 50% Rule: Update and reflect.
   * @param {string} prefix - Prefix.
   */
  function setupSectionOrder(prefix) {
    const cb = document.getElementById(`${prefix}-order-random`);
    if (!cb) return;
    const canonicalFor = s => (s.id.includes('-depth-select') ? 'prepend' : 'canonical');
    const update = () => {
      const sels = [
        ...gatherControls(prefix, 'order'),
        ...gatherControls(prefix, 'depth')
      ].map(p => p.select).filter(Boolean);
      sels.forEach(s => {
        s.value = cb.checked ? 'random' : canonicalFor(s);
        s.dispatchEvent(new Event('change'));
      });
      reflectSectionOrder(prefix);
      reflectAllRandom();
    };
    cb.addEventListener('change', update);
    forEachId(`${prefix}-order-select`, (sel, idx) => {
      sel.addEventListener('change', () => {
        reflectSectionOrder(prefix);
        reflectAllRandom();
      });
      const dep = document.getElementById(`${prefix}-depth-select${idx === 1 ? '' : '-' + idx}`);
      if (dep)
        dep.addEventListener('change', () => {
          reflectSectionOrder(prefix);
          reflectAllRandom();
        });
    });
    reflectSectionOrder(prefix);
  }

  /** 
   * Show or hide advanced options within a section.
   * Purpose: Toggle advanced UI.
   * Usage: In initializeUI.
   * 50% Rule: Display toggles.
   * @param {string} prefix - Prefix.
   */
  function setupSectionAdvanced(prefix) {
    const cb = document.getElementById(`${prefix}-advanced`);
    if (!cb) return;
    const setDisplay = (el, show) => { if (el) el.style.display = show ? '' : 'none'; };
    const update = () => {
      const adv = cb.checked;
      document.querySelectorAll(`[id^="${prefix}-order-select"]`).forEach(el => setDisplay(el, adv));
      document.querySelectorAll(`[id^="${prefix}-depth-select"]`).forEach(el => setDisplay(el, adv));
      document.querySelectorAll(`[id^="${prefix}-order-input"]`).forEach(el => {
        if (el.parentElement && el.parentElement.classList.contains('input-row')) setDisplay(el.parentElement, adv);
      });
      document.querySelectorAll(`[id^="${prefix}-depth-input"]`).forEach(el => {
        if (el.parentElement && el.parentElement.classList.contains('input-row')) setDisplay(el.parentElement, adv);
      });
      document.querySelectorAll(`[id^="${prefix}-order-container"]`).forEach(el => setDisplay(el, adv));
      document.querySelectorAll(`[id^="${prefix}-depth-container"]`).forEach(el => setDisplay(el, adv));
      const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
      if (btn) updateButtonState(btn, cb);
      (rerollUpdaters[prefix] || []).forEach(fn => fn());
    };
    cb.addEventListener('change', () => {
      cb.dataset.userSet = 'true';
      update();
      reflectGlobalAdvanced();
    });
    if (!cb.dataset.userSet) {
      const globalAdv = document.getElementById('advanced-mode');
      cb.checked = !!(globalAdv && globalAdv.checked);
    }
    update();
    reflectGlobalAdvanced();
  }

  /** 
   * Force UI refresh of advanced elements for a section.
   * Purpose: Refresh advanced display.
   * Usage: After stack updates.
   * 50% Rule: Similar to update in setup.
   * @param {string} prefix - Prefix.
   */
  function refreshSectionAdvanced(prefix) {
    const cb = document.getElementById(`${prefix}-advanced`);
    if (!cb) return;
    const adv = cb.checked;
    const setDisplay = (el, show) => { if (el) el.style.display = show ? '' : 'none'; };
    document.querySelectorAll(`[id^="${prefix}-order-select"]`).forEach(el => setDisplay(el, adv));
    document.querySelectorAll(`[id^="${prefix}-depth-select"]`).forEach(el => setDisplay(el, adv));
    document.querySelectorAll(`[id^="${prefix}-order-input"]`).forEach(el => {
      if (el.parentElement && el.parentElement.classList.contains('input-row')) setDisplay(el.parentElement, adv);
    });
    document.querySelectorAll(`[id^="${prefix}-depth-input"]`).forEach(el => {
      if (el.parentElement && el.parentElement.classList.contains('input-row')) setDisplay(el.parentElement, adv);
    });
    document.querySelectorAll(`[id^="${prefix}-order-container"]`).forEach(el => setDisplay(el, adv));
    document.querySelectorAll(`[id^="${prefix}-depth-container"]`).forEach(el => setDisplay(el, adv));
    (rerollUpdaters[prefix] || []).forEach(fn => fn());
  }

  const rerollUpdaters = {};

  /** 
   * Master toggle for advanced mode, updating all sections accordingly.
   * Purpose: Global advanced toggle.
   * Usage: In initializeUI.
   * 50% Rule: Updates all sections.
   */
  function setupAdvancedToggle() {
    const cb = document.getElementById('advanced-mode');
    if (!cb) return;
    const selectIds = [
      'base-order-select',
      'pos-order-select',
      'neg-order-select',
      'divider-order-select',
      'pos-depth-select',
      'neg-depth-select'
    ];
    const textIds = [
      'base-order-input',
      'divider-order-input',
      'pos-depth-input',
      'neg-depth-input'
    ];
    const containerIds = ['pos-order-container', 'neg-order-container', 'pos-depth-container', 'neg-depth-container'];
    const setDisplay = (el, show) => {
      if (!el) return;
      el.style.display = show ? '' : 'none';
    };
    const update = () => {
      const adv = cb.checked;
      selectIds.forEach(id => {
        document.querySelectorAll(`[id^="${id}"]`).forEach(el => setDisplay(el, adv));
      });
      textIds.forEach(id => {
        document.querySelectorAll(`[id^="${id}"]`).forEach(el => {
          if (el.parentElement && el.parentElement.classList.contains('input-row')) {
            setDisplay(el.parentElement, adv);
          }
        });
      });
      containerIds.forEach(id => {
        document.querySelectorAll(`[id^="${id}"]`).forEach(el => setDisplay(el, adv));
      });
      document.querySelectorAll('[id$="-advanced"]').forEach(sec => {
        sec.checked = adv;
        const btn = document.querySelector(`.toggle-button[data-target="${sec.id}"]`);
        if (btn) updateButtonState(btn, sec);
        sec.dispatchEvent(new Event('change'));
      });
      // Dice buttons remain visible in both modes
      Object.values(rerollUpdaters).flat().forEach(fn => fn());
      reflectGlobalAdvanced();
    };
    cb.addEventListener('change', update);
    update();
  }

  /** 
   * Attach hide buttons to inputs and synchronize the global state.
   * Purpose: Setup hide toggles.
   * Usage: In initializeUI.
   * 50% Rule: Event listeners for each.
   * @returns {HTMLInputElement[]} - Hide checkboxes.
   */
  function setupHideToggles() {
    const hideCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"][data-targets]'));
    const allHide = document.getElementById('all-hide');
    const initHandlers = !allHide || !allHide.checked;
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
      const prefix = cb.id.split('-')[0];
      const handler = () => {
        update();
        reflectSectionHide(prefix);
        reflectAllHide();
      };
      cb.addEventListener('change', handler);
      if (initHandlers) handler();
    });
    if (allHide && allHide.checked) applyAllHideState();
    return hideCheckboxes;
  }

  /** 
   * Apply the global hide state to all individual sections.
   * Purpose: Sync all hides.
   * Usage: On all-hide change.
   * 50% Rule: Loops over checkboxes.
   */
  function applyAllHideState() {
    const allHide = document.getElementById('all-hide');
    if (!allHide) return;
    const state = allHide.checked;
    const hideCheckboxes = Array.from(
      document.querySelectorAll('input[type="checkbox"][data-targets]')
    );
    hideCheckboxes.forEach(cb => {
      cb.checked = state;
      const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
      if (btn) updateButtonState(btn, cb);
      cb.dispatchEvent(new Event('change'));
    });
    ['pos', 'neg'].forEach(p => {
      const sec = document.getElementById(`${p}-all-hide`);
      if (sec) {
        sec.checked = state;
        const btn = document.querySelector(`.toggle-button[data-target="${sec.id}"]`);
        if (btn) updateButtonState(btn, sec);
        sec.dispatchEvent(new Event('change'));
      }
    });
    const allHideBtn = document.querySelector(
      '.toggle-button[data-target="all-hide"]'
    );
    if (allHideBtn) updateButtonState(allHideBtn, allHide);
    reflectAllHide();
  }

  /** 
   * Attach clipboard copy handlers to .copy-button elements.
   * Purpose: Copy to clipboard.
   * Usage: In initializeUI.
   * 50% Rule: Async with feedback.
   */
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

  /** 
   * Fill order dropdown with canonical, random and preset options.
   * Purpose: Populate order selects.
   * Usage: In initializeUI.
   * 50% Rule: Static + dynamic options.
   * @param {HTMLSelectElement} select - Select to populate.
   */
  function populateOrderOptions(select) {
    if (!select) return;
    select.innerHTML = '';
    const opts = [
      { id: 'canonical', title: 'Canonical' },
      { id: 'random', title: 'Randomized' }
    ];
    Object.keys(lists.ORDER_PRESETS).forEach(id => {
      opts.push({ id, title: lists.ORDER_PRESETS[id].title || id });
    });
    opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.title;
      select.appendChild(opt);
    });
  }


  /**
   * Update the order textarea when the associated select or watched inputs
   * change. Provides canonical, random and preset ordering.
   * Purpose: Sync order input with select.
   * Usage: In initializeUI.
   * 50% Rule: Handles modes, shuffles.
   * @param {string} selectId - Select id.
   * @param {string} inputId - Input id.
   * @param {Function} getItems - Function to get items.
   * @param {string|string[]} watchIds - Ids to watch.
   */
  function setupOrderControl(selectId, inputId, getItems, watchIds) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    if (!select || !input) return;
    const prefix = guessPrefix(selectId);
    const update = () => {
      const items = getItems();
      if (select.value === 'canonical') {
        input.value = items.map((_, i) => i).join(', ');
      } else if (select.value === 'random') {
        const arr = items.map((_, i) => i);
        utils.shuffle(arr);
        input.value = arr.join(', ');
      } else if (lists.ORDER_PRESETS[select.value]) {
        input.value = lists.ORDER_PRESETS[select.value].join(', ');
      }
      if (rerollUpdaters[prefix]) rerollUpdaters[prefix].forEach(fn => fn());
    };
    select.addEventListener('change', update);
    const ids = Array.isArray(watchIds) ? watchIds : [watchIds];
    ids.forEach(id => {
      const src = document.getElementById(id);
      if (src) {
        const handler = () => {
          if (
            select.value === 'canonical' ||
            select.value === 'random' ||
            lists.ORDER_PRESETS[select.value]
          ) {
            update();
          }
        };
        src.addEventListener('input', handler);
        src.addEventListener('change', handler);
      }
    });
    update();
  }

  /** 
   * Depth dropdown uses prepend, append and random plus presets.
   * Purpose: Populate depth selects.
   * Usage: In initializeUI.
   * 50% Rule: Similar to order.
   * @param {HTMLSelectElement} select - Select.
   */
  function populateDepthOptions(select) {
    if (!select) return;
    select.innerHTML = '';
    const opts = [
      { id: 'prepend', title: 'Prepend' },
      { id: 'append', title: 'Append' },
      { id: 'random', title: 'Random Depth' }
    ];
    Object.keys(lists.ORDER_PRESETS).forEach(id => {
      opts.push({ id, title: lists.ORDER_PRESETS[id].title || id });
    });
    opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.title;
      select.appendChild(opt);
    });
  }


  /**
   * Like setupOrderControl but for depth values. Recomputes counts when base
   * or modifier inputs change.
   * Purpose: Sync depth input.
   * Usage: In initializeUI.
   * 50% Rule: Modes with random.
   * @param {string} selectId - Select id.
   * @param {string} inputId - Input id.
   * @param {string[]} [watchIds='base-input'] - Watch ids.
   */
  function setupDepthControl(selectId, inputId, watchIds = 'base-input') {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    if (!select || !input) return;
    const prefix = guessPrefix(selectId);
    const idx = (selectId.match(/-(\d+)$/) || [])[1]
      ? parseInt(selectId.match(/-(\d+)$/)[1], 10)
      : 1;
    const build = mode => {
      const counts = computeDepthCounts(prefix, idx);
      if (!counts.length) {
        input.value = '';
        return;
      }
      if (mode === 'prepend') {
        input.value = counts.map(() => 0).join(', ');
        return;
      }
      if (mode === 'append') {
        input.value = counts.join(', ');
        return;
      }
      if (mode === 'random') {
        const vals = counts.map(c => Math.floor(Math.random() * (c + 1)));
        input.value = vals.join(', ');
        return;
      }
      input.value = '';
    };
    const update = () => {
      const val = select.value;
      if (val === 'prepend' || val === 'append' || val === 'random') {
        build(val);
      } else if (lists.ORDER_PRESETS[val]) {
        input.value = lists.ORDER_PRESETS[val].join(', ');
      }
      if (rerollUpdaters[prefix]) rerollUpdaters[prefix].forEach(fn => fn());
    };
    select.addEventListener('change', update);
    const ids = Array.isArray(watchIds) ? watchIds : [watchIds];
    ids.forEach(id => {
      const src = document.getElementById(id);
      if (src) {
        const handler = () => {
          if (
            select.value === 'prepend' ||
            select.value === 'append' ||
            select.value === 'random' ||
            lists.ORDER_PRESETS[select.value]
          ) {
            update();
          }
        };
        src.addEventListener('input', handler);
        src.addEventListener('change', handler);
      }
    });
    update();
  }

  /** 
   * Create or remove depth input blocks to match the requested stack size.
   * Purpose: Dynamic depth controls for stacks.
   * Usage: In updateStackBlocks.
   * 50% Rule: Creates elements dynamically.
   * @param {string} prefix - Prefix.
   * @param {number} count - Number of blocks.
   */
  /**
   * Build the list of ids that should trigger depth recalculation.
   * Purpose: Centralize watcher dependencies so new inputs stay in sync.
   * Line comments capture which elements matter when negatives include positives.
   * 50% Rule: Documented example plus logic summary.
   * @param {string} prefix - Section prefix.
   * @param {number} idx - Stack index.
   * @returns {string[]} - Array of watcher ids.
   */
  function depthWatchIds(prefix, idx) {
    const list = ['base-input', 'base-select'];
    list.push(`${prefix}-input${idx === 1 ? '' : '-' + idx}`);
    list.push(`${prefix}-order-input${idx === 1 ? '' : '-' + idx}`);
    if (prefix === 'neg') {
      list.push('neg-include-pos');
      const posCount = document.getElementById('pos-stack')?.checked
        ? parseInt(document.getElementById('pos-stack-size')?.value || '1', 10)
        : 1;
      for (let p = 1; p <= posCount; p++) {
        list.push(`pos-input${p === 1 ? '' : '-' + p}`);
        list.push(`pos-order-input${p === 1 ? '' : '-' + p}`);
      }
    }
    return list;
  }

  /**
   * Create or remove depth input blocks to match the requested stack size.
   * Watcher lists rely on depthWatchIds; pass refresh=true when related
   * inputs (like positive stacks) change so existing controls rebuild watchers.
   * Purpose: Dynamic depth controls with synchronized dependencies.
   * 50% Rule: Loops with comments; refresh handles updates.
   * @param {string} prefix - Prefix.
   * @param {number} count - Number of blocks.
   * @param {boolean} [refresh=false] - Reapply watchers on existing elements.
   */
  function updateDepthContainers(prefix, count, refresh = false) {
    const container = document.getElementById(`${prefix}-depth-container`);
    const baseId = `${prefix}-depth`;
    const adv = document.getElementById('advanced-mode');
    const baseSel = document.getElementById(`${baseId}-select`);
    const defaultVal = !adv || !adv.checked ? baseSel?.value || 'prepend' : undefined;
    if (!container) return;
    const current = container.querySelectorAll('select').length;
    if (refresh) {
      for (let i = 1; i <= Math.min(current, count); i++) {
        const sel = document.getElementById(
          `${baseId}-select${i === 1 ? '' : '-' + i}`
        );
        const ta = document.getElementById(
          `${baseId}-input${i === 1 ? '' : '-' + i}`
        );
        if (sel && ta) setupDepthControl(sel.id, ta.id, depthWatchIds(prefix, i));
      }
    }
    for (let i = current; i < count; i++) {
      const idx = i + 1;
      const sel = document.createElement('select');
      sel.id = `${baseId}-select-${idx}`;
      populateDepthOptions(sel);
      if (defaultVal) sel.value = defaultVal;
      container.appendChild(sel);
      const div = document.createElement('div');
      div.className = 'input-row';
      const ta = document.createElement('textarea');
      ta.id = `${baseId}-input-${idx}`;
      ta.rows = 1;
      ta.placeholder = '0,1,2';
      div.appendChild(ta);
      container.appendChild(div);
      setupDepthControl(sel.id, ta.id, depthWatchIds(prefix, idx));
    }
    for (let i = current; i > count; i--) {
      const idx = i;
      const sel = document.getElementById(`${baseId}-select-${idx}`);
      const ta = document.getElementById(`${baseId}-input-${idx}`);
      if (sel) sel.remove();
      if (ta && ta.parentElement) ta.parentElement.remove();
    }
  }

  /** 
   * Generate stacked modifier blocks dynamically for positive or negative lists.
   * Purpose: Create stack UI blocks.
   * Usage: In setupStackControls.
   * 50% Rule: Dynamic element creation.
   * @param {string} prefix - Prefix (pos/neg).
   * @param {number} count - Number of blocks.
   */
  function updateStackBlocks(prefix, count) {
    const container = document.getElementById(`${prefix}-stack-container`);
    if (!container) return;
    const current = container.querySelectorAll('.stack-block').length;
    const type = prefix === 'neg' ? 'negative' : 'positive';
    const rows = prefix === 'neg' ? 3 : 2;
    for (let i = current; i < count; i++) {
      const idx = i + 1;
      const block = document.createElement('div');
      const sec = prefix === 'neg' ? 'negative' : 'positive';
      block.className = `stack-block section-${sec}`;
      block.id = `${prefix}-stack-${idx}`;

      const labelRow = document.createElement('div');
      labelRow.className = 'label-row';
      if (count > 1) {
        const lbl = document.createElement('label');
        lbl.textContent = `Stack ${idx}`;
        labelRow.appendChild(lbl);
      }
      const btnCol = document.createElement('div');
      btnCol.className = 'button-col';
      const save = document.createElement('button');
      save.type = 'button';
      save.id = `${prefix}-save-${idx}`;
      save.className = 'save-button icon-button';
      save.title = 'Save';
      save.innerHTML = '&#128190;';
      save.addEventListener('click', () => lists.saveList(type, idx));
      btnCol.appendChild(save);
      const rerollBtn = document.createElement('button');
      rerollBtn.type = 'button';
      rerollBtn.id = `${prefix}-reroll-${idx}`;
      rerollBtn.className = 'toggle-button icon-button random-button';
      rerollBtn.title = 'Reroll';
      rerollBtn.innerHTML = '&#127922;';
      btnCol.appendChild(rerollBtn);
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'copy-button icon-button';
      copy.dataset.target = `${prefix}-input-${idx}`;
      copy.title = 'Copy';
      copy.innerHTML = '&#128203;';
      btnCol.appendChild(copy);
      const hideCb = document.createElement('input');
      hideCb.type = 'checkbox';
      hideCb.id = `${prefix}-hide-${idx}`;
      hideCb.dataset.targets = `${prefix}-input-${idx},${prefix}-order-input-${idx},${prefix}-depth-input-${idx}`;
      hideCb.hidden = true;
      btnCol.appendChild(hideCb);
      const hideBtn = document.createElement('button');
      hideBtn.type = 'button';
      hideBtn.className = 'toggle-button icon-button hide-button';
      hideBtn.dataset.target = hideCb.id;
      hideBtn.dataset.on = '☰';
      hideBtn.dataset.off = '✖';
      hideBtn.textContent = '☰';
      btnCol.appendChild(hideBtn);
      labelRow.appendChild(btnCol);
      block.appendChild(labelRow);

      const sel = document.createElement('select');
      sel.id = `${prefix}-select-${idx}`;
      const baseSel = document.getElementById(`${prefix}-select`);
      if (baseSel) sel.innerHTML = baseSel.innerHTML;
      block.appendChild(sel);

      const row = document.createElement('div');
      row.className = 'input-row';
      const ta = document.createElement('textarea');
      ta.id = `${prefix}-input-${idx}`;
      ta.rows = rows;
      ta.placeholder = type.charAt(0).toUpperCase() + type.slice(1) + ' modifiers';
      row.appendChild(ta);
      block.appendChild(row);

      const orderCont = document.createElement('div');
      orderCont.id = `${prefix}-order-container-${idx}`;
      const oLabelRow = document.createElement('div');
      oLabelRow.className = 'label-row';
      const oLbl = document.createElement('label');
      oLbl.textContent = type.charAt(0).toUpperCase() + type.slice(1) + ' Ordering';
      oLbl.setAttribute('for', `${prefix}-order-input-${idx}`);
      oLabelRow.appendChild(oLbl);
      orderCont.appendChild(oLabelRow);
      const orderSel = document.createElement('select');
      orderSel.id = `${prefix}-order-select-${idx}`;
      populateOrderOptions(orderSel);
      const baseOrderSel = document.getElementById(`${prefix}-order-select`);
      if (baseOrderSel) orderSel.value = baseOrderSel.value;
      orderCont.appendChild(orderSel);
      const oRow = document.createElement('div');
      oRow.className = 'input-row';
      const oTa = document.createElement('textarea');
      oTa.id = `${prefix}-order-input-${idx}`;
      oTa.rows = 1;
      oTa.placeholder = '0,1,2';
      oRow.appendChild(oTa);
      orderCont.appendChild(oRow);
      block.appendChild(orderCont);

      const depthCont = document.createElement('div');
      depthCont.id = `${prefix}-depth-container-${idx}`;
      const dLabelRow = document.createElement('div');
      dLabelRow.className = 'label-row';
      const dLbl = document.createElement('label');
      dLbl.textContent = type.charAt(0).toUpperCase() + type.slice(1) + ' Depth';
      dLbl.setAttribute('for', `${prefix}-depth-input-${idx}`);
      dLabelRow.appendChild(dLbl);
      depthCont.appendChild(dLabelRow);
      const depthSel = document.createElement('select');
      depthSel.id = `${prefix}-depth-select-${idx}`;
      populateDepthOptions(depthSel);
      const baseDepthSel = document.getElementById(`${prefix}-depth-select`);
      if (baseDepthSel) depthSel.value = baseDepthSel.value;
      depthCont.appendChild(depthSel);
      const dRow = document.createElement('div');
      dRow.className = 'input-row';
      const dTa = document.createElement('textarea');
      dTa.id = `${prefix}-depth-input-${idx}`;
      dTa.rows = 1;
      dTa.placeholder = '0,1,2';
      dRow.appendChild(dTa);
      depthCont.appendChild(dRow);
      block.appendChild(depthCont);

      container.appendChild(block);
      setupPresetListener(sel.id, ta.id, type);
      applyPreset(sel, ta, type);
      setupOrderControl(orderSel.id, oTa.id, () => utils.parseInput(ta.value), ta.id);
      setupDepthControl(depthSel.id, dTa.id, ['base-input', 'base-select']);
      setupRerollButton(rerollBtn.id, orderSel.id);
    }
    for (let i = current; i > count; i--) {
      const block = document.getElementById(`${prefix}-stack-${i}`);
      if (block) block.remove();
    }
    setupCopyButtons();
    setupHideToggles();
    setupToggleButtons();
    setupSectionHide(prefix);
    setupSectionOrder(prefix);
    setupSectionAdvanced(prefix);
    ['pos', 'neg'].forEach(p => {
      if (document.getElementById(`${p}-advanced`)) {
        refreshSectionAdvanced(p);
      } else {
        const adv = document.getElementById('advanced-mode');
        if (adv) adv.dispatchEvent(new Event('change'));
      }
    });
  }

  /** 
   * Button that toggles order/depth selects between random and canonical.
   * Purpose: Reroll random values.
   * Usage: In updateStackBlocks.
   * 50% Rule: Toggles modes.
   * @param {string} btnId - Button id.
   * @param {string} selectId - Select id.
   */
  function setupRerollButton(btnId, selectId) {
    const btn = document.getElementById(btnId);
    const select = document.getElementById(selectId);
    const adv = document.getElementById('advanced-mode');
    if (!btn || !select) return;
    const prefix = guessPrefix(selectId);
    const idx = (selectId.match(/-(\d+)$/) || [])[1] ? parseInt(selectId.match(/-(\d+)$/)[1], 10) : 1;
    const selFor = base => document.getElementById(`${prefix}-${base}-select${idx === 1 ? '' : '-' + idx}`);
    const gather = () => [selFor('order'), selFor('depth')].filter(Boolean);
    const updateState = () => {
      const sels = gather();
      const canonicalFor = s => (s.id.includes('-depth-select') ? 'prepend' : 'canonical');
      const allRand = sels.every(s => s.value === 'random');
      const allCan = sels.every(s => s.value === canonicalFor(s));
      reflectToggleState(btn, allRand, !allCan && !allRand);
      reflectAllRandom();
    };
    const reroll = () => {
      const sels = gather();
      const canonicalFor = s => (s.id.includes('-depth-select') ? 'prepend' : 'canonical');
      const allRand = sels.every(s => s.value === 'random');
      sels.forEach(s => {
        const target = allRand ? canonicalFor(s) : 'random';
        s.value = target;
        s.dispatchEvent(new Event('change'));
      });
      updateState();
    };
    btn.addEventListener('click', reroll);
    gather().forEach(s => s.addEventListener('change', updateState));
    if (adv) adv.addEventListener('change', updateState);
    if (!rerollUpdaters[prefix]) rerollUpdaters[prefix] = [];
    rerollUpdaters[prefix].push(updateState);
    updateState();
  }

  /** 
   * Force all selects currently set to random to generate new orders.
   * Purpose: Reroll on generate.
   * Usage: In generate.
   * 50% Rule: Gathers and shuffles.
   */
  function rerollRandomOrders() {

    const baseItems = utils.parseInput(
      document.getElementById('base-input')?.value || '',
      true
    );
    const gatherItems = prefix => {
      const arr = [];
      forEachId(`${prefix}-input`, el => {
        arr.push(utils.parseInput(el.value || ''));
      });
      return arr.length === 1 ? arr[0] : arr;
    };

    const posItems = gatherItems('pos');
    const negItems = gatherItems('neg');
    const divItems = utils.parseDividerInput(
      document.getElementById('divider-input')?.value || ''
    );

    function gather(prefix, items) {
      return gatherControls(prefix, 'order').map((pair, i) => ({
        select: pair.select,
        input: pair.input,
        items: Array.isArray(items[0]) ? items[i] || items[0] : items
      }));
    }

    const configs = [
      ...gather('base', baseItems),
      ...gather('pos', posItems),
      ...gather('neg', negItems),
      ...gather('divider', divItems)
    ];

    configs.forEach(cfg => {
      if (cfg.select.value !== 'random') return;
      const arr = cfg.items.map((_, i) => i);
      utils.shuffle(arr);
      cfg.input.value = arr.join(', ');
    });

    function gatherDepth(prefix) {
      return gatherControls(prefix, 'depth');
    }

    const depthConfigs = [...gatherDepth('pos'), ...gatherDepth('neg')];
    depthConfigs.forEach(cfg => {
      if (!cfg.select || !cfg.input || cfg.select.value !== 'random') return;
      const pref = guessPrefix(cfg.select.id);
      const idx = (cfg.select.id.match(/-(\d+)$/) || [])[1]
        ? parseInt(cfg.select.id.match(/-(\d+)$/)[1], 10)
        : 1;
      const counts = computeDepthCounts(pref, idx);
      if (!counts.length) {
        cfg.input.value = '';
        return;
      }
      const vals = counts.map(c => Math.floor(Math.random() * (c + 1)));
      cfg.input.value = vals.join(', ');
    });
  }

  /** 
   * Load preset values into all inputs based on current select choices.
   * Purpose: Apply all presets.
   * Usage: In resetUI.
   * 50% Rule: Calls applyPreset for each.
   */
  function applyCurrentPresets() {
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
    applyPreset(
      document.getElementById('lyrics-select'),
      document.getElementById('lyrics-input'),
      'lyrics'
    );
  }

  /** 
   * Reset all form fields to defaults and reapply presets.
   * Purpose: Full UI reset.
   * Usage: On reset button.
   * 50% Rule: Loops over fields.
   */
  function resetUI() {
    const fields = document.querySelectorAll('input[id], textarea[id], select[id]');
    fields.forEach(el => {
      if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
        el.dispatchEvent(new Event('change'));
      } else if (el.type === 'checkbox') {
        el.checked = el.defaultChecked;
        el.dispatchEvent(new Event('change'));
      } else {
        el.value = el.defaultValue || '';
        el.dispatchEvent(new Event('input'));
        el.dispatchEvent(new Event('change'));
      }
    });
    updateStackBlocks('pos', 1);
    updateStackBlocks('neg', 1);
    applyCurrentPresets();
  }

  /** 
   * Wire up Load, Save and Reset data buttons.
   * Purpose: Handle data buttons.
   * Usage: In initializeUI.
   * 50% Rule: Event listeners for file I/O.
   */
  function setupDataButtons() {
    const saveBtn = document.getElementById('save-data');
    const loadBtn = document.getElementById('load-data');
    const resetBtn = document.getElementById('reset-data');
    const fileInput = document.getElementById('data-file');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const blob = new Blob([storage.exportData()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset all data to defaults?')) {
          storage.resetData();
          resetUI();
        }
      });
    }
    if (loadBtn && fileInput) {
      loadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => {
        const f = e.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            storage.importData(data);
          } catch (err) {
            alert('Invalid state file');
          }
        };
        reader.readAsText(f);
        fileInput.value = '';
      });
    }
  }

  /** 
   * Startup routine called once DOM is ready.
   * Purpose: Initialize everything.
   * Usage: On load.
   * 50% Rule: Calls all setups.
   */
  function initializeUI() {
    storage.loadPersisted();
    applyCurrentPresets();

    setupPresetListener('neg-select', 'neg-input', 'negative');
    setupPresetListener('pos-select', 'pos-input', 'positive');
    setupPresetListener('length-select', 'length-input', 'length');
    setupPresetListener('divider-select', 'divider-input', 'divider');
    setupPresetListener('base-select', 'base-input', 'base');
    setupPresetListener('lyrics-select', 'lyrics-input', 'lyrics');
    populateOrderOptions(document.getElementById('base-order-select'));
    populateOrderOptions(document.getElementById('pos-order-select'));
    populateOrderOptions(document.getElementById('neg-order-select'));
    populateOrderOptions(document.getElementById('divider-order-select'));
    populateDepthOptions(document.getElementById('pos-depth-select'));
    populateDepthOptions(document.getElementById('neg-depth-select'));

    setupOrderControl(
      'base-order-select',
      'base-order-input',
      () => utils.parseInput(document.getElementById('base-input').value, true),
      ['base-input', 'base-select']
    );
    setupOrderControl(
      'pos-order-select',
      'pos-order-input',
      () => utils.parseInput(document.getElementById('pos-input').value),
      ['pos-input', 'pos-select']
    );
    setupOrderControl(
      'neg-order-select',
      'neg-order-input',
      () => utils.parseInput(document.getElementById('neg-input').value),
      ['neg-input', 'neg-select']
    );
    setupOrderControl(
      'divider-order-select',
      'divider-order-input',
      () => utils.parseDividerInput(document.getElementById('divider-input').value || ''),
      ['divider-input', 'divider-select']
    );
    setupDepthControl('pos-depth-select', 'pos-depth-input', [
      'base-input',
      'base-select',
      'pos-input',
      'pos-order-input'
    ]);
    setupDepthControl('neg-depth-select', 'neg-depth-input', [
      'base-input',
      'base-select',
      'neg-input',
      'neg-order-input',
      'neg-include-pos',
      'pos-input',
      'pos-order-input'
    ]);
    updateDepthContainers('pos', 1);
    updateDepthContainers('neg', 1);
    setupRerollButton('base-reroll', 'base-order-select');
    setupRerollButton('pos-reroll-1', 'pos-order-select');
    setupRerollButton('neg-reroll-1', 'neg-order-select');
    setupRerollButton('divider-reroll', 'divider-order-select');
    setupAdvancedToggle();
    setupSectionHide('pos');
    setupSectionHide('neg');
    setupSectionOrder('pos');
    setupSectionOrder('neg');
    setupSectionAdvanced('pos');
    setupSectionAdvanced('neg');
    document.getElementById('generate').addEventListener('click', generate);

    setupToggleButtons();
    setupStackControls();
    setupShuffleAll();
    setupHideToggles();
    reflectAllRandom();
    reflectAllHide();
    reflectGlobalAdvanced();

    const allHide = document.getElementById('all-hide');
    if (allHide) {
      allHide.addEventListener('change', applyAllHideState);
      if (allHide.checked) applyAllHideState();
    }

    setupCopyButtons();
    setupDataButtons();

    const baseSave = document.getElementById('base-save');
    if (baseSave) baseSave.addEventListener('click', () => lists.saveList('base'));
    const posSave = document.getElementById('pos-save-1');
    if (posSave) posSave.addEventListener('click', () => lists.saveList('positive'));
    const negSave = document.getElementById('neg-save-1');
    if (negSave) negSave.addEventListener('click', () => lists.saveList('negative'));
    const lenSave = document.getElementById('length-save');
    if (lenSave) lenSave.addEventListener('click', () => lists.saveList('length'));
    const divSave = document.getElementById('divider-save');
    if (divSave) divSave.addEventListener('click', () => lists.saveList('divider'));
    const lyricsSave = document.getElementById('lyrics-save');
    if (lyricsSave) lyricsSave.addEventListener('click', () => lists.saveList('lyrics'));
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => storage.persist());
    }
  }

  const ui = {
    applyPreset,
    setupPresetListener,
    collectInputs,
    displayOutput,
    generate,
    updateButtonState,
    setupToggleButtons,
    setupShuffleAll,
    setupStackControls,
    setupHideToggles,
    applyAllHideState,
    setupCopyButtons,
    setupDataButtons,
    setupOrderControl,
    setupDepthControl,
    setupAdvancedToggle,
    updateStackBlocks,
    rerollRandomOrders,
    setupRerollButton,
    setupSectionHide,
    setupSectionOrder,
    setupSectionAdvanced,
    initializeUI,
    applyCurrentPresets,
    resetUI,
    computeDepthCounts
  };

// ======== Initialization and Exports ========
// Section Purpose: Bootstrap the application and export modules.
// Uses IIFE for encapsulation, with conditional DOM readiness checks.
// Structural Overview: Conditional init and exports.
// Section Summary: Entry point for app start and module access.

  if (
    typeof document !== 'undefined' &&
    !(typeof window !== 'undefined' && window.__TEST__) &&
    !(typeof global !== 'undefined' && global.__TEST__)
  ) {
    const init = ui.initializeUI;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  if (typeof module !== 'undefined') {
    module.exports = { ...utils, ...lists, ...state, ...storage, ...ui };
  } else {
    global.promptUtils = utils;
    global.listManager = lists;
    global.stateManager = state;
    global.storageManager = storage;
    global.uiControls = ui;
  }
})(typeof window !== 'undefined' ? window : global);

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
 *    - Parsing + delimiter helpers (parseInput, buildDelimiterRegex, countWords)
 *    - Ordering + depth helpers (buildOrderIndices, buildDepthValues, computeDepthCountsFrom)
 *    - Core prompt building logic (applyModifierStack, buildVersions)
 * 2. List Management
 *    - Conflict resolution helpers (listsEqual, nextListName)
 *    - Preset loading and population (populateSelect, loadLists, legacy normalization)
 *    - Export/import, saving and deleting lists
 * 3. State Management
 *    - DOM interaction for state (getVal, setVal, loadFromDOM)
 *    - Export/import state
 * 4. Storage Handling
 *    - LocalStorage operations (saveLocal, loadLocal)
 *    - Data persistence (persist, loadPersisted)
 * 5. UI Controls
 *    - Input collection and output display (collectInputs, displayOutput)
 *    - Mode resolution for order selects (readSelectMode, resolveStackOrders)
 *    - Event handlers and setup (setupPresetListener, initializeUI)
 *    - Reusable id iteration (forEachId)
 *    - Help mode toggle and tooltip handling (setupHelpMode)
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
   * Escape regex metacharacters in a literal string.
   * Purpose: Safely build regex patterns for delimiters and preset-name matching.
   * Usage Example: escapeRegExp('|') returns '\\|'.
   * 50% Rule: Single-responsibility helper, documented by purpose + example.
   * @param {string} value - Raw string to escape.
   * @returns {string} - Escaped string safe for RegExp.
   */
  function escapeRegExp(value) {
    return String(value).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
  }

  /**
   * Build a delimiter regex from a string or pass through an existing RegExp.
   * Whitespace (or empty) defaults to a \s+ splitter so spaces, tabs, and newlines chunk uniformly.
   * Purpose: Normalize delimiter choices into a single split pattern.
   * Usage Example: buildDelimiterRegex(',') returns /,/ and buildDelimiterRegex(' ') returns /\\s+/.
   * 50% Rule: Combines fallback logic, regex safety, and examples for clarity.
   * @param {string|RegExp} delimiter - Delimiter string or regex.
   * @returns {RegExp} - Regex used to split inputs.
   */
  function buildDelimiterRegex(delimiter) {
    if (delimiter instanceof RegExp) return delimiter;
    const raw = delimiter == null ? '' : String(delimiter);
    if (!raw || raw === ' ') return /\s+/;
    if (raw === '\n') return /\r?\n+/;
    if (raw === '\t') return /\t+/;
    return new RegExp(escapeRegExp(raw));
  }

  /**
   * Split a raw text block into delimiter-terminated chunks.
   * Delimiters are preserved on the end of each chunk whenever they appear.
   * Purpose: Parse user input into arrays while keeping delimiter characters intact.
   * Usage Example: parseInput("item1 item2") returns ["item1 ", "item2"].
   * Usage Example: parseInput("item1, item2.", true) returns ["item1,", " item2."].
   * 50% Rule: Uses regex chunking with preserved delimiters; docs emphasize no trimming.
   * @param {string} raw - Text entered by the user.
   * @param {boolean} [keepDelim=false] - Use sentence punctuation as the delimiter.
   * @param {string|RegExp} [delimiter=/\\s+/] - Delimiter string or regex for non-sentence splitting.
   * @returns {string[]} - Array of parsed chunks (delimiters preserved).
   */
  function parseInput(raw, keepDelim = false, delimiter = /\s+/) {
    if (!raw) return [];
    const normalized = raw.replace(/\r\n/g, '\n');
    const activeDelimiter = keepDelim ? /[,.!:;?\n]+/ : delimiter;
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
    return items;
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
   * Build an order index array for a list when randomization is requested.
   * Purpose: Generate order indices at generation time without storing them.
   * Usage Example: buildOrderIndices(['a', 'b'], 'random') may return [1, 0].
   * 50% Rule: Creates indices, then shuffles only when needed.
   * @param {string[]} items - Items to order.
   * @param {string} mode - Order mode string.
   * @returns {number[]|null} - Random order indices or null for canonical/empty.
   */
  function buildOrderIndices(items, mode) {
    if (!Array.isArray(items) || items.length === 0) return null;
    if (mode !== 'random') return null;
    // Index list is created fresh to avoid mutating inputs.
    const indices = items.map((_, i) => i);
    return shuffle(indices);
  }

  /**
   * Apply an order array only when one is provided.
   * Purpose: Keep canonical lists untouched while still allowing random order.
   * Usage Example: applyOrderIfNeeded(['a', 'b'], [1, 0]) returns ['b', 'a'].
   * 50% Rule: Guard clauses + cloning clarify intent.
   * @param {string[]} items - Items to order.
   * @param {number[]|null} order - Order indices or null.
   * @returns {string[]} - Ordered items array.
   */
  function applyOrderIfNeeded(items, order) {
    if (!Array.isArray(items)) return [];
    if (!Array.isArray(order) || !order.length) return items.slice();
    return applyOrder(items, order);
  }

  /**
   * Build a depth array from word counts using a depth mode.
   * Purpose: Generate prepend/append/random depth values on demand.
   * Usage Example: buildDepthValues('append', [2, 3]) returns [2, 3].
   * 50% Rule: Branches per mode and comments random path.
   * @param {string} mode - Depth mode ('prepend', 'append', 'random').
   * @param {number[]} counts - Word counts per item.
   * @returns {number[]|null} - Depth array or null when counts are empty.
   */
  function buildDepthValues(mode, counts) {
    if (!Array.isArray(counts) || counts.length === 0) return null;
    if (mode === 'append') return counts.slice();
    if (mode === 'random') {
      // Random depth picks an index between 0 and the total words (inclusive).
      return counts.map(c => Math.floor(Math.random() * (c + 1)));
    }
    // Default to prepend when mode is missing or unrecognized.
    return counts.map(() => 0);
  }

  /**
   * Sum word counts for a stack array at a specific index.
   * Purpose: Support depth calculations that depend on stacked modifiers.
   * Usage Example: sumStackWordsAt([['a'], ['bb']], 0) returns countWords('a') + countWords('bb').
   * 50% Rule: Explicit modulo handling + inline guard.
   * @param {string[][]} stacks - Array of modifier stacks.
   * @param {number} index - Item index to evaluate.
   * @param {number} [limit=stacks.length] - How many stacks to include.
   * @returns {number} - Total word count.
   */
  function sumStackWordsAt(stacks, index, limit = stacks.length) {
    if (!Array.isArray(stacks) || !stacks.length) return 0;
    const max = Math.min(limit, stacks.length);
    let total = 0;
    for (let s = 0; s < max; s++) {
      const mods = stacks[s];
      if (!mods || !mods.length) continue;
      total += countWords(mods[index % mods.length]);
    }
    return total;
  }

  /**
   * Compute depth counts based on base word counts and ordered stacks.
   * Purpose: Determine insertion endpoints for prepend/append/random depths.
   * Usage Example: computeDepthCountsFrom([2], [['a']], 1, false, []) returns [2].
   * 50% Rule: Combines base counts, optional positives, and prior stacks with clear steps.
   * @param {number[]} baseCounts - Word counts for base items.
   * @param {string[][]} stacks - Ordered modifier stacks for the same prefix.
   * @param {number} idx - Stack index (1-based).
   * @param {boolean} includePos - Whether to include positive stacks (negatives only).
   * @param {string[][]} posStacks - Ordered positive stacks when includePos is true.
   * @returns {number[]} - Depth counts for the requested stack.
   */
  function computeDepthCountsFrom(baseCounts, stacks, idx, includePos, posStacks) {
    if (!Array.isArray(baseCounts) || baseCounts.length === 0) return [];
    const stackIndex = Math.max(1, idx) - 1;
    const mods = (Array.isArray(stacks) && stacks[stackIndex]) ? stacks[stackIndex] : [];
    const len = (mods && mods.length) ? mods.length : baseCounts.length;
    const counts = [];
    for (let i = 0; i < len; i++) {
      let total = baseCounts[i % baseCounts.length];
      if (includePos) total += sumStackWordsAt(posStacks, i);
      total += sumStackWordsAt(stacks, i, stackIndex);
      counts.push(total);
    }
    return counts;
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
   * Insert a term into a phrase at a given word position. Trailing delimiters
   * are preserved so recombination can be a straight concatenation pass.
   * Purpose: Insert modifiers at specific depths in phrases.
   * Usage Example: insertAtDepth("hello world.", "beautiful", 1) returns "hello beautiful world.".
   * 50% Rule: Handles tail punctuation separately; wraps with modulo.
   * @param {string} phrase - Base phrase.
   * @param {string} term - Term to insert.
   * @param {number} depth - Word position to insert at.
   * @param {string|RegExp} [delimiter=/\\s+/] - Delimiter used for chunk tails.
   * @returns {string} - Modified phrase.
   */
  function insertAtDepth(phrase, term, depth, delimiter = /\s+/) {
    if (!term) return phrase;
    const delimRe = buildDelimiterRegex(delimiter);
    const flags = delimRe.flags.replace('g', '');
    const headRe = new RegExp(`^(${delimRe.source})`, flags);
    const tailRe = new RegExp(`(${delimRe.source})$`, flags);
    let head = '';
    let tail = '';
    let body = phrase;
    const headMatch = body.match(headRe);
    if (headMatch) {
      head += headMatch[1];
      body = body.slice(headMatch[1].length);
    }
    const tailMatch = body.match(tailRe);
    if (tailMatch) {
      tail = tailMatch[1] + tail;
      body = body.slice(0, -tailMatch[1].length);
    }
    const leadSpace = body.match(/^(\s+)/);
    if (leadSpace) {
      head += leadSpace[1];
      body = body.slice(leadSpace[1].length);
    }
    const trailSpace = body.match(/(\s+)$/);
    if (trailSpace) {
      tail = trailSpace[1] + tail;
      body = body.slice(0, -trailSpace[1].length);
    }
    body = body.trim();
    const words = body ? body.split(/\s+/) : [];
    const idx = depth % (words.length + 1);
    words.splice(idx, 0, term);
    return head + words.join(' ') + tail;
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
   * @param {string|RegExp} [delimiter=/\\s+/] - Delimiter used for chunk tails.
   * @param {string[]} [dividers=[]] - Dividers to insert.
   * @param {number[]} [itemOrder=null] - Order for base items.
   * @param {number[]|number[][]} [depths=null] - Depths for insertions.
   * @param {Array[]} [captureLog=null] - Optional log collecting inserted modifiers per accepted term.
   * @returns {string[]} - Modified items array.
   */
  function applyModifierStack(
    baseItems,
    modifiers,
    limit,
    stackSize = 1,
    modOrders = null,
    delimiter = /\s+/,
    dividers = [],
    itemOrder = null,
    depths = null,
    captureLog = null
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
    // Empty depth arrays should behave like "no depth override."
    if (Array.isArray(depths) && depths.length) {
      depthPool = Array.isArray(depths[0]) ? depths.map(d => d.slice()) : depths.slice();
    }
    const result = [];
    let idx = 0;
    let divIdx = 0;
    while (true) {
      const needDivider = idx > 0 && idx % items.length === 0 && dividerPool.length;
      let term = items[idx % items.length];
      const inserted = [];
      const capturedMods = [];
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
          term = insertAtDepth(term, mod, adj, delimiter);
          inserted.push(adj);
          if (captureLog) capturedMods.push(mod);
        }
      });
      const pieces = [];
      if (needDivider) pieces.push(dividerPool[divIdx % dividerPool.length]);
      pieces.push(term);
      const candidate =
        (result.length ? result.join('') : '') +
        pieces.join('');
      if (candidate.length > limit) break;
      if (needDivider) {
        result.push(dividerPool[divIdx % dividerPool.length]);
        divIdx++;
      }
      if (captureLog) captureLog.push(capturedMods);
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
   * @param {string|RegExp} [delimiter=/\\s+/] - Delimiter used for chunk tails.
   * @param {string[]} [dividers=[]] - Dividers.
   * @param {number[]} [itemOrder=null] - Item order.
   * @param {number[]|number[][]} [depths=null] - Depths.
   * @param {Array[]} [captureLog=null] - Optional log collecting inserted modifiers per accepted term.
   * @returns {string[]} - Negative terms array.
   */
  function applyNegativeOnPositive(
    posTerms,
    negMods,
    limit,
    stackSize = 1,
    modOrders = null,
    delimiter = /\s+/,
    dividers = [],
    itemOrder = null,
    depths = null,
    captureLog = null
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
    // Skip depthPool when no depth values are provided.
    if (Array.isArray(depths) && depths.length) {
      depthPool = Array.isArray(depths[0]) ? depths.map(d => d.slice()) : depths.slice();
    }
    for (let i = 0; i < items.length; i++) {
      const base = items[i];
      if (dividerSet.has(base)) {
        const candidate =
          (result.length ? result.join('') : '') +
          base;
        if (candidate.length > limit) break;
        result.push(base);
        continue;
      }
      let term = base;
      const inserted = [];
      const capturedMods = [];
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
          term = insertAtDepth(term, mod, adj, delimiter);
          inserted.push(adj);
          if (captureLog) capturedMods.push(mod);
        }
      });
      const candidate =
        (result.length ? result.join('') : '') +
        term;
      if (candidate.length > limit) break;
      result.push(term);
      if (captureLog) captureLog.push(capturedMods);
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
   * @param {boolean} [negAddendum=false] - Append negatives after positives instead of inserting them.
   * @param {string|RegExp} [delimiter=/\\s+/] - Delimiter used for chunk tails.
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
    negAddendum = false,
    delimiter = /\s+/
  ) {
    if (!items.length) {
      return { positive: '', negative: '' };
    }
    if (Array.isArray(baseOrder)) items = applyOrder(items, baseOrder);
    let dividerPool = dividers.slice();
    if (dividerPool.length && shuffleDividers) shuffle(dividerPool);
    const posTerms = applyModifierStack(
      items,
      posMods,
      limit,
      posStackSize,
      posOrder,
      delimiter,
      dividerPool,
      baseOrder,
      posDepths
    );
    let useNegDepths = negDepths;
    const negCapture = negAddendum ? [] : null;
    const negTerms = includePosForNeg
      ? applyNegativeOnPositive(
          posTerms,
          negMods,
          limit,
          negStackSize,
          negOrder,
          delimiter,
          dividerPool,
          null,
          useNegDepths,
          negCapture
        )
      : applyModifierStack(
          items,
          negMods,
          limit,
          negStackSize,
          negOrder,
          delimiter,
          dividerPool,
          baseOrder,
          negDepths,
          negCapture
        );
    const [trimNeg, trimPos] = equalizeLength(negTerms, posTerms);
    const positiveString = trimPos.join('');
    if (negAddendum && negCapture) {
      // Count how many non-divider terms remain so capture log aligns with trimmed negatives.
      const dividerSet = new Set(dividerPool);
      let keptTerms = 0;
      trimNeg.forEach(term => {
        if (!dividerSet.has(term)) keptTerms++;
      });
      const capturedForTrim = negCapture.slice(0, keptTerms);
      const negSoloList = [];
      capturedForTrim.forEach(entry => {
        if (Array.isArray(entry)) {
          entry.forEach(mod => {
            if (mod) negSoloList.push(mod);
          });
        } else if (entry) {
          negSoloList.push(entry);
        }
      });
      const tail = negSoloList.join('');
      if (tail) {
        return {
          positive: positiveString,
          negative: positiveString ? positiveString + tail : tail
        };
      }
      return {
        positive: positiveString,
        negative: positiveString
      };
    }
    return {
      positive: positiveString,
      negative: trimNeg.join('')
    };
  }

  /**
  * Normalize a block of lyrics text.
  * Most punctuation is stripped while internal apostrophes remain so
  * contractions keep their pronunciation. Parentheses or brackets can be
  * optionally removed, and random spacing up to `maxSpaces` is introduced
  * between words. Unicode letters from any language are preserved. Optional
  * insertions wrapped in
   * brackets can be injected every `interval` words, stacking multiple items
   * per insertion. When `randomize` is true the interval becomes the average
   * spacing and injection points are chosen uniformly across the lyrics.
   * Purpose: Process lyrics for use in prompts, adding randomness and optional
   * bracketed insertions with optional random placement.
  * Usage Example: processLyrics("hello world", 2, false, false, ['x'], 2, 1, true)
  *   may yield "hello [x] world". processLyrics("We'd", 1) returns "we'd".
   * 50% Rule: Regex cleaning, token insertion, and random spacing; comments,
   * example, and summary reinforce intent.
   * @param {string} text - Input lyrics.
   * @param {number} maxSpaces - Max spaces between words.
   * @param {boolean} [removeParens=false] - Remove parentheses.
   * @param {boolean} [removeBrackets=false] - Remove brackets.
   * @param {string[]} [insertions=[]] - Terms to inject in brackets.
   * @param {number} [interval=0] - Insert every N words.
   * @param {number} [stackSize=1] - Number of terms per insertion.
   * @param {boolean} [randomize=false] - Treat interval as mean and randomize positions.
   * @returns {string} - Processed lyrics.
   */
  function processLyrics(
    text,
    maxSpaces,
    removeParens = false,
    removeBrackets = false,
    insertions = [],
    interval = 0,
    stackSize = 1,
    randomize = false
  ) {
    if (!text) return '';
    const limit = parseInt(maxSpaces, 10);
    const max = !isNaN(limit) && limit > 0 ? limit : 1;
    let cleaned = text.toLowerCase();
    if (removeParens) cleaned = cleaned.replace(/\([^()]*\)/g, ' ');
    if (removeBrackets) cleaned = cleaned.replace(/\[[^\]]*\]|\{[^}]*\}|<[^>]*>/g, ' ');
    // Use Unicode property escapes so non-English letters remain intact
    // Allow straight (') and curly (\u2019) apostrophes to preserve contractions
    let pattern = '[^\\p{L}\\p{N}\\s';
    pattern += "'\u2019";
    if (!removeParens) pattern += '\\(\\)';
    if (!removeBrackets) pattern += '\\[\\]\\{\\}<>';
    pattern += ']';
    cleaned = cleaned.replace(new RegExp(pattern, 'gu'), '');
    cleaned = cleaned.replace(/\r?\n/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    const words = cleaned.split(' ');
    const tokens = [];
    let positions = [];
    if (randomize && insertions.length && interval > 0) {
      const count = Math.floor(words.length / interval);
      const slots = words.length - 1;
      const idxs = Array.from({ length: slots }, (_, i) => i + 1);
      positions = shuffle(idxs).slice(0, count).sort((a, b) => a - b);
    }
    let p = 0;
    words.forEach((w, i) => {
      tokens.push(w);
      const notEnd = i < words.length - 1;
      let insert = false;
      if (insertions.length && interval > 0 && notEnd) {
        if (randomize) {
          insert = positions[p] === i + 1;
        } else {
          insert = (i + 1) % interval === 0;
        }
      }
      if (insert) {
        const picks = shuffle(insertions.slice()).slice(0, stackSize);
        tokens.push(`[${picks.join(' ')}]`);
        if (randomize) p++;
      }
    });
    return tokens
      .map((t, i) => {
        if (i === tokens.length - 1) return t;
        const spaces = 1 + Math.floor(Math.random() * max);
        return t + ' '.repeat(spaces);
      })
      .join('');
  }

  const utils = {
    escapeRegExp,
    buildDelimiterRegex,
    parseInput,
    countWords,
    buildOrderIndices,
    applyOrderIfNeeded,
    buildDepthValues,
    sumStackWordsAt,
    computeDepthCountsFrom,
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
// Section Purpose: Manage preset lists for modifiers, lengths, lyrics, and insertions.
// Includes helpers for conflict resolution so imports merge safely.
// Structural Overview: Utilities handle comparisons and naming before
// initializing preset maps and providing load/save/delete operations.
// Section Summary: Centralizes preset handling for reusability across UI
// and logic using string-only lists so the delimiter-based parser can treat
// every preset consistently.

  /**
   * Normalize preset items into a string for storage and comparisons.
   * Purpose: Keep list handling predictable.
   * Usage Example: normalizePresetItems('a, b') returns 'a, b'.
   * 50% Rule: Explicit conversion keeps list handling consistent.
   * @param {string|number|undefined|null} items - Raw preset items.
   * @returns {string} - Normalized string.
   */
  function normalizePresetItems(items) {
    if (items == null) return '';
    return typeof items === 'string' ? items : String(items);
  }

  /**
   * Determine if two preset payloads represent the same text.
   * Purpose: Identify duplicate presets during merges.
   * Usage Example: listsEqual('a, b', 'a, b') returns true.
   * 50% Rule: Normalizes inputs, trims, and compares for clarity.
   * @param {any} a - First preset items.
   * @param {any} b - Second preset items.
   * @returns {boolean} - True when normalized strings match.
   */
  function listsEqual(a, b) {
    return normalizePresetItems(a).trim() === normalizePresetItems(b).trim();
  }

  /**
   * Generate a unique preset name when a conflict occurs.
   * Numbers in parentheses increment so 'List' -> 'List (1)' -> 'List (2)'.
   * Purpose: Preserve existing lists while importing new ones.
   * Usage Example: nextListName('list', presets, 'positive') yields 'list (1)'.
   * 50% Rule: Iterates to find highest suffix; comments summarize steps.
   * @param {string} name - Desired base name.
   * @param {Object[]} existing - Current preset collection.
   * @param {string} type - Preset type to compare within.
   * @returns {string} - Conflict-free name.
   */
  function nextListName(name, existing, type) {
    const base = name.replace(/ \((\d+)\)$/, '');
    const pattern = new RegExp('^' + escapeRegExp(base) + '(?: \\((\\d+)\\))?$');
    let max = 0;
    existing.forEach(p => {
      if (p.type !== type) return;
      const m = p.title.match(pattern);
      if (m) {
        const num = m[1] ? parseInt(m[1], 10) : 0;
        if (num > max) max = num;
      }
    });
    return `${base} (${max + 1})`;
  }

  let NEG_PRESETS = {};
  let POS_PRESETS = {};
  let LENGTH_PRESETS = {};
  let DIVIDER_PRESETS = {};
  let BASE_PRESETS = {};
  let LYRICS_PRESETS = {};
  let INSERT_PRESETS = {};

  let LISTS;
  /** Default presets load from `default_list.js` to keep this file lighter.
    * Custom builders may embed data directly but external loading keeps edits concise. */
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
   * Presets are alphabetized so scanning the list feels natural.
   * @param {HTMLSelectElement} selectEl - Select element to populate.
   * @param {Object[]} presets - Array of preset objects.
  */
  function populateSelect(selectEl, presets) {
    selectEl.innerHTML = '';
    const sorted = presets
      .slice() // clone so original order remains untouched
      .sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) // case-insensitive sort
      );
    sorted.forEach((preset, index) => {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.title;
      const hasItems = normalizePresetItems(preset.items).length > 0;
      if (index === 0 || (selectEl.value === '' && hasItems)) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
  }

  /**
   * Initialize preset maps from the LISTS structure. This also rebuilds the
   * dropdown menus in the UI when presets change.
   * Purpose: Load and categorize presets, update UI selects.
   * Usage: Called on init and after imports.
   * 50% Rule: Filters by type with arrays; calls populate for each.
   * Depth/order dropdowns now only use built-in modes (no stored presets).
   * Select menus populate alphabetically via helper sort.
   * @param {Object} [opts] - Options to control refresh behavior.
   */
  function loadLists(opts = {}) {
    NEG_PRESETS = {};
    POS_PRESETS = {};
    LENGTH_PRESETS = {};
    DIVIDER_PRESETS = {};
    BASE_PRESETS = {};
    LYRICS_PRESETS = {};
    INSERT_PRESETS = {};
    const neg = [];
    const pos = [];
    const len = [];
    const divs = [];
    const base = [];
    const lyrics = [];
    const inserts = [];
    if (LISTS.presets && Array.isArray(LISTS.presets)) {
      LISTS.presets.forEach(p => {
        if (p.type === 'negative') {
          NEG_PRESETS[p.id] = normalizePresetItems(p.items);
          neg.push(p);
        } else if (p.type === 'positive') {
          POS_PRESETS[p.id] = normalizePresetItems(p.items);
          pos.push(p);
        } else if (p.type === 'length') {
          LENGTH_PRESETS[p.id] = normalizePresetItems(p.items);
          len.push(p);
        } else if (p.type === 'divider') {
          DIVIDER_PRESETS[p.id] = normalizePresetItems(p.items);
          divs.push(p);
        } else if (p.type === 'base') {
          BASE_PRESETS[p.id] = normalizePresetItems(p.items);
          base.push(p);
        } else if (p.type === 'lyrics') {
          LYRICS_PRESETS[p.id] = normalizePresetItems(p.items);
          lyrics.push(p);
        } else if (p.type === 'insertion') {
          INSERT_PRESETS[p.id] = normalizePresetItems(p.items);
          inserts.push(p);
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
    const insertSelect = document.getElementById('lyrics-insert-select');
    if (insertSelect) populateSelect(insertSelect, inserts);
    // Refresh order dropdowns so standard modes remain consistent.
    document.querySelectorAll('[id*="-order-select"]').forEach(select => {
      populateOrderOptions(select);
    });
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
          items: normalizePresetItems(p.items)
        }))
      };
    } else {
      const existing = LISTS.presets.slice();
      obj.presets.forEach(p => {
        const items = normalizePresetItems(p.items);
        const sameName = existing.filter(
          e => e.type === p.type && e.title === p.title
        );
        if (sameName.length) {
          const dup = sameName.find(e => listsEqual(e.items || [], items));
          if (!dup) {
            const unique = nextListName(p.title, existing, p.type);
            existing.push({ id: unique, title: unique, type: p.type, items });
          }
        } else {
          const id = p.id || p.title;
          existing.push({ id, title: p.title, type: p.type, items });
        }
      });
      LISTS.presets = existing;
    }
    // Drop legacy order presets if present; order/depth presets are no longer stored.
    LISTS.presets = LISTS.presets.filter(p => p.type !== 'order');
    loadLists();
  }

  /**
   * Save the list typed into the UI back into the preset store. Prompts the
   * user for a preset name.
  * Purpose: Persist user-entered lists as presets.
  * Usage: Called on save button clicks.
  * 50% Rule: Handles different types with map; updates UI.
  * Adds new options in alphabetical order so lists remain sorted immediately.
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
      insertion: { select: 'lyrics-insert-select', input: 'lyrics-insert-input', store: INSERT_PRESETS }
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
    const items = inp.value;
    let preset = LISTS.presets.find(p => p.id === name && p.type === type);
   if (!preset) {
      preset = { id: name, title: name, type, items };
      LISTS.presets.push(preset);
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      // Walk every matching select so stacked lists stay in sync.
      document
        .querySelectorAll(`select[id^="${cfg.select}"]`)
        .forEach(s => {
          if (s.querySelector(`option[value="${name}"]`)) return;
          const clone = opt.cloneNode(true); // copy for each select
          const insertBefore = Array.from(s.querySelectorAll('option')).find(o =>
            o.textContent.localeCompare(name, undefined, { sensitivity: 'base' }) > 0
          );
          if (insertBefore) {
            s.insertBefore(clone, insertBefore); // insert to keep list sorted
          } else {
            s.appendChild(clone); // fallback to end if no later option
          }
        });
    } else {
      preset.items = items;
    }
    cfg.store[name] = items;
    sel.value = name;
  }

  /**
   * Remove the selected preset from both storage and UI.
   * Purpose: Delete a saved list.
   * Usage: Triggered by delete button clicks.
   * 50% Rule: Confirms, prunes maps, refreshes selects.
   * @param {string} type - List type to delete.
   * @param {number} [index=1] - Stack index.
   */
  function deleteList(type, index = 1) {
    const map = {
      base: { select: 'base-select', input: 'base-input', store: BASE_PRESETS },
      negative: { select: 'neg-select', input: 'neg-input', store: NEG_PRESETS },
      positive: { select: 'pos-select', input: 'pos-input', store: POS_PRESETS },
      length: { select: 'length-select', input: 'length-input', store: LENGTH_PRESETS },
      divider: { select: 'divider-select', input: 'divider-input', store: DIVIDER_PRESETS },
      lyrics: { select: 'lyrics-select', input: 'lyrics-input', store: LYRICS_PRESETS },
      insertion: { select: 'lyrics-insert-select', input: 'lyrics-insert-input', store: INSERT_PRESETS }
    };
    const cfg = map[type];
    if (!cfg) return;
    const selId = index === 1 ? cfg.select : `${cfg.select}-${index}`;
    const inpId = index === 1 ? cfg.input : `${cfg.input}-${index}`;
    const sel = document.getElementById(selId);
    const inp = document.getElementById(inpId);
    if (!sel || !sel.value) return;
    const name = sel.value;
    if (typeof confirm === 'function' && !confirm(`Delete list ${name}?`)) return;
    LISTS.presets = LISTS.presets.filter(p => !(p.id === name && p.type === type));
    delete cfg.store[name];
    document.querySelectorAll(`select[id^="${cfg.select}"]`).forEach(s => {
      const opt = s.querySelector(`option[value="${name}"]`);
      if (opt) {
        const wasSel = s.value === name;
        opt.remove();
        if (wasSel) {
          s.selectedIndex = 0;
          s.dispatchEvent(new Event('change'));
        }
      }
    });
    if (inp && sel.value === name) inp.value = '';
  }

  const lists = {
    get NEG_PRESETS() { return NEG_PRESETS; },
    get POS_PRESETS() { return POS_PRESETS; },
    get LENGTH_PRESETS() { return LENGTH_PRESETS; },
    get DIVIDER_PRESETS() { return DIVIDER_PRESETS; },
    get BASE_PRESETS() { return BASE_PRESETS; },
    get LYRICS_PRESETS() { return LYRICS_PRESETS; },
    get INSERT_PRESETS() { return INSERT_PRESETS; },
    loadLists,
    exportLists,
    importLists,
    saveList,
    deleteList
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
// Section Summary: Manages persistence for lists and state, with reset
// falling back to built-in defaults.

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
    if (data.lists) lists.importLists(data.lists, true);
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
   * 50% Rule: Remove and import default or fallback lists.
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
    } else if (typeof DEFAULT_LIST !== 'undefined') {
      // Fallback when no full state is provided
      lists.importLists(DEFAULT_LIST);
    }
  }

  const storage = { exportData, importData, persist, loadPersisted, resetData };

// ======== UI Controls ========
// Section Purpose: Handle user interface interactions and event setups.
// Layers multiple setup functions and event listeners for comprehensive UI control.
// Structural Overview: Many setup functions for buttons, toggles, etc.
// Section Summary: Manages all DOM interactions and event binding, ensuring
// dropdowns stay current after list imports while order modes are
// resolved at generation time instead of storing index arrays.

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
   * Gather all select controls that share a prefix and base id.
   * Purpose: Collect stacked order selects for section-wide toggles.
   * Usage: In setupSectionOrder and related reflection helpers.
   * 50% Rule: Loop until no more ids are found.
   * @param {string} prefix - Section prefix.
   * @param {string} base - Base id part.
   * @returns {Object[]} - Array of {select}.
   */
  function gatherControls(prefix, base) {
    const results = [];
    forEachId(`${prefix}-${base}-select`, sel => {
      results.push({ select: sel });
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
   * Normalize a custom delimiter string, translating escape sequences.
   * Purpose: Allow \n and \t in custom delimiter inputs without literal backslashes.
   * Usage Example: normalizeCustomDelimiter('\\n') returns '\n'.
   * 50% Rule: Keeps input handling explicit with example + intent.
   * @param {string} value - Raw custom delimiter input.
   * @returns {string} - Normalized delimiter.
   */
  function normalizeCustomDelimiter(value) {
    if (value == null) return '';
    return String(value).replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }

  /**
   * Map delimiter UI controls into a reusable parsing configuration.
   * Purpose: Centralize delimiter parsing so every list uses the same chunking logic.
   * Usage Example: getDelimiterConfig().regex is passed to parseInput for modifiers.
   * 50% Rule: Summarizes intent, documents returned fields, and keeps inline comments for defaults.
   * @returns {{mode: string, delimiter: string, regex: RegExp, joiner: string, sentenceMode: boolean}}
   */
  function getDelimiterConfig() {
    const select = document.getElementById('delimiter-select');
    const customInput = document.getElementById('delimiter-custom');
    const mode = select?.value || 'whitespace';
    let delimiter = ' '; // default to whitespace when controls are missing
    let sentenceMode = false;
    if (mode === 'whitespace') delimiter = ' ';
    else if (mode === 'comma') delimiter = ',';
    else if (mode === 'semicolon') delimiter = ';';
    else if (mode === 'pipe') delimiter = '|';
    else if (mode === 'newline') delimiter = '\n';
    else if (mode === 'tab') delimiter = '\t';
    else if (mode === 'sentence') sentenceMode = true;
    else if (mode === 'custom') delimiter = normalizeCustomDelimiter(customInput?.value || '');

    // Treat empty custom input as whitespace so parsing never stalls.
    if (!sentenceMode && !delimiter) delimiter = ' ';

    const regex = sentenceMode ? /[,.!:;?\n]+/ : utils.buildDelimiterRegex(delimiter);
    const joiner = sentenceMode ? ' ' : buildDelimiterJoiner(delimiter);
    return { mode, delimiter, regex, joiner, sentenceMode };
  }

  /**
   * Choose a display joiner for presets based on delimiter.
   * Purpose: Keep preset text readable by adding spacing when delimiters lack whitespace.
   * Usage Example: buildDelimiterJoiner(',') returns ', '.
   * 50% Rule: Includes fallback rules and example to reinforce behavior.
   * @param {string} delimiter - Delimiter string.
   * @returns {string} - Joiner for UI display.
   */
  function buildDelimiterJoiner(delimiter) {
    if (!delimiter) return ' ';
    if (delimiter === '\n') return '\n';
    if (delimiter === '\t') return '\t';
    if (delimiter === ' ') return ' ';
    if (/\s/.test(delimiter)) return delimiter;
    return `${delimiter} `;
  }

  /**
   * Parse a base list using the active delimiter settings.
   * Purpose: Switch between sentence punctuation mode and delimiter-preserving chunking.
   * Usage Example: parseBaseInput('foo bar') respects the current delimiter mode.
   * 50% Rule: Explicitly documents why base parsing differs from modifiers.
   * @param {string} raw - Raw base input.
   * @param {{regex: RegExp, sentenceMode: boolean}} delimiter - Delimiter config.
   * @returns {string[]} - Parsed base items.
   */
  function parseBaseInput(raw, delimiter) {
    if (delimiter.sentenceMode) return utils.parseInput(raw, true);
    return utils.parseInput(raw, false, delimiter.regex);
  }

  /**
   * Parse a modifier-style list using the active delimiter settings.
   * Purpose: Standardize delimiter-preserving parsing for positives, negatives, and insertions.
   * Usage Example: parseListInput('a|b', config) splits by the chosen delimiter.
   * 50% Rule: Mirrors parseBaseInput with a different emphasis for clarity.
   * @param {string} raw - Raw list input.
   * @param {{regex: RegExp}} delimiter - Delimiter config.
   * @returns {string[]} - Parsed items.
   */
  function parseListInput(raw, delimiter) {
    return utils.parseInput(raw, false, delimiter.regex);
  }

  /**
   * Read a select value with a fallback when missing.
   * Purpose: Normalize mode reads for order selectors.
   * Usage Example: readSelectMode('base-order-select', 'canonical').
   * 50% Rule: Guarded lookup plus default.
   * @param {string} id - Select element id.
   * @param {string} fallback - Default mode.
   * @returns {string} - Selected value or fallback.
   */
  function readSelectMode(id, fallback) {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
  }

  /**
   * Collect select modes for a stacked control group.
   * Purpose: Provide per-stack mode arrays for order logic.
   * Usage Example: collectSelectModes('pos', 'order', 2, 'canonical').
   * 50% Rule: Iterates with explicit ids and inline fallback.
   * @param {string} prefix - Section prefix.
   * @param {string} base - Base id segment ('order').
   * @param {number} count - Number of stacks.
   * @param {string} fallback - Default mode.
   * @returns {string[]} - Mode list.
   */
  function collectSelectModes(prefix, base, count, fallback) {
    const modes = [];
    for (let i = 1; i <= count; i++) {
      const id = `${prefix}-${base}-select${i === 1 ? '' : '-' + i}`;
      modes.push(readSelectMode(id, fallback));
    }
    return modes;
  }

  /**
   * Parse stack inputs into arrays using the active delimiter.
   * Purpose: Centralize stack parsing for orders.
   * Usage Example: collectStackInputs('pos', 2, config) returns two lists.
   * 50% Rule: Iterates stack indices with inline guards.
   * @param {string} prefix - Section prefix.
   * @param {number} count - Stack count.
   * @param {{regex: RegExp}} delimiter - Delimiter config.
   * @returns {string[][]} - Parsed stacks.
   */
  function collectStackInputs(prefix, count, delimiter) {
    const stacks = [];
    for (let i = 1; i <= count; i++) {
      const id = `${prefix}-input${i === 1 ? '' : '-' + i}`;
      const el = document.getElementById(id);
      stacks.push(parseListInput(el?.value || '', delimiter));
    }
    return stacks;
  }

  /**
   * Resolve ephemeral order arrays and ordered stacks from mode selections.
   * Purpose: Compute on-demand ordering without storing index arrays in the UI.
   * Usage Example: resolveStackOrders([['a','b']], ['random']) returns orders + ordered lists.
   * 50% Rule: Builds indices, applies them, and keeps steps explicit.
   * @param {string[][]} stacks - Modifier stacks.
   * @param {string[]} modes - Order modes per stack.
   * @returns {{orders: (number[]|null)[], ordered: string[][]}} - Orders + ordered stacks.
   */
  function resolveStackOrders(stacks, modes) {
    const orders = [];
    const ordered = [];
    const fallback = modes[0] || 'canonical';
    stacks.forEach((items, i) => {
      const mode = modes[i] || fallback;
      const order = utils.buildOrderIndices(items, mode) || [];
      orders.push(order);
      ordered.push(utils.applyOrderIfNeeded(items, order));
    });
    return { orders, ordered };
  }

  /**
   * Determine insertion depth counts using current DOM inputs and modes.
   * Purpose: Provide depth counts for random depth calculation at generate time.
   * Usage: Called in collectInputs and tests.
   * 50% Rule: Builds ordered stacks, counts base words, then delegates to pure helper.
   * @param {string} prefix - Section prefix ('pos' or 'neg').
   * @param {number} [idx=1] - Stack index (1-based).
   * @returns {number[]} - Depth counts.
   */
  function computeDepthCounts(prefix, idx = 1) {
    const delimiter = getDelimiterConfig();
    const baseInput = document.getElementById('base-input');
    const baseItems = parseBaseInput(baseInput?.value || '', delimiter);
    const baseOrderMode = readSelectMode('base-order-select', 'canonical');
    const baseOrder = utils.buildOrderIndices(baseItems, baseOrderMode);
    const orderedBaseItems = utils.applyOrderIfNeeded(baseItems, baseOrder);
    const baseCounts = orderedBaseItems.map(b => utils.countWords(b));

    const stackOn = document.getElementById(`${prefix}-stack`)?.checked;
    const stackSize = parseInt(
      document.getElementById(`${prefix}-stack-size`)?.value || '1',
      10
    );
    const count = stackOn ? stackSize : 1;
    const stacks = collectStackInputs(prefix, count, delimiter);
    const orderModes = collectSelectModes(prefix, 'order', count, 'canonical');
    const { ordered } = resolveStackOrders(stacks, orderModes);

    const includePos =
      prefix === 'neg' &&
      document.getElementById('neg-include-pos')?.checked;
    let posOrdered = [];
    if (includePos) {
      const posStackOn = document.getElementById('pos-stack')?.checked;
      const posStackSize = parseInt(
        document.getElementById('pos-stack-size')?.value || '1',
        10
      );
      const posCount = posStackOn ? posStackSize : 1;
      const posStacks = collectStackInputs('pos', posCount, delimiter);
      const posOrderModes = collectSelectModes('pos', 'order', posCount, 'canonical');
      posOrdered = resolveStackOrders(posStacks, posOrderModes).ordered;
    }
    return utils.computeDepthCountsFrom(baseCounts, ordered, idx, includePos, posOrdered);
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
      } else if (presetsOrType === 'insertion') {
        presets = lists.INSERT_PRESETS;
      } else {
        presets = {};
      }
    }
    const key = selectEl.value;
    const list = normalizePresetItems(presets[key]);
    if (inputEl.tagName === 'TEXTAREA') {
      inputEl.value = list;
    } else if (presetsOrType === 'length' || presets === lists.LENGTH_PRESETS) {
      const delimiter = getDelimiterConfig();
      const first = parseListInput(list, delimiter)[0] || list;
      inputEl.value = first;
    } else {
      inputEl.value = list;
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
   * Delimiter settings are applied so base and modifier lists split consistently.
   * Purpose: Collect and parse all form inputs.
   * Usage: In generate.
   * 50% Rule: Handles stacking, parses all fields, and computes order/depth arrays on demand.
   * @returns {Object} - Input object for buildVersions.
   */
  function collectInputs() {
    const delimiter = getDelimiterConfig();
    const baseEl = document.getElementById('base-input');
    const baseItems = parseBaseInput(baseEl?.value || '', delimiter);
    const posStackOn = document.getElementById('pos-stack').checked;
    const posStackSize = parseInt(document.getElementById('pos-stack-size')?.value || '1', 10);
    const negStackOn = document.getElementById('neg-stack').checked;
    const negStackSize = parseInt(document.getElementById('neg-stack-size')?.value || '1', 10);
    const posCount = posStackOn ? posStackSize : 1;
    const negCount = negStackOn ? negStackSize : 1;

    const posStacks = collectStackInputs('pos', posCount, delimiter);
    const negStacks = collectStackInputs('neg', negCount, delimiter);
    const includePosForNeg = document.getElementById('neg-include-pos').checked;
    const negAddendum = document.getElementById('neg-addendum')?.checked || false; // Toggle routes negatives as addendum when true.

    const baseOrderMode = readSelectMode('base-order-select', 'canonical');
    const posOrderModes = collectSelectModes('pos', 'order', posCount, 'canonical');
    const negOrderModes = collectSelectModes('neg', 'order', negCount, 'canonical');

    const baseOrder = utils.buildOrderIndices(baseItems, baseOrderMode);
    const orderedBaseItems = utils.applyOrderIfNeeded(baseItems, baseOrder);
    const baseCounts = orderedBaseItems.map(b => utils.countWords(b));

    const { orders: posOrders, ordered: posOrdered } = resolveStackOrders(posStacks, posOrderModes);
    const { orders: negOrders, ordered: negOrdered } = resolveStackOrders(negStacks, negOrderModes);

    const posDepthStacks = posOrdered.map((_, i) => {
      const counts = utils.computeDepthCountsFrom(baseCounts, posOrdered, i + 1, false, []);
      return utils.buildDepthValues('random', counts) || counts.map(() => 0);
    });
    const negDepthStacks = negOrdered.map((_, i) => {
      const counts = utils.computeDepthCountsFrom(baseCounts, negOrdered, i + 1, includePosForNeg, posOrdered);
      return utils.buildDepthValues('random', counts) || counts.map(() => 0);
    });

    const posMods = posStackOn ? posStacks : posStacks[0];
    const negMods = negStackOn ? negStacks : negStacks[0];
    const posOrder = posStackOn ? posOrders : posOrders[0];
    const negOrder = negStackOn ? negOrders : negOrders[0];
    const posDepths = posStackOn ? posDepthStacks : posDepthStacks[0];
    const negDepths = negStackOn ? negDepthStacks : negDepthStacks[0];

    const dividerMods = parseListInput(document.getElementById('divider-input')?.value || '', delimiter);
    const shuffleDividers = document.getElementById('divider-shuffle')?.checked;
    const lengthSelect = document.getElementById('length-select');
    const lengthInput = document.getElementById('length-input');
    let limit = parseInt(lengthInput.value, 10);
    if (isNaN(limit) || limit <= 0) {
      const preset = lists.LENGTH_PRESETS[lengthSelect.value];
      const first = preset ? parseListInput(preset, delimiter)[0] || preset : '';
      const parsed = parseInt(first, 10);
      limit = !isNaN(parsed) && parsed > 0 ? parsed : 1000;
      lengthInput.value = limit;
    }
    return {
      delimiterConfig: delimiter,
      baseItems,
      negMods,
      posMods,
      posStackOn,
      posStackSize,
      negStackOn,
      negStackSize,
      limit,
      includePosForNeg,
      negAddendum,
      dividerMods,
      shuffleDividers,
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
   * 50% Rule: Calls collect, build, display; handles lyrics and insertions too.
   */
  function generate() {
    const {
      delimiterConfig,
      baseItems,
      negMods,
      posMods,
      posStackOn,
      posStackSize,
      negStackOn,
      negStackSize,
      limit,
      includePosForNeg,
      negAddendum,
      dividerMods,
      shuffleDividers,
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
      negAddendum,
      delimiterConfig?.regex || /\s+/
    );
    displayOutput(result);

    const lyricsInput = document.getElementById('lyrics-input');
    if (lyricsInput && lyricsInput.value.trim()) {
      const spaceSel = document.getElementById('lyrics-space');
      const maxSpaces = spaceSel ? spaceSel.value : 1;
      const removeParens = document.getElementById('lyrics-remove-parens')?.checked;
      const removeBrackets = document.getElementById('lyrics-remove-brackets')?.checked;
      // Insertions: list of bracketed terms, word interval, stack size, and optional randomization
      const insertInput = document.getElementById('lyrics-insert-input');
      const delimiter = getDelimiterConfig();
      const insertItems = insertInput
        ? parseListInput(insertInput?.value || '', delimiter)
        : [];
      const intervalSel = document.getElementById('lyrics-insert-interval');
      const interval = intervalSel ? parseInt(intervalSel.value, 10) : 0;
      const stackSel = document.getElementById('lyrics-insert-stack');
      const stack = stackSel ? parseInt(stackSel.value, 10) : 1;
      const randCb = document.getElementById('lyrics-insert-random');
      const randomize = randCb ? randCb.checked : false;
      const processed = utils.processLyrics(
        lyricsInput.value,
        maxSpaces,
        removeParens,
        removeBrackets,
        insertItems,
        interval,
        stack,
        randomize
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
   * Show/hide custom delimiter input based on dropdown selection.
   * Purpose: Keep delimiter UI concise while still supporting arbitrary separators.
   * Usage: In initializeUI.
   * 50% Rule: Event-driven update with inline state notes for clarity.
   */
  function setupDelimiterControls() {
    const select = document.getElementById('delimiter-select');
    const customRow = document.getElementById('delimiter-custom-row');
    const customInput = document.getElementById('delimiter-custom');
    if (!select) return;
    const update = () => {
      const show = select.value === 'custom';
      if (customRow) customRow.style.display = show ? '' : 'none';
      if (customInput) customInput.disabled = !show;
    };
    select.addEventListener('change', update);
    update();
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
   * Global randomization toggle affecting all order selects.
   * Purpose: Sync all to random or canonical.
   * Usage: In initializeUI.
   * 50% Rule: Reflect and update functions.
   */
  function setupShuffleAll() {
    const allRandom = document.getElementById('all-random');
    if (!allRandom) return;
    const reflect = () => {
      const selects = Array.from(
        document.querySelectorAll('[id*="-order-select"]')
      );
      const allRand = selects.every(s => s.value === 'random');
      const allCan = selects.every(s => s.value === 'canonical');
      const btn = document.querySelector('.toggle-button[data-target="all-random"]');
      if (btn) {
        btn.classList.remove('active', 'indeterminate');
        if (allRand) btn.classList.add('active');
        else if (!allCan) btn.classList.add('indeterminate');
      }
    };
    const updateAll = () => {
      const selects = Array.from(
        document.querySelectorAll('[id*="-order-select"]')
      );
      selects.forEach(sel => {
        sel.value = allRandom.checked ? 'random' : 'canonical';
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
    document.querySelectorAll('[id*="-order-select"]').forEach(sel => {
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
    const sels = Array.from(
      document.querySelectorAll('[id*="-order-select"]')
    );
    const allRand = sels.every(s => s.value === 'random');
    const allCan = sels.every(s => s.value === 'canonical');
    const btn = document.querySelector('.toggle-button[data-target="all-random"]');
    reflectToggleState(btn, allRand, !allCan && !allRand);
  }

  /** 
   * Mirror randomization state for a section's order controls.
   * Purpose: Section random reflection.
   * Usage: In setupSectionOrder.
   * 50% Rule: Every checks.
   * @param {string} prefix - Prefix.
   */
  function reflectSectionOrder(prefix) {
    const cb = document.getElementById(`${prefix}-order-random`);
    if (!cb) return;
    const sels = [
      ...gatherControls(prefix, 'order')
    ].map(p => p.select).filter(Boolean);
    const allRand = sels.every(s => s.value === 'random');
    const allCan = sels.every(s => s.value === 'canonical');
    const btn = document.querySelector(`.toggle-button[data-target="${cb.id}"]`);
    reflectToggleState(btn, allRand, !allCan && !allRand);
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
    const update = () => {
      const sels = [
        ...gatherControls(prefix, 'order')
      ].map(p => p.select).filter(Boolean);
      sels.forEach(s => {
        s.value = cb.checked ? 'random' : 'canonical';
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
    });
    reflectSectionOrder(prefix);
  }

  const rerollUpdaters = {};

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
   * Purpose: Copy to clipboard with an execCommand fallback.
   * Usage: In initializeUI.
   * 50% Rule: Async path plus fallback so copy works in more contexts.
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
          const fallbackCopy = () => {
            // Fallback for file://, permission blocks, or missing clipboard APIs.
            if (target.value !== undefined && typeof target.select === 'function') {
              target.select();
            } else {
              const range = document.createRange();
              range.selectNodeContents(target);
              const selection = window.getSelection();
              if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
              }
            }
            document.execCommand('copy');
            const selection = window.getSelection();
            if (selection) selection.removeAllRanges();
          };
          // Prefer modern clipboard API, but fall back when missing or rejected.
          if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
              await navigator.clipboard.writeText(text);
            } catch (err) {
              fallbackCopy();
            }
          } else {
            fallbackCopy();
          }
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
   * Fill order dropdown with built-in ordering modes.
   * Purpose: Populate order selects.
   * Usage: In initializeUI and dynamic stack creation.
   * 50% Rule: Static options + selection preservation.
   * @param {HTMLSelectElement} select - Select to populate.
   */
  function populateOrderOptions(select) {
    if (!select) return;
    // Preserve selection across repopulation to avoid unexpected resets.
    const previous = select.value;
    select.innerHTML = '';
    const opts = [
      { id: 'canonical', title: 'Canonical' },
      { id: 'random', title: 'Randomized' }
    ];
    opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.title;
      select.appendChild(opt);
    });
    if (previous && select.querySelector(`option[value="${previous}"]`)) {
      select.value = previous;
    }
  }

  /** 
   * Generate stacked modifier blocks dynamically for positive or negative lists.
   * Purpose: Create stack UI blocks.
   * Usage: In setupStackControls.
   * 50% Rule: Dynamic element creation with mode-only order controls.
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
      save.dataset.help = 'Save current list to presets.';
      save.addEventListener('click', () => lists.saveList(type, idx));
      btnCol.appendChild(save);
      const del = document.createElement('button');
      del.type = 'button';
      del.id = `${prefix}-delete-${idx}`;
      del.className = 'delete-button icon-button';
      del.title = 'Delete';
      // Trash bin icon clarifies destructive action without extra color cues
      del.innerHTML = '&#128465;&#65039;';
      del.dataset.help = `Remove selected ${type} preset.`;
      del.addEventListener('click', () => lists.deleteList(type, idx));
      btnCol.appendChild(del);
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
      hideCb.dataset.targets = `${prefix}-input-${idx}`;
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

      const orderSel = document.createElement('select');
      orderSel.id = `${prefix}-order-select-${idx}`;
      populateOrderOptions(orderSel);
      const baseOrderSel = document.getElementById(`${prefix}-order-select`);
      if (baseOrderSel) orderSel.value = baseOrderSel.value;
      if (prefix === 'pos' || prefix === 'neg') {
        orderSel.hidden = true;
        block.appendChild(orderSel);
      } else {
        const orderCont = document.createElement('div');
        orderCont.id = `${prefix}-order-container-${idx}`;
        const oLabelRow = document.createElement('div');
        oLabelRow.className = 'label-row';
        const oLbl = document.createElement('label');
        oLbl.textContent = type.charAt(0).toUpperCase() + type.slice(1) + ' Ordering';
        oLbl.setAttribute('for', orderSel.id);
        oLabelRow.appendChild(oLbl);
        orderCont.appendChild(oLabelRow);
        orderCont.appendChild(orderSel);
        block.appendChild(orderCont);
      }

      container.appendChild(block);
      setupPresetListener(sel.id, ta.id, type);
      applyPreset(sel, ta, type);
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
  }

  /** 
   * Button that toggles order selects between random and canonical.
   * Purpose: Reroll ordering.
   * Usage: In updateStackBlocks.
   * 50% Rule: Toggles modes.
   * @param {string} btnId - Button id.
   * @param {string} selectId - Select id.
   */
  function setupRerollButton(btnId, selectId) {
    const btn = document.getElementById(btnId);
    const select = document.getElementById(selectId);
    if (!btn || !select) return;
    const prefix = guessPrefix(selectId);
    const idx = (selectId.match(/-(\d+)$/) || [])[1] ? parseInt(selectId.match(/-(\d+)$/)[1], 10) : 1;
    const selFor = base => document.getElementById(`${prefix}-${base}-select${idx === 1 ? '' : '-' + idx}`);
    const gather = () => [selFor('order')].filter(Boolean);
    const updateState = () => {
      const sels = gather();
      const allRand = sels.every(s => s.value === 'random');
      const allCan = sels.every(s => s.value === 'canonical');
      reflectToggleState(btn, allRand, !allCan && !allRand);
      reflectAllRandom();
    };
    const reroll = () => {
      const sels = gather();
      const allRand = sels.every(s => s.value === 'random');
      sels.forEach(s => {
        const target = allRand ? 'canonical' : 'random';
        s.value = target;
        s.dispatchEvent(new Event('change'));
      });
      updateState();
    };
    btn.addEventListener('click', reroll);
    gather().forEach(s => s.addEventListener('change', updateState));
    if (!rerollUpdaters[prefix]) rerollUpdaters[prefix] = [];
    rerollUpdaters[prefix].push(updateState);
    updateState();
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
    const insSel = document.getElementById('lyrics-insert-select');
    const insInp = document.getElementById('lyrics-insert-input');
    if (insSel && insInp) applyPreset(insSel, insInp, 'insertion');
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
   * Enable help mode with clickable tooltips.
   * Purpose: Explain UI elements via data-help attributes.
   * Usage: Called in initializeUI.
   * 50% Rule: Maps help text, applies it to new and existing controls, then intercepts clicks and displays a tooltip.
   */
  function setupHelpMode() {
    const cb = document.getElementById('help-mode');
    if (!cb) return; // Guard if toggle is missing

    // Map selectors to descriptive text
    const helpMap = {
      '#load-data': 'Load prompt lists from a JSON file.',
      '#save-data': 'Save current lists as JSON.',
      '#reset-data': 'Reset lists to defaults.',
      '[data-target="all-hide"]': 'Show or hide every section.',
      '[data-target="all-random"]': 'Toggle global randomization.',
      '[data-target="help-mode"]': 'Enable help mode; clicking reveals tooltips.',
      '#generate': 'Build prompts using current settings.',
      '.section-data': 'Manage stored prompt lists.',
      '.section-actions': 'Global toggles including help mode.',
      '.section-parsing': 'Parsing controls for list delimiters.',
      '.section-base': 'Base prompts anchoring the concept.',
      '.section-positive': 'Positive modifiers or outputs.',
      '.section-negative': 'Negative modifiers or outputs.',
      '.section-divider': 'Connector phrases placed between terms.',
      '.section-length': 'Character limit controls.',
      '.section-lyrics': 'Lyrics entry and processing.',
      // Toggle buttons
      '[data-target="pos-stack"]': 'Combine multiple positive lists.',
      '[data-target="pos-all-hide"]': 'Show or hide all positive stacks.',
      '[data-target="pos-order-random"]': 'Randomize order of positive modifiers.',
      '[data-target="neg-addendum"]': 'Append negatives after the full positive prompt instead of inserting them.',
      '[data-target="neg-include-pos"]': 'Apply negatives after positive prompt.',
      '[data-target="neg-stack"]': 'Combine multiple negative lists.',
      '[data-target="neg-all-hide"]': 'Show or hide all negative stacks.',
      '[data-target="neg-order-random"]': 'Randomize order of negative modifiers.',
      '[data-target="lyrics-remove-parens"]': 'Strip parentheses from lyrics before processing.',
      '[data-target="lyrics-remove-brackets"]': 'Strip brackets from lyrics before processing.',
      '[data-target="lyrics-insert-random"]': 'Randomize insertion intervals for lyric terms.',
      // Inputs and lists
      '#delimiter-select': 'Choose how typed text is chunked (default is whitespace). Delimiters stay with chunks and outputs are concatenated directly.',
      '#delimiter-custom': 'Custom delimiter text; supports \\n for newline and \\t for tab. Delimiters remain attached to chunks.',
      '#base-select': 'Choose base prompt preset.',
      '#base-input': 'Base prompts are chunked by the selected delimiter; delimiters stay on the chunks.',
      '#base-order-select': 'Order mode for base prompts (canonical or randomized).',
      'select[id^="pos-select"]': 'Choose positive list preset.',
      'textarea[id^="pos-input"]': 'Positive modifiers are chunked by the selected delimiter; delimiters stay on the chunks.',
      'select[id^="pos-order-select"]': 'Ordering mode for positives; applied when generating.',
      '#pos-stack-size': 'Number of positive stacks.',
      'select[id^="neg-select"]': 'Choose negative list preset.',
      'textarea[id^="neg-input"]': 'Negative modifiers are chunked by the selected delimiter; delimiters stay on the chunks.',
      'select[id^="neg-order-select"]': 'Ordering mode for negatives; applied when generating.',
      '#neg-stack-size': 'Number of negative stacks.',
      '#divider-select': 'Choose divider preset.',
      '#divider-input': 'Divider phrases are chunked by the delimiter and inserted as-is.',
      '#length-select': 'Preset length limits.',
      '#length-input': 'Maximum allowed characters.',
      '#lyrics-select': 'Choose lyrics preset.',
      '#lyrics-input': 'Lyrics text with optional random spacing.',
      '#lyrics-space': 'Max spaces inserted between lyric words.',
      '#lyrics-insert-select': 'Choose insertion terms preset.',
      '#lyrics-insert-input': 'Terms to inject into lyrics, chunked by the selected delimiter.',
      '#lyrics-insert-interval': 'Interval for lyric insertions.',
      '#lyrics-insert-stack': 'Number of terms inserted each time.'
    };

    // Apply help text to matching elements
    const applyHelpHints = (root = document) => {
      Object.entries(helpMap).forEach(([sel, text]) => {
        root.querySelectorAll(sel).forEach(el => {
          if (!el.dataset.help) el.dataset.help = text;
        });
      });
    };
    applyHelpHints();

    // Observe DOM changes so newly added inputs also get help text
    const observer = new MutationObserver(muts => {
      muts.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) applyHelpHints(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Specific help for output containers
    const posOut = document.getElementById('positive-output');
    if (posOut) posOut.closest('.input-group').dataset.help = 'Resulting positive prompt.';
    const negOut = document.getElementById('negative-output');
    if (negOut) negOut.closest('.input-group').dataset.help = 'Resulting negative prompt.';
    const lyrOut = document.getElementById('lyrics-output');
    if (lyrOut) lyrOut.closest('.input-group').dataset.help = 'Processed lyrics with randomized spacing.';
    // Generic helpers for common button classes
    document.querySelectorAll('.copy-button').forEach(el => {
      if (!el.dataset.help) el.dataset.help = 'Copy text from target field.';
    });
    document.querySelectorAll('.save-button').forEach(el => {
      if (!el.dataset.help) el.dataset.help = 'Save current list to presets.';
    });
    document.querySelectorAll('.delete-button').forEach(el => {
      if (!el.dataset.help) el.dataset.help = 'Delete selected preset list.';
    });
    document.querySelectorAll('.random-button').forEach(el => {
      if (!el.dataset.help) el.dataset.help = 'Randomize order or values.';
    });
    document.querySelectorAll('.hide-button').forEach(el => {
      if (!el.dataset.help) el.dataset.help = 'Hide or show associated inputs.';
    });

    let tooltip; // Reused tooltip element

    // Display tooltip below clicked element
    const show = el => {
      const text = el.dataset.help || el.title;
      if (!text) return;
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'help-tooltip';
        document.body.appendChild(tooltip);
      }
      tooltip.textContent = text;
      const rect = el.getBoundingClientRect();
      tooltip.style.left = `${rect.left + window.scrollX}px`;
      tooltip.style.top = `${rect.bottom + window.scrollY + 4}px`;
      tooltip.style.display = 'block';
    };

    // Hide tooltip helper
    const hide = () => {
      if (tooltip) tooltip.style.display = 'none';
    };

    // Intercept clicks when help mode is active
    document.addEventListener(
      'click',
      e => {
        if (!cb.checked) return;
        const el = e.target.closest('[data-help], [title]');
        if (el) {
          // Allow help-mode toggle to disable itself while still showing help
          if (el.dataset && el.dataset.target === 'help-mode') {
            show(el);
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          show(el);
        } else {
          hide();
        }
      },
      true
    );

    // Clear tooltip when disabling help mode
    cb.addEventListener('change', () => {
      if (!cb.checked) hide();
    });
    // Hide tooltip on scroll for clarity
    window.addEventListener('scroll', hide);
  }

  /**
   * Startup routine called once DOM is ready.
   * Purpose: Initialize everything and load preset dropdowns.
   * Usage: On load.
   * 50% Rule: Calls all setups.
   */
  function initializeUI() {
    storage.loadPersisted();
    loadLists(); // Populate selects on first load
    applyCurrentPresets();
    setupDelimiterControls();

    setupPresetListener('neg-select', 'neg-input', 'negative');
    setupPresetListener('pos-select', 'pos-input', 'positive');
    setupPresetListener('length-select', 'length-input', 'length');
    setupPresetListener('divider-select', 'divider-input', 'divider');
    setupPresetListener('base-select', 'base-input', 'base');
    setupPresetListener('lyrics-select', 'lyrics-input', 'lyrics');
    setupPresetListener('lyrics-insert-select', 'lyrics-insert-input', 'insertion');
    populateOrderOptions(document.getElementById('base-order-select'));
    populateOrderOptions(document.getElementById('pos-order-select'));
    populateOrderOptions(document.getElementById('neg-order-select'));
    setupRerollButton('base-reroll', 'base-order-select');
    setupRerollButton('pos-reroll-1', 'pos-order-select');
    setupRerollButton('neg-reroll-1', 'neg-order-select');
    setupSectionHide('pos');
    setupSectionHide('neg');
    setupSectionOrder('pos');
    setupSectionOrder('neg');
    document.getElementById('generate').addEventListener('click', generate);

    setupToggleButtons();
    setupStackControls();
    setupShuffleAll();
    setupHideToggles();
    reflectAllRandom();
    reflectAllHide();

    const allHide = document.getElementById('all-hide');
    if (allHide) {
      allHide.addEventListener('change', applyAllHideState);
      if (allHide.checked) applyAllHideState();
    }

    setupCopyButtons();
    setupDataButtons();
    setupHelpMode();

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
    const insertSave = document.getElementById('lyrics-insert-save');
    if (insertSave) insertSave.addEventListener('click', () => lists.saveList('insertion'));
    const baseDelete = document.getElementById('base-delete');
    if (baseDelete) baseDelete.addEventListener('click', () => lists.deleteList('base'));
    const posDelete = document.getElementById('pos-delete-1');
    if (posDelete) posDelete.addEventListener('click', () => lists.deleteList('positive'));
    const negDelete = document.getElementById('neg-delete-1');
    if (negDelete) negDelete.addEventListener('click', () => lists.deleteList('negative'));
    const lenDelete = document.getElementById('length-delete');
    if (lenDelete) lenDelete.addEventListener('click', () => lists.deleteList('length'));
    const divDelete = document.getElementById('divider-delete');
    if (divDelete) divDelete.addEventListener('click', () => lists.deleteList('divider'));
    const lyricsDelete = document.getElementById('lyrics-delete');
    if (lyricsDelete) lyricsDelete.addEventListener('click', () => lists.deleteList('lyrics'));
    const insertDelete = document.getElementById('lyrics-insert-delete');
    if (insertDelete) insertDelete.addEventListener('click', () => lists.deleteList('insertion'));
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
    setupDelimiterControls,
    setupToggleButtons,
    setupShuffleAll,
    setupStackControls,
    setupHideToggles,
    applyAllHideState,
    setupCopyButtons,
    setupDataButtons,
    setupHelpMode,
    updateStackBlocks,
    setupRerollButton,
    setupSectionHide,
    setupSectionOrder,
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

  // For Jest tests this file exports helpers via CommonJS.
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

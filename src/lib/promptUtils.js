(function (global) {
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

  function countWords(str) {
    const cleaned = str.trim().replace(/[,.!:;?]$/, '');
    if (!cleaned) return 0;
    return cleaned.split(/\s+/).length;
  }

  function parseDividerInput(raw) {
    if (!raw) return [];
    return raw.split(/\r?\n/).filter(line => line !== '');
  }

  function parseOrderInput(raw) {
    if (!raw) return [];
    return raw
      .split(/[,\s]+/)
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n));
  }

  function applyOrder(items, order) {
    if (!Array.isArray(order) || !order.length) return items.slice();
    return items.map((_, i) => {
      const idx = order[i % order.length];
      return items[idx % items.length];
    });
  }

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

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function equalizeLength(a, b) {
    const len = Math.min(a.length, b.length);
    return [a.slice(0, len), b.slice(0, len)];
  }

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

  const api = {
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

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.promptUtils = api;
  }
})(typeof window !== 'undefined' ? window : global);

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

  function buildPrefixedList(
    orderedItems,
    prefixes,
    limit,
    prefixOrder = null,
    delimited = false,
    dividers = [],
    itemOrder = null,
    depths = null
  ) {
    if (!Array.isArray(orderedItems) || orderedItems.length === 0) return [];
    let items = orderedItems.slice();
    if (itemOrder) items = applyOrder(items, itemOrder);
    const prefixPool = prefixOrder ? applyOrder(prefixes, prefixOrder) : prefixes.slice();
    const dividerPool = dividers.slice();
    const depthPool = Array.isArray(depths) ? depths.slice() : null;
    const result = [];
    let idx = 0;
    let divIdx = 0;
    while (true) {
      const needDivider = idx > 0 && idx % items.length === 0 && dividerPool.length;
      const prefix = prefixPool.length ? prefixPool[idx % prefixPool.length] : '';
      const item = items[idx % items.length];
      const depth = depthPool ? depthPool[idx % depthPool.length] : 0;
      const term = prefix ? insertAtDepth(item, prefix, depth) : item;
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
    const orders = [];
    if (Array.isArray(modOrders) && Array.isArray(modOrders[0])) {
      for (let i = 0; i < count; i++) {
        const ord = modOrders[i % modOrders.length];
        orders.push(ord ? applyOrder(modifiers, ord) : modifiers.slice());
      }
    } else {
      const orderedMods = modOrders ? applyOrder(modifiers, modOrders) : modifiers.slice();
      for (let i = 0; i < count; i++) orders.push(orderedMods);
    }
    const dividerPool = dividers.slice();
    let items = baseItems.slice();
    if (itemOrder) items = applyOrder(items, itemOrder);
    let depthPools;
    if (Array.isArray(depths) && Array.isArray(depths[0])) {
      depthPools = depths.map(d => (Array.isArray(d) ? d.slice() : []));
    } else {
      const dp = Array.isArray(depths) ? depths.slice() : null;
      depthPools = orders.map(() => dp);
    }
    const result = [];
    let idx = 0;
    let divIdx = 0;
    while (true) {
      const needDivider = idx > 0 && idx % items.length === 0 && dividerPool.length;
      let term = items[idx % items.length];
      orders.forEach((mods, si) => {
        const mod = mods[idx % mods.length];
        const pool = depthPools[si];
        const depth = pool ? pool[idx % pool.length] : 0;
        term = mod ? insertAtDepth(term, mod, depth) : term;
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
    const orders = [];
    if (Array.isArray(modOrders) && Array.isArray(modOrders[0])) {
      for (let i = 0; i < count; i++) {
        const ord = modOrders[i % modOrders.length];
        orders.push(ord ? applyOrder(negMods, ord) : negMods.slice());
      }
    } else {
      const orderedMods = modOrders ? applyOrder(negMods, modOrders) : negMods.slice();
      for (let i = 0; i < count; i++) orders.push(orderedMods);
    }
    const dividerSet = new Set(dividers);
    const result = [];
    let modIdx = 0;
    let items = posTerms.slice();
    if (itemOrder) items = applyOrder(items, itemOrder);
    let depthPools;
    if (Array.isArray(depths) && Array.isArray(depths[0])) {
      depthPools = depths.map(d => (Array.isArray(d) ? d.slice() : []));
    } else {
      const dp = Array.isArray(depths) ? depths.slice() : null;
      depthPools = orders.map(() => dp);
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
      orders.forEach((mods, si) => {
        const mod = mods[modIdx % mods.length];
        const pool = depthPools[si];
        const depth = pool ? pool[modIdx % pool.length] : 0;
        term = mod ? insertAtDepth(term, mod, depth) : term;
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
    depths = null,
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
      depths
    );
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
          depths
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
          depths
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
    parseDividerInput,
    parseOrderInput,
    applyOrder,
    insertAtDepth,
    shuffle,
    equalizeLength,
    buildPrefixedList,
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

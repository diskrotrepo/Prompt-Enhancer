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

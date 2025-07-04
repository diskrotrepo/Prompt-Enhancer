(function(global) {
  const utils =
    typeof module !== 'undefined' && module.exports
      ? require('./promptUtils')
      : global.promptUtils;
  const { parseInput, parseDividerInput } = utils || {};

  const NEG_PRESETS = {};
  const POS_PRESETS = {};
  const LENGTH_PRESETS = {};
  const DIVIDER_PRESETS = {};
  const BASE_PRESETS = {};
  const LYRICS_PRESETS = {};

  const LISTS = (function() {
    if (typeof global.ALL_LISTS !== 'undefined' && Array.isArray(global.ALL_LISTS.presets)) {
      return JSON.parse(JSON.stringify(global.ALL_LISTS));
    } else if (
      typeof global.NEGATIVE_LISTS !== 'undefined' ||
      typeof global.POSITIVE_LISTS !== 'undefined' ||
      typeof global.LENGTH_LISTS !== 'undefined'
    ) {
      const obj = { presets: [] };
      if (typeof global.NEGATIVE_LISTS !== 'undefined') {
        global.NEGATIVE_LISTS.presets.forEach(p => obj.presets.push({ ...p, type: 'negative' }));
      }
      if (typeof global.POSITIVE_LISTS !== 'undefined') {
        global.POSITIVE_LISTS.presets.forEach(p => obj.presets.push({ ...p, type: 'positive' }));
      }
      if (typeof global.LENGTH_LISTS !== 'undefined') {
        global.LENGTH_LISTS.presets.forEach(p => obj.presets.push({ ...p, type: 'length' }));
      }
      return obj;
    }
    return { presets: [] };
  })();

  function clear(obj) {
    Object.keys(obj).forEach(k => delete obj[k]);
  }

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

  function loadLists() {
    clear(NEG_PRESETS);
    clear(POS_PRESETS);
    clear(LENGTH_PRESETS);
    clear(DIVIDER_PRESETS);
    clear(BASE_PRESETS);
    clear(LYRICS_PRESETS);
    const neg = [];
    const pos = [];
    const len = [];
    const divs = [];
    const base = [];
    const lyrics = [];
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
  }

  function exportLists() {
    return JSON.stringify(LISTS, null, 2);
  }

  function importLists(obj, additive = false) {
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.presets)) return;
    if (!additive) {
      LISTS.presets = obj.presets.map(p => ({
        id: p.id,
        title: p.title,
        type: p.type,
        items: Array.isArray(p.items) ? p.items : []
      }));
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

  function loadListsFromFile(file, additive = false) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        importLists(data, additive);
      } catch (err) {
        alert('Invalid lists file');
      }
    };
    reader.readAsText(file);
  }

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

  function saveList(type) {
    const map = {
      base: { select: 'base-select', input: 'base-input', store: BASE_PRESETS },
      negative: { select: 'neg-select', input: 'neg-input', store: NEG_PRESETS },
      positive: { select: 'pos-select', input: 'pos-input', store: POS_PRESETS },
      length: { select: 'length-select', input: 'length-input', store: LENGTH_PRESETS },
      divider: { select: 'divider-select', input: 'divider-input', store: DIVIDER_PRESETS },
      lyrics: { select: 'lyrics-select', input: 'lyrics-input', store: LYRICS_PRESETS }
    };
    const cfg = map[type];
    if (!cfg) return;
    const sel = document.getElementById(cfg.select);
    const inp = document.getElementById(cfg.input);
    if (!sel || !inp) return;
    const name = prompt('Enter list name', sel.value);
    if (!name) return;
    let items;
    if (type === 'divider') {
      items = parseDividerInput(inp.value);
    } else if (type === 'lyrics') {
      items = [inp.value];
    } else {
      items = parseInput(inp.value);
    }
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

  const api = {
    loadLists,
    exportLists,
    importLists,
    saveList,
    loadListsFromFile,
    downloadLists,
    NEG_PRESETS,
    POS_PRESETS,
    LENGTH_PRESETS,
    DIVIDER_PRESETS,
    BASE_PRESETS,
    LYRICS_PRESETS,
    LISTS
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.listManager = api;
  }
})(this);

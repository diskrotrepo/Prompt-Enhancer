(function (global) {
  const utils =
    global.promptUtils || (typeof require !== 'undefined' && require('../core/promptUtils'));
  let NEG_PRESETS = {};
  let POS_PRESETS = {};
  let LENGTH_PRESETS = {};
  let DIVIDER_PRESETS = {};
  let BASE_PRESETS = {};
  let LYRICS_PRESETS = {};
  let ORDER_PRESETS = {};

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
    if (posDepthSelect) populateSelect(posDepthSelect, order);
    const negDepthSelect = document.getElementById('neg-depth-select');
    if (negDepthSelect) populateSelect(negDepthSelect, order);
  }

  function exportLists() {
    return JSON.stringify(LISTS, null, 2);
  }

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
      lyrics: { select: 'lyrics-select', input: 'lyrics-input', store: LYRICS_PRESETS },
      order: { select: 'pos-depth-select', input: 'pos-depth-input', store: ORDER_PRESETS }
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
      sel.appendChild(opt);
    } else {
      preset.items = items;
    }
    cfg.store[name] = items;
    sel.value = name;
  }

  const api = {
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
    saveList,
    loadListsFromFile,
    downloadLists
  };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.listManager = api;
  }
})(typeof window !== 'undefined' ? window : global);

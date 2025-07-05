(function (global) {
  let LISTS = { presets: [] };
  let NEG_PRESETS = {};
  let POS_PRESETS = {};
  let LENGTH_PRESETS = {};
  let DIVIDER_PRESETS = {};
  let BASE_PRESETS = {};
  let LYRICS_PRESETS = {};
  let ORDER_PRESETS = {};

  function rebuildCaches() {
    NEG_PRESETS = {};
    POS_PRESETS = {};
    LENGTH_PRESETS = {};
    DIVIDER_PRESETS = {};
    BASE_PRESETS = {};
    LYRICS_PRESETS = {};
    ORDER_PRESETS = {};
    if (Array.isArray(LISTS.presets)) {
      LISTS.presets.forEach(p => {
        if (p.type === 'negative') NEG_PRESETS[p.id] = p.items || [];
        else if (p.type === 'positive') POS_PRESETS[p.id] = p.items || [];
        else if (p.type === 'length') LENGTH_PRESETS[p.id] = p.items || [];
        else if (p.type === 'divider') DIVIDER_PRESETS[p.id] = p.items || [];
        else if (p.type === 'base') BASE_PRESETS[p.id] = p.items || [];
        else if (p.type === 'lyrics') LYRICS_PRESETS[p.id] = p.items || [];
        else if (p.type === 'order') ORDER_PRESETS[p.id] = p.items || [];
      });
    }
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
    rebuildCaches();
  }

  const api = {
    get NEG_PRESETS() { return NEG_PRESETS; },
    get POS_PRESETS() { return POS_PRESETS; },
    get LENGTH_PRESETS() { return LENGTH_PRESETS; },
    get DIVIDER_PRESETS() { return DIVIDER_PRESETS; },
    get BASE_PRESETS() { return BASE_PRESETS; },
    get LYRICS_PRESETS() { return LYRICS_PRESETS; },
    get ORDER_PRESETS() { return ORDER_PRESETS; },
    get LISTS() { return LISTS; },
    exportLists,
    importLists
  };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.coreLists = api;
  }
})(typeof window !== 'undefined' ? window : global);

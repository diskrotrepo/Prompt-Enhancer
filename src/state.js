(function (global) {
  const state = {
    presets: {
      negative: {},
      positive: {},
      length: {},
      divider: {},
      base: {},
      lyrics: {}
    },
    shuffle: {
      base: false,
      positive: false,
      negative: false,
      dividers: false
    },
    seed: null
  };

  function exportState() {
    return JSON.stringify(state, null, 2);
  }

  function importState(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.presets && typeof obj.presets === 'object') {
      const p = obj.presets;
      state.presets.negative = p.negative || {};
      state.presets.positive = p.positive || {};
      state.presets.length = p.length || {};
      state.presets.divider = p.divider || {};
      state.presets.base = p.base || {};
      state.presets.lyrics = p.lyrics || {};
    }
    if (obj.shuffle && typeof obj.shuffle === 'object') {
      const s = obj.shuffle;
      state.shuffle.base = !!s.base;
      state.shuffle.positive = !!s.positive;
      state.shuffle.negative = !!s.negative;
      state.shuffle.dividers = !!s.dividers;
    }
    if (Object.prototype.hasOwnProperty.call(obj, 'seed')) {
      state.seed = obj.seed;
    }
  }

  if (typeof module !== 'undefined') {
    module.exports = { state, exportState, importState };
  } else {
    global.stateManager = { state, exportState, importState };
  }
})(typeof window !== 'undefined' ? window : global);

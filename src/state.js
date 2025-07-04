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
      divider: false
    },
    seed: null
  };

  function exportState() {
    return JSON.stringify(state, null, 2);
  }

  function importState(obj) {
    if (!obj) return;
    const data = typeof obj === 'string' ? JSON.parse(obj) : obj;
    if (data.presets) {
      state.presets.negative = data.presets.negative || {};
      state.presets.positive = data.presets.positive || {};
      state.presets.length = data.presets.length || {};
      state.presets.divider = data.presets.divider || {};
      state.presets.base = data.presets.base || {};
      state.presets.lyrics = data.presets.lyrics || {};
    }
    if (data.shuffle) {
      state.shuffle.base = !!data.shuffle.base;
      state.shuffle.positive = !!data.shuffle.positive;
      state.shuffle.negative = !!data.shuffle.negative;
      state.shuffle.divider = !!data.shuffle.divider;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'seed')) {
      state.seed = data.seed;
    }
  }

  const api = { state, exportState, importState };
  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    global.appState = api;
  }
})(typeof window !== 'undefined' ? window : global);
